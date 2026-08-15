import { AuthCard, SignUpForm } from "../_components";

export default function Page() {
  return (
    <AuthCard
      title="Create your account"
      description="Join Nepal’s trusted property marketplace."
    >
      <SignUpForm />
    </AuthCard>
  );
}