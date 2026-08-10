import { prisma } from "../src/client";

const amenities = [
  ["Parking", "parking", "access"], ["Garden", "garden", "outdoor"], ["Backup Power", "backup-power", "utility"], ["Water Supply", "water-supply", "utility"], ["Security", "security", "safety"], ["Elevator", "elevator", "access"],
] as const;

async function main() {
  for (const [name, slug, category] of amenities) await prisma.amenity.upsert({ where: { slug }, update: { name, category }, create: { name, slug, category } });
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  if (process.env.E2E_MODE === "true" && adminEmail) {
    await prisma.user.upsert({ where: { email: adminEmail }, update: { role: "SUPER_ADMIN", emailVerified: true }, create: { name: "Platform Admin", email: adminEmail, emailVerified: true, role: "SUPER_ADMIN", profile: { create: { username: "admin" } } } });
  }
}
main().finally(() => prisma.$disconnect());
