import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/password-reset-forms";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="Use a strong password that you do not reuse elsewhere.">
      <Suspense fallback={<p className="text-center text-sm text-slate-500">Checking reset link…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
