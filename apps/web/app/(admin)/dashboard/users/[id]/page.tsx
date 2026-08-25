import { AdminShell } from "../../_components";
import { AdminUserDetail } from "../_components";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminShell title="Account detail" permission="admin.users.read">
      <AdminUserDetail userId={id} />
    </AdminShell>
  );
}
