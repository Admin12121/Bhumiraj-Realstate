import { AdminShell } from "@/features/admin/components/admin-shell";
import { AuditPanel } from "@/features/admin/components/admin-operations-panels";
export default function Page(){return <AdminShell title="Audit log" description="Immutable administrative and security events"><AuditPanel/></AdminShell>}
