import { AdminShell } from "@/features/admin/components/admin-shell";
import { ModerationPanel } from "@/features/admin/components/admin-operations-panels";
export default function Page(){return <AdminShell title="Moderation" description="Review user and listing reports"><ModerationPanel/></AdminShell>}
