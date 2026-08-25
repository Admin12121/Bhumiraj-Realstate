import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@real-estate/database';

type Kind = 'LISTING_REPORT' | 'USER_REPORT';

const MESSAGE_SELECT = {
  id: true,
  body: true,
  fromStaff: true,
  createdAt: true,
  author: { select: { name: true } },
} as const;

/**
 * Reports handled as tickets: a reporter raises one, any staff member can read
 * it, and replying is what claims it. Two report tables share this shape, so
 * the kind is threaded through rather than duplicating each operation.
 */
@Injectable()
export class TicketsService {
  async detail(kind: Kind, id: string) {
    if (kind === 'LISTING_REPORT') {
      const row = await prisma.listingReport.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          reason: true,
          details: true,
          createdAt: true,
          assignedToId: true,
          assignedTo: { select: { name: true } },
          reporter: { select: { name: true, email: true } },
          listing: { select: { title: true } },
          messages: { orderBy: { createdAt: 'asc' }, select: MESSAGE_SELECT },
        },
      });
      if (!row) throw new NotFoundException();
      return this.present(kind, row, row.listing.title);
    }

    const row = await prisma.userReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        reason: true,
        details: true,
        createdAt: true,
        assignedToId: true,
        assignedTo: { select: { name: true } },
        reporter: { select: { name: true, email: true } },
        reportedUser: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' }, select: MESSAGE_SELECT },
      },
    });
    if (!row) throw new NotFoundException();
    return this.present(kind, row, row.reportedUser.name);
  }

  private present(
    kind: Kind,
    row: {
      id: string;
      status: string;
      reason: string;
      details: string | null;
      createdAt: Date;
      assignedToId: string | null;
      assignedTo: { name: string } | null;
      reporter: { name: string; email: string };
      messages: {
        id: string;
        body: string;
        fromStaff: boolean;
        createdAt: Date;
        author: { name: string };
      }[];
    },
    subjectLabel: string,
  ) {
    return {
      id: row.id,
      kind,
      status: row.status as 'OPEN',
      reason: row.reason,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
      reporterName: row.reporter.name,
      reporterEmail: row.reporter.email,
      subjectLabel,
      assignedToId: row.assignedToId,
      assignedToName: row.assignedTo?.name ?? null,
      messages: row.messages.map((message) => ({
        id: message.id,
        body: message.body,
        fromStaff: message.fromStaff,
        authorName: message.author.name,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Replying claims an unassigned ticket. Re-checked here rather than trusted
   * from the client, so two staff reading the same ticket cannot both take it.
   */
  async reply(kind: Kind, id: string, body: string, staffId: string) {
    return prisma.$transaction(async (tx) => {
      const current =
        kind === 'LISTING_REPORT'
          ? await tx.listingReport.findUnique({
              where: { id },
              select: { id: true, assignedToId: true, status: true },
            })
          : await tx.userReport.findUnique({
              where: { id },
              select: { id: true, assignedToId: true, status: true },
            });
      if (!current) throw new NotFoundException();
      if (current.assignedToId && current.assignedToId !== staffId) {
        throw new ConflictException({
          code: 'TICKET_TAKEN',
          message: 'Another staff member is already handling this ticket.',
        });
      }

      const message = await tx.reportMessage.create({
        data: {
          ...(kind === 'LISTING_REPORT'
            ? { listingReportId: id }
            : { userReportId: id }),
          authorId: staffId,
          fromStaff: true,
          body,
        },
        select: { id: true, createdAt: true },
      });

      const data = {
        assignedToId: staffId,
        ...(current.status === 'OPEN' ? { status: 'IN_REVIEW' as const } : {}),
      };
      if (kind === 'LISTING_REPORT') {
        await tx.listingReport.update({ where: { id }, data });
      } else {
        await tx.userReport.update({ where: { id }, data });
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          action: 'REPORT_REVIEWED',
          entityType:
            kind === 'LISTING_REPORT' ? 'ListingReport' : 'UserReport',
          entityId: id,
          after: { assignedToId: staffId, status: 'IN_REVIEW' },
        },
      });

      return { id: message.id, createdAt: message.createdAt.toISOString() };
    });
  }

  /**
   * Hands a ticket to another staff member. Only the current owner may do it,
   * so a ticket cannot be pulled out from under whoever is working it.
   */
  async transfer(kind: Kind, id: string, assigneeId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const current =
        kind === 'LISTING_REPORT'
          ? await tx.listingReport.findUnique({
              where: { id },
              select: { id: true, assignedToId: true },
            })
          : await tx.userReport.findUnique({
              where: { id },
              select: { id: true, assignedToId: true },
            });
      if (!current) throw new NotFoundException();
      if (current.assignedToId && current.assignedToId !== actorId) {
        throw new ForbiddenException({
          code: 'TICKET_NOT_YOURS',
          message: 'Only the staff member handling a ticket can transfer it.',
        });
      }

      const assignee = await tx.user.findFirst({
        where: {
          id: assigneeId,
          role: { in: ['OWNER', 'STAFF'] },
          banned: false,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new ConflictException({
          code: 'TICKET_ASSIGNEE_INVALID',
          message: 'That account cannot take tickets.',
        });
      }

      const data = { assignedToId: assigneeId, status: 'IN_REVIEW' as const };
      if (kind === 'LISTING_REPORT') {
        await tx.listingReport.update({ where: { id }, data });
      } else {
        await tx.userReport.update({ where: { id }, data });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'REPORT_REVIEWED',
          entityType:
            kind === 'LISTING_REPORT' ? 'ListingReport' : 'UserReport',
          entityId: id,
          before: { assignedToId: current.assignedToId },
          after: { assignedToId: assigneeId },
        },
      });

      return { id, assignedToId: assigneeId };
    });
  }

  /** Staff who can be handed a ticket, for the transfer picker. */
  async assignableStaff(search: string) {
    const rows = await prisma.user.findMany({
      where: {
        role: { in: ['OWNER', 'STAFF'] },
        banned: false,
        lifecycleStatus: 'ACTIVE',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true, email: true, image: true },
    });
    return { items: rows };
  }
}
