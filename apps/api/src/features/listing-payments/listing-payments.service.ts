import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { prisma } from "@real-estate/database";
import {
  AGENT_CASELOAD_LIMIT,
  AGENT_CASELOAD_WARN_AT,
  listingFeeSettingsSchema,
  type ListingFeeSettings,
} from "@real-estate/contracts";
import { apiEnv } from "../../bootstrap-env";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";
import { notify } from "../../shared/notifications/notify";

const LISTING_FEE_SETTING_KEY = "listingFee";

/** Largest first — a downscaled QR code stops being scannable. */
const QR_VARIANT_PREFERENCE = ["full", "large", "card", "thumb"] as const;

/** Used until an administrator saves a fee configuration. */
const DEFAULT_FEE: ListingFeeSettings = {
  amountMinor: "150000",
  currency: "NPR",
  enabled: true,
  methods: [],
};

const proofCursorSchema = z
  .object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() })
  .strict();

/** Offers still occupying an agent's caseload. */
const ACTIVE_ASSIGNMENT_STATUSES = ["OFFERED", "ACCEPTED"] as const;

@Injectable()
export class ListingPaymentsService {
  async feeSettings(): Promise<ListingFeeSettings> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: LISTING_FEE_SETTING_KEY },
      select: { value: true },
    });
    if (!row) return DEFAULT_FEE;

    const parsed = listingFeeSettingsSchema.safeParse(row.value);
    if (!parsed.success) return DEFAULT_FEE;
    // Resolved on read as well as on write, so the stored URL cannot go stale
    // if the CDN host changes or an image is replaced.
    return this.resolveMethodImages(parsed.data);
  }

  /**
   * Turns the uploaded QR assets into CDN URLs. The URL is derived rather than
   * accepted from the client, so an administrator cannot point the payment
   * screen at an arbitrary image.
   */
  private async resolveMethodImages(
    input: ListingFeeSettings,
  ): Promise<ListingFeeSettings> {
    const assetIds = input.methods
      .map((method) => method.imageAssetId)
      .filter((id): id is string => Boolean(id));

    const assets = assetIds.length
      ? await prisma.mediaAsset.findMany({
          where: {
            id: { in: assetIds },
            purpose: "PAYMENT_QR",
            status: "READY",
          },
          select: {
            id: true,
            objectKey: true,
            variants: { select: { name: true, objectKey: true } },
          },
        })
      : [];

    const base = apiEnv.CDN_BASE_URL.replace(/\/$/, "");
    const urlById = new Map(
      assets.map((asset) => {
        // Deliberately the biggest rendition: a QR downscaled to a thumbnail
        // stops scanning, and there is only ever one of these on screen.
        const variant =
          QR_VARIANT_PREFERENCE.map((name) =>
            asset.variants.find((entry) => entry.name === name),
          ).find(Boolean) ?? asset.variants[0];
        return [asset.id, `${base}/${variant?.objectKey ?? asset.objectKey}`];
      }),
    );

    return {
      ...input,
      methods: input.methods.map((method) => ({
        ...method,
        imageUrl: method.imageAssetId
          ? (urlById.get(method.imageAssetId) ?? null)
          : null,
      })),
    };
  }

  async updateFeeSettings(
    raw: ListingFeeSettings,
    actorId: string,
  ): Promise<ListingFeeSettings> {
    const input = await this.resolveMethodImages(raw);
    await prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: LISTING_FEE_SETTING_KEY },
        create: {
          key: LISTING_FEE_SETTING_KEY,
          value: input,
          updatedById: actorId,
        },
        update: { value: input, updatedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "SETTINGS_UPDATED",
          entityType: "SystemSetting",
          entityId: LISTING_FEE_SETTING_KEY,
        },
      });
    });
    return input;
  }

  /**
   * Attaches an owner's payment screenshot to their listing and moves it into
   * the review queue. The listing must belong to the caller and be waiting for
   * payment, so a published listing cannot be re-submitted.
   */
  async submitProof(
    input: {
      listingId: string;
      mediaAssetId: string;
      method: string;
      reference?: string | undefined;
      amountMinor: string;
      currency: string;
    },
    userId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: input.listingId },
        select: { id: true, createdById: true, status: true, title: true },
      });
      if (!listing) throw new NotFoundException();
      if (listing.createdById !== userId) {
        throw new ForbiddenException({
          code: "NOT_LISTING_OWNER",
          message: "You can only pay for your own listing.",
        });
      }
      if (
        listing.status !== "AWAITING_PAYMENT" &&
        listing.status !== "DRAFT" &&
        listing.status !== "REJECTED"
      ) {
        throw new ConflictException({
          code: "PAYMENT_NOT_REQUIRED",
          message: "This listing is not awaiting payment.",
        });
      }

      const media = await tx.mediaAsset.findUnique({
        where: { id: input.mediaAssetId },
        select: { id: true, ownerId: true, purpose: true, status: true },
      });
      if (!media || media.ownerId !== userId) {
        throw new NotFoundException({
          code: "PROOF_MEDIA_NOT_FOUND",
          message: "Upload the payment screenshot before submitting.",
        });
      }
      if (media.purpose !== "PAYMENT_PROOF") {
        throw new BadRequestException({
          code: "INVALID_PROOF_MEDIA",
          message: "That file was not uploaded as a payment proof.",
        });
      }

      // One open submission per listing keeps the review queue unambiguous.
      const open = await tx.listingPaymentProof.findFirst({
        where: { listingId: listing.id, status: "SUBMITTED" },
        select: { id: true },
      });
      if (open) {
        throw new ConflictException({
          code: "PROOF_ALREADY_SUBMITTED",
          message: "A payment for this listing is already awaiting review.",
        });
      }

      const proof = await tx.listingPaymentProof.create({
        data: {
          listingId: listing.id,
          submittedById: userId,
          mediaAssetId: media.id,
          method: input.method,
          reference: input.reference ?? null,
          amountMinor: BigInt(input.amountMinor),
          currency: input.currency,
        },
        select: { id: true, status: true, createdAt: true },
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: "PENDING_REVIEW" },
      });
      await tx.listingStatusHistory.create({
        data: {
          listingId: listing.id,
          fromStatus: listing.status,
          toStatus: "PENDING_REVIEW",
          reason: "Payment proof submitted",
          actorId: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "LISTING_PAYMENT_SUBMITTED",
          entityType: "ListingPaymentProof",
          entityId: proof.id,
        },
      });

      return {
        id: proof.id,
        status: proof.status,
        createdAt: proof.createdAt.toISOString(),
      };
    });
  }

  async listProofs(query: {
    status?: string | undefined;
    cursor?: string | undefined;
    limit: number;
  }) {
    const cursor = query.cursor
      ? proofCursorSchema.parse(decodeCursor(query.cursor))
      : null;

    const rows = await prisma.listingPaymentProof.findMany({
      where: {
        ...(query.status ? { status: query.status as "SUBMITTED" } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: {
        id: true,
        listingId: true,
        method: true,
        reference: true,
        amountMinor: true,
        currency: true,
        status: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
        listing: { select: { title: true, slug: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
        mediaAsset: { select: { id: true } },
      },
    });

    const items = rows.slice(0, query.limit);
    const next = rows.length > query.limit ? items.at(-1) : undefined;

    return {
      items: items.map((row) => ({
        id: row.id,
        listingId: row.listingId,
        listingTitle: row.listing.title,
        listingSlug: row.listing.slug,
        method: row.method,
        reference: row.reference,
        amountMinor: row.amountMinor.toString(),
        currency: row.currency,
        status: row.status,
        // Proof media is private; the reviewer exchanges this id for a signed
        // URL through the media service when they open the record.
        mediaAssetId: row.mediaAsset.id,
        submittedBy: row.submittedBy,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: next
        ? encodeCursor({ createdAt: next.createdAt.toISOString(), id: next.id })
        : null,
    };
  }

  /**
   * Approving a payment moves the listing to AWAITING_AGENT so an administrator
   * can offer it to an agent. Rejecting returns it to the owner with a reason.
   */
  async reviewProof(
    proofId: string,
    input: { decision: "APPROVE" | "REJECT"; rejectionReason?: string | undefined },
    actorId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const proof = await tx.listingPaymentProof.findUnique({
        where: { id: proofId },
        select: {
          id: true,
          status: true,
          listingId: true,
          listing: { select: { status: true, title: true, createdById: true } },
        },
      });
      if (!proof) throw new NotFoundException();
      if (proof.status !== "SUBMITTED") {
        throw new ConflictException({
          code: "PROOF_ALREADY_REVIEWED",
          message: "This payment has already been reviewed.",
        });
      }

      const approved = input.decision === "APPROVE";
      const nextStatus = approved ? "AWAITING_AGENT" : "AWAITING_PAYMENT";

      await tx.listingPaymentProof.update({
        where: { id: proof.id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          reviewedById: actorId,
          reviewedAt: new Date(),
          rejectionReason: approved ? null : (input.rejectionReason ?? null),
        },
      });
      await tx.listing.update({
        where: { id: proof.listingId },
        data: { status: nextStatus },
      });
      await tx.listingStatusHistory.create({
        data: {
          listingId: proof.listingId,
          fromStatus: proof.listing.status,
          toStatus: nextStatus,
          reason: approved
            ? "Payment verified"
            : (input.rejectionReason ?? "Payment rejected"),
          actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: approved
            ? "LISTING_PAYMENT_APPROVED"
            : "LISTING_PAYMENT_REJECTED",
          entityType: "ListingPaymentProof",
          entityId: proof.id,
          reason: approved ? null : (input.rejectionReason ?? null),
        },
      });

      await notify(tx, {
        userId: proof.listing.createdById,
        type: approved
          ? "listing.payment.approved"
          : "listing.payment.rejected",
        title: approved
          ? "Payment verified"
          : "Payment could not be verified",
        body: approved
          ? `We verified the payment for "${proof.listing.title}". It is now waiting for an agent to take it on.`
          : `We could not verify the payment for "${proof.listing.title}". ${input.rejectionReason ?? "Please submit the payment proof again."}`,
        data: { listingId: proof.listingId, proofId: proof.id },
      });

      return { id: proof.id, listingStatus: nextStatus };
    });
  }

  /** Agents available to take a listing, with live caseload figures. */
  async assignableAgents() {
    const agents = await prisma.agentProfile.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ averageRating: "desc" }, { createdAt: "asc" }],
      take: 100,
      select: {
        id: true,
        userId: true,
        maxActiveCases: true,
        availabilityStatus: true,
        verifiedAt: true,
        user: { select: { name: true, image: true } },
        _count: {
          select: {
            assignments: { where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } } },
          },
        },
      },
    });

    return {
      items: agents.map((agent) => {
        const activeCases = agent._count.assignments;
        const limit = Math.min(agent.maxActiveCases, AGENT_CASELOAD_LIMIT);
        return {
          id: agent.id,
          userId: agent.userId,
          name: agent.user.name,
          image: agent.user.image,
          verified: agent.verifiedAt !== null,
          availabilityStatus: agent.availabilityStatus,
          activeCases,
          maxActiveCases: limit,
          nearCapacity: activeCases >= AGENT_CASELOAD_WARN_AT,
          atCapacity: activeCases >= limit,
        };
      }),
    };
  }

  /**
   * Offers a verified listing to an agent. Refused at the hard caseload limit;
   * the soft limit is advisory and surfaced through `assignableAgents`.
   */
  async assign(
    listingId: string,
    input: { agentId: string; expiresInHours: number },
    actorId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true, title: true },
      });
      if (!listing) throw new NotFoundException();
      if (listing.status !== "AWAITING_AGENT") {
        throw new ConflictException({
          code: "LISTING_NOT_READY",
          message: "Verify the listing payment before assigning an agent.",
        });
      }

      const agent = await tx.agentProfile.findUnique({
        where: { id: input.agentId },
        select: {
          id: true,
          userId: true,
          status: true,
          maxActiveCases: true,
          _count: {
            select: {
              assignments: {
                where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
              },
            },
          },
        },
      });
      if (!agent) throw new NotFoundException();
      if (agent.status !== "ACTIVE") {
        throw new ConflictException({
          code: "AGENT_NOT_ACTIVE",
          message: "That agent is not currently active.",
        });
      }

      const limit = Math.min(agent.maxActiveCases, AGENT_CASELOAD_LIMIT);
      if (agent._count.assignments >= limit) {
        throw new ConflictException({
          code: "AGENT_AT_CAPACITY",
          message: `This agent already holds ${limit} active properties and cannot take another.`,
        });
      }

      const existing = await tx.listingAssignment.findFirst({
        where: { listingId, status: "OFFERED" },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: "ASSIGNMENT_PENDING",
          message: "This listing already has an open offer.",
        });
      }

      const assignment = await tx.listingAssignment.create({
        data: {
          listingId,
          agentId: agent.id,
          assignedById: actorId,
          expiresAt: new Date(
            Date.now() + input.expiresInHours * 60 * 60 * 1000,
          ),
        },
        select: { id: true, status: true, expiresAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "LISTING_AGENT_ASSIGNED",
          entityType: "ListingAssignment",
          entityId: assignment.id,
        },
      });

      await notify(tx, {
        userId: agent.userId,
        type: "listing.assignment.offered",
        title: "A property has been offered to you",
        body: `"${listing.title}" is waiting for your response. Accepting publishes it under your profile.`,
        data: { listingId, assignmentId: assignment.id },
      });

      return {
        id: assignment.id,
        status: assignment.status,
        expiresAt: assignment.expiresAt?.toISOString() ?? null,
      };
    });
  }


  /** Offers addressed to the signed-in agent. */
  /**
   * Drives the agent's workspace nav: non-agents get `isAgent: false` rather
   * than a 403, so every signed-in page can ask this without erroring.
   */
  async agentSummary(userId: string) {
    const agent = await prisma.agentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        maxActiveCases: true,
        status: true,
        availabilityStatus: true,
      },
    });
    if (!agent) return { isAgent: false as const };

    const [offered, active] = await Promise.all([
      prisma.listingAssignment.count({
        where: { agentId: agent.id, status: "OFFERED" },
      }),
      prisma.listingAssignment.count({
        where: { agentId: agent.id, status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
      }),
    ]);

    const limit = Math.min(agent.maxActiveCases, AGENT_CASELOAD_LIMIT);
    return {
      isAgent: true as const,
      pendingOffers: offered,
      activeCases: active,
      caseloadLimit: limit,
      caseloadWarnAt: AGENT_CASELOAD_WARN_AT,
      atCapacity: active >= limit,
      availabilityStatus: agent.availabilityStatus,
      agentStatus: agent.status,
    };
  }

  /** An agent's own availability switch; AT_CAPACITY is derived, not chosen. */
  async setAgentAvailability(
    userId: string,
    availabilityStatus: "AVAILABLE" | "UNAVAILABLE",
  ) {
    const agent = await prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException({
        code: "NOT_AN_AGENT",
        message: "This account is not an agent.",
      });
    }

    await prisma.$transaction([
      prisma.agentProfile.update({
        where: { id: agent.id },
        data: { availabilityStatus, updatedById: userId },
      }),
      prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "AGENT_AVAILABILITY_CHANGED",
          entityType: "AgentProfile",
          entityId: agent.id,
          after: { availabilityStatus },
        },
      }),
    ]);

    return this.agentSummary(userId);
  }

  async agentAssignments(userId: string, status?: string) {
    const agent = await prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException({
        code: "NOT_AN_AGENT",
        message: "This account is not an agent.",
      });
    }

    const rows = await prisma.listingAssignment.findMany({
      where: {
        agentId: agent.id,
        ...(status ? { status: status as "OFFERED" } : {}),
      },
      orderBy: [{ offeredAt: "desc" }],
      take: 50,
      select: {
        id: true,
        listingId: true,
        status: true,
        offeredAt: true,
        expiresAt: true,
        listing: { select: { title: true, slug: true } },
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        listingId: row.listingId,
        listingTitle: row.listing.title,
        listingSlug: row.listing.slug,
        status: row.status,
        offeredAt: row.offeredAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
      })),
    };
  }

  /** The agent's own answer. Accepting publishes the listing under their name. */
  async respond(
    assignmentId: string,
    input: { decision: "ACCEPT" | "DECLINE"; note?: string | undefined },
    userId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.listingAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          status: true,
          listingId: true,
          expiresAt: true,
          agent: {
            select: {
              id: true,
              userId: true,
              user: { select: { name: true } },
            },
          },
          listing: {
            select: { status: true, title: true, createdById: true },
          },
        },
      });
      if (!assignment) throw new NotFoundException();
      if (assignment.agent.userId !== userId) {
        throw new ForbiddenException({
          code: "NOT_ASSIGNED_AGENT",
          message: "This offer belongs to another agent.",
        });
      }
      if (assignment.status !== "OFFERED") {
        throw new ConflictException({
          code: "ASSIGNMENT_CLOSED",
          message: "This offer is no longer open.",
        });
      }
      if (assignment.expiresAt && assignment.expiresAt < new Date()) {
        await tx.listingAssignment.update({
          where: { id: assignment.id },
          data: { status: "EXPIRED", respondedAt: new Date() },
        });
        throw new ConflictException({
          code: "ASSIGNMENT_EXPIRED",
          message: "This offer has expired.",
        });
      }

      const accepted = input.decision === "ACCEPT";

      await tx.listingAssignment.update({
        where: { id: assignment.id },
        data: {
          status: accepted ? "ACCEPTED" : "DECLINED",
          respondedAt: new Date(),
          responseNote: input.note ?? null,
        },
      });

      // Accepting publishes; declining returns the listing to the pool so an
      // administrator can offer it elsewhere.
      const nextStatus = accepted ? "PUBLISHED" : "AWAITING_AGENT";
      await tx.listing.update({
        where: { id: assignment.listingId },
        data: {
          status: nextStatus,
          ...(accepted ? { publishedAt: new Date() } : {}),
        },
      });
      await tx.listingStatusHistory.create({
        data: {
          listingId: assignment.listingId,
          fromStatus: assignment.listing.status,
          toStatus: nextStatus,
          reason: accepted ? "Agent accepted" : (input.note ?? "Agent declined"),
          actorId: userId,
        },
      });
      // Only the owner hears about an acceptance. A decline is an internal
      // routing detail, so it stays with staff rather than worrying the owner.
      if (accepted) {
        await notify(tx, {
          userId: assignment.listing.createdById,
          type: "listing.published",
          title: "Your property is live",
          body: `${assignment.agent.user.name} is now representing "${assignment.listing.title}", and it is published on Bhumiraj.`,
          data: { listingId: assignment.listingId },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: accepted
            ? "LISTING_AGENT_ACCEPTED"
            : "LISTING_AGENT_DECLINED",
          entityType: "ListingAssignment",
          entityId: assignment.id,
          reason: accepted ? null : (input.note ?? null),
        },
      });

      return { id: assignment.id, listingStatus: nextStatus };
    });
  }
}
