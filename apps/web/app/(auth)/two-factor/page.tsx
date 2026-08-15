import { AuthCard, TwoFactorForm } from "../_components";
import { safeReturnPath } from "@/shared/security/safe-return-path";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;

  return (
    <AuthCard
      title="Two-factor verification"
      description="Confirm the sign-in with a code or a passkey."
    >
      <TwoFactorForm callbackURL={safeReturnPath(callbackURL)} />
    </AuthCard>
  );
}
