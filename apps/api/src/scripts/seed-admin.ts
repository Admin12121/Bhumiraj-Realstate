import { createAuth } from "@real-estate/auth";
import { prisma } from "@real-estate/database";
import { apiEnv } from "../bootstrap-env";

const shouldSeed = process.env.SEED_ADMIN_ON_START !== "false";
const shouldReset = process.env.SEED_ADMIN_RESET === "true";

const adminEmail = process.env.BHUMIRAJ_ADMIN_EMAIL ?? "admin@gmail.com";
const adminPassword = process.env.BHUMIRAJ_ADMIN_PASSWORD ?? "admin@#1234";
const adminName = process.env.BHUMIRAJ_ADMIN_NAME ?? "Admin";

async function main(): Promise<void> {
  if (!shouldSeed) {
    console.log("Admin seed skipped because SEED_ADMIN_ON_START=false");
    return;
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
        role: "SUPER_ADMIN",
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
      `Seed admin already exists; ensured SUPER_ADMIN role for ${adminEmail}`,
    );
    return;
  }

  const auth = createAuth({
    env: apiEnv,
    sendEmail: async () => undefined,
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
      role: "SUPER_ADMIN",
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
