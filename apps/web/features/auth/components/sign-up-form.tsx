"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { signUp } from "@real-estate/auth/client";
import { toast } from "sonner";
export function SignUpForm() {
 const router=useRouter();const[pending,setPending]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);if(f.get("password")!==f.get("confirm"))return toast.error("Passwords do not match");setPending(true);const result=await signUp.email({name:String(f.get("name")),email:String(f.get("email")),password:String(f.get("password")),callbackURL:"/"});setPending(false);if(result.error)return toast.error(result.error.message||"Registration failed");toast.success("Account created. Check your email to verify it.");router.push("/sign-in");}
 return <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Full name<input name="name" required minLength={2} className="mt-1.5 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600" /></label><label className="block text-sm font-medium">Email<input name="email" type="email" required className="mt-1.5 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600" /></label><label className="block text-sm font-medium">Password<input name="password" type="password" required minLength={10} className="mt-1.5 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600" /><span className="mt-1 block text-[11px] font-normal text-slate-500">Use at least 10 characters.</span></label><label className="block text-sm font-medium">Confirm password<input name="confirm" type="password" required minLength={10} className="mt-1.5 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600" /></label><label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" required className="mt-1" />I agree to the Terms of Service and Privacy Policy.</label><button disabled={pending} className="brand-button flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold">{pending&&<Loader2 className="size-4 animate-spin" />}Create account</button><p className="text-center text-sm text-slate-500">Already registered? <Link href="/sign-in" className="font-semibold text-emerald-700">Sign in</Link></p></form>;
}
