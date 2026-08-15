import { AccountShell, MessagesCenter } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="Messages"
      description="Conversations with buyers, sellers and agents."
    >
      <MessagesCenter />
    </AccountShell>
  );
}