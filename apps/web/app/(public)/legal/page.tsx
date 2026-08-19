import type { Metadata } from "next";
import { CompanyDetails } from "../_components/org-details";
import Link from "next/link";
import { PublicHeader, SiteFooter } from "@/app/_components";
import { PageShell, Section } from "../_components/page-shell";

export const metadata: Metadata = {
  title: "Legal",
  description: "Legal information and policies for Bhumiraj Estates.",
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <PageShell title="Legal"
      lead="Policies covering how the marketplace operates.">
        <Section heading="Policies">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <Link href="/legal/terms" className="underline underline-offset-4">
                Terms of Service
              </Link>{" "}
              &mdash; the rules for using the marketplace.
            </li>
            <li>
              <Link
                href="/legal/privacy"
                className="underline underline-offset-4"
              >
                Privacy Policy
              </Link>{" "}
              &mdash; what we collect and why.
            </li>
          </ul>
        </Section>

        <Section heading="Company">
          <CompanyDetails />
        </Section>
      </PageShell>
      <SiteFooter />
    </>
  );
}
