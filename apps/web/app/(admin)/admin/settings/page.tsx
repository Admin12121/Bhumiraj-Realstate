import { AdminShell, SettingsPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Platform settings"
      description="Controlled production defaults"
      permission="admin.settings.read"
    >
      <SettingsPanel />
    </AdminShell>
  );
}