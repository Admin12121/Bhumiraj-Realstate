import { AccountShell } from "@/features/account/components/account-shell"; import { SecurityCenter } from "@/features/account/components/security-center";
export default function Page(){return <AccountShell title="Security" description="Manage two-factor authentication, passkeys, sessions and account lifecycle."><SecurityCenter /></AccountShell>}
