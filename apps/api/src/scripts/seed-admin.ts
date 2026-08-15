import { createAuth } from "@real-estate/auth";
import { prisma } from "@real-estate/database";
import { apiEnv } from "../bootstrap-env";

const shouldSeed = process.env.SEED_ADMIN_ON_START === "true";
const shouldReset = process.env.SEED_ADMIN_RESET === "true";

const adminEmail = process.env.BHUMIRAJ_ADMIN_EMAIL?.trim();
const adminPassword = process.env.BHUMIRAJ_ADMIN_PASSWORD;
const adminName = process.env.BHUMIRAJ_ADMIN_NAME ?? "Admin";

async function main(): Promise<void> {
  if (!shouldSeed) {
    console.log("Admin seed skipped because SEED_ADMIN_ON_START=false");
    return;
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("Owner seeding requires BHUMIRAJ_ADMIN_EMAIL and BHUMIRAJ_ADMIN_PASSWORD.");
  }
  if (adminPassword.length < 16) {
    throw new Error("BHUMIRAJ_ADMIN_PASSWORD must contain at least 16 characters.");
  }

  const currentOwner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    select: { id: true, email: true },
  });
  if (currentOwner && currentOwner.email !== adminEmail) {
    throw new Error(
      `An owner already exists (${currentOwner.email}). Owner transfer must use the audited governance flow.`,
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existing && shouldReset) {
    await prisma.user.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "OWNER",
        emailVerified: true,
        banned: false,
        lifecycleStatus: "ACTIVE",
      },
    });
    await prisma.userProfile.upsert({
      where: { userId: existing.id },
      update: {},
      create: { userId: existing.id },
    });
    console.log(
      `Seed owner already exists; ensured OWNER account type for ${adminEmail}`,
    );
    return;
  }

  const auth = createAuth({
    env: apiEnv,
    sendEmail: () => Promise.resolve(),
  });
  const created = await auth.api.signUpEmail({
    body: {
      name: adminName,
      email: adminEmail,
      password: adminPassword,
    },
    headers: {
      "x-forwarded-for": "127.0.0.1",
      "x-real-ip": "127.0.0.1",
      "user-agent": "bhumiraj-seed/1.0",
    },
  });

  await prisma.user.update({
    where: { id: created.user.id },
    data: {
      role: "OWNER",
      emailVerified: true,
      banned: false,
      lifecycleStatus: "ACTIVE",
    },
  });
  await prisma.userProfile.upsert({
    where: { userId: created.user.id },
    update: {},
    create: { userId: created.user.id },
  });

  console.log(`Seeded platform admin ${adminEmail}`);
}

void main()
  .catch((error: unknown) => {
    console.error("Failed to seed platform admin:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
