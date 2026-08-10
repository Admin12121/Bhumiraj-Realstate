import { Suspense } from "react"; import { AuthCard } from "@/features/auth/components/auth-card"; import { TwoFactorForm } from "@/features/auth/components/two-factor-form";
export default function Page(){return <AuthCard title="Two-factor verification" description="Enter the code from your authenticator app or a backup code."><Suspense><TwoFactorForm /></Suspense></AuthCard>}
