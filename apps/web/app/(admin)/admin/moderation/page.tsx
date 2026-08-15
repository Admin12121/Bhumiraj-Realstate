import { AdminShell, ModerationPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell title="Moderation" description="Review user and listing reports" permission="admin.moderation.read">
      <ModerationPanel />
    </AdminShell>
  );
}