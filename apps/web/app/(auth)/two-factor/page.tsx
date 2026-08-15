import { Suspense } from "react";
import { AuthCard, TwoFactorForm } from "../_components";

export default function Page() {
  return (
    <AuthCard
      title="Two-factor verification"
      description="Enter the code from your authenticator app or a backup code."
    >
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}