import { AdminShell } from "@/features/admin/components/admin-shell";import { AdminUsersTable } from "@/features/admin/components/admin-users-table";
export default function Page(){return <AdminShell title="User management" description="Roles, security status and account lifecycle."><AdminUsersTable/></AdminShell>}
