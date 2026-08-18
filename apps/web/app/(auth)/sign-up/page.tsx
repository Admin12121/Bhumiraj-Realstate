import { AuthSplitLayout, SignUpForm } from "../_components";

export default function Page() {
  return (
    <AuthSplitLayout
      title="Create your account"
      description="List a property, save the ones you like and talk to verified agents."
    >
      <SignUpForm />
    </AuthSplitLayout>
  );
}
