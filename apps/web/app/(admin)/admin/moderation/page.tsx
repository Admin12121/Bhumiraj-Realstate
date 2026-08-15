import { AdminShell, ModerationPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell title="Moderation" description="Review user and listing reports">
      <ModerationPanel />
    </AdminShell>
  );
}