import type { ReactNode } from "react";
import { BrandLogo } from "@/shared/components/brand-logo";
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#edf8f1,transparent_45%)] px-4 py-10"><section className="surface w-full max-w-md rounded-[28px] p-7 sm:p-9"><BrandLogo className="mb-8 justify-center" /><h1 className="text-center text-2xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-center text-sm leading-6 text-slate-500">{description}</p><div className="mt-7">{children}</div></section></main>;
}
