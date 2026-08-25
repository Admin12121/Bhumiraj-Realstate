import { AdminShell } from "../_components";
import { AdminAccountTabs } from "./_components";

export default function Page() {
  return (
    <AdminShell title="Your account">
      <AdminAccountTabs />
    </AdminShell>
  );
}
