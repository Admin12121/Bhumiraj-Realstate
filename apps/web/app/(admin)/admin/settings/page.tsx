import { AdminShell, SettingsPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Platform settings"
      permission="admin.settings.read"
    >
      <SettingsPanel />
    </AdminShell>
  );
}