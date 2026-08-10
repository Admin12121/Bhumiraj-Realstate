import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/password-reset-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="We will send a time-limited reset link to your verified email address."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
