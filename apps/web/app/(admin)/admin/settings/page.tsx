import { AdminShell } from "@/features/admin/components/admin-shell";
import { SettingsPanel } from "@/features/admin/components/admin-operations-panels";
export default function Page(){return <AdminShell title="Platform settings" description="Controlled production defaults"><SettingsPanel/></AdminShell>}
