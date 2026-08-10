import { ForbiddenException } from "@nestjs/common";
import { prisma } from "@real-estate/database";

export async function assertActiveAccount(
  userId: string,
  options: { requireVerifiedEmail?: boolean } = {},
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      banned: true,
      lifecycleStatus: true,
      emailVerified: true,
    },
  });

  if (!user || user.banned || user.lifecycleStatus !== "ACTIVE") {
    throw new ForbiddenException({
      code: "ACCOUNT_NOT_ACTIVE",
      message: "This operation requires an active account.",
    });
  }
  if (options.requireVerifiedEmail && !user.emailVerified) {
    throw new ForbiddenException({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email before performing this operation.",
    });
  }
}
