import { AdminAccountTabs, AdminShell } from "../_components";

export default function Page() {
  return (
    <AdminShell title="Your account">
      <AdminAccountTabs />
    </AdminShell>
  );
}
