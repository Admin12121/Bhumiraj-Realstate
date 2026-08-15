import { AdminShell, AdminMessagesPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Support messages"
      description="Platform support conversations"
    >
      <AdminMessagesPanel />
    </AdminShell>
  );
}