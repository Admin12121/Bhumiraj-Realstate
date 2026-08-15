import { AdminShell, AuditPanel } from "../_components";

export default function Page() {
  return (
    <AdminShell
      title="Audit log"
      description="Immutable administrative and security events"
      permission="admin.audit.read"
    >
      <AuditPanel />
    </AdminShell>
  );
}