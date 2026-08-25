import { AdminShell } from "../_components";
import { AuditPanel } from "./_components";

export default function Page() {
  return (
    <AdminShell
      title="Audit log"
      permission="admin.audit.read"
    >
      <AuditPanel />
    </AdminShell>
  );
}