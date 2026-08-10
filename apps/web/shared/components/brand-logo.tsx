import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link href="/" className={cn("flex items-center gap-3", className)} aria-label="Bhumiraj Estates home">
    <Image src="/Bhumiraj Logo.png" alt="Bhumiraj Estates" width={compact ? 48 : 72} height={compact ? 48 : 72} className="rounded-2xl object-cover" priority />
    {!compact && <span className="font-serif text-[22px] leading-[1.05] tracking-wide text-[#07572f]">BHUMIRAJ<br />ESTATES</span>}
  </Link>;
}
