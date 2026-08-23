import { AdminShell, AdminMessagesPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Support messages"
      permission="admin.messages.read"
    >
      <AdminMessagesPanel />
    </AdminShell>
  );
}