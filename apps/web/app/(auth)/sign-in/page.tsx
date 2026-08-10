import { Suspense } from "react"; import { AuthCard } from "@/features/auth/components/auth-card"; import { SignInForm } from "@/features/auth/components/sign-in-form";
export default function Page(){return <AuthCard title="Welcome back" description="Sign in to save properties, message agents and join live auctions."><Suspense><SignInForm /></Suspense></AuthCard>}
