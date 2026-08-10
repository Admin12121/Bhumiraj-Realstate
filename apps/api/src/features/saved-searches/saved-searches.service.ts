import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@real-estate/database";
import type { z } from "zod";
import { createSavedSearchSchema } from "@real-estate/contracts";
import { assertActiveAccount } from "../../shared/auth/account-policy";

type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

@Injectable()
export class SavedSearchesService {
  async list(userId: string) {
    const rows = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastNotifiedAt: row.lastNotifiedAt?.toISOString() ?? null,
    }));
  }

  async create(userId: string, input: CreateSavedSearchInput) {
    await assertActiveAccount(userId, { requireVerifiedEmail: true });
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(hashtext(${`saved-search:${userId}`}))
          `;
          const count = await tx.savedSearch.count({ where: { userId } });
          if (count >= 50) {
            throw new ConflictException({
              code: "SAVED_SEARCH_LIMIT_REACHED",
              message: "A maximum of 50 saved searches is allowed per account.",
            });
          }
          return tx.savedSearch.create({ data: { userId, ...input } });
        },
        { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw new ConflictException({
          code: "SAVED_SEARCH_NAME_TAKEN",
          message: "A saved search with this name already exists.",
        });
      }
      throw error;
    }
  }

  async toggle(userId: string, id: string) {
    await assertActiveAccount(userId);
    const row = await prisma.savedSearch.findFirst({
      where: { id, userId },
      select: { alertsEnabled: true },
    });
    if (!row) throw new NotFoundException();
    return prisma.savedSearch.update({
      where: { id },
      data: { alertsEnabled: !row.alertsEnabled },
    });
  }

  async remove(userId: string, id: string) {
    await assertActiveAccount(userId);
    const result = await prisma.savedSearch.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException();
    return { deleted: true };
  }
}
