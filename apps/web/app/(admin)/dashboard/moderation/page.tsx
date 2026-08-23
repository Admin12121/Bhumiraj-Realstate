import { AdminShell, ModerationPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell title="Moderation" permission="admin.moderation.read">
      <ModerationPanel />
    </AdminShell>
  );
}