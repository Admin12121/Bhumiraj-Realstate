import { AccountShell, ProfileForm } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="Your profile"
      description="Manage the public information shown to buyers, sellers and agents."
    >
      <ProfileForm />
    </AccountShell>
  );
}