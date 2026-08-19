import { AuthCard, ForgotPasswordForm } from "../_components";

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