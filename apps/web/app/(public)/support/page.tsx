import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, SiteFooter } from "@/app/_components";
import { PageShell, Section } from "../_components/page-shell";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Bhumiraj Estates.",
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <PageShell title="Support"
      lead="Help with listing, buying, viewings and your account.">
        <Section heading="Listing a property">
          <p>
            Submit the property, pay the listing fee and upload the payment
            receipt. Our team verifies the payment, then offers the property to
            an agent. Once the agent accepts, it goes live and appears on their
            profile.
          </p>
        </Section>

        <Section heading="Booking a viewing">
          <p>
            Open a property and choose <strong>Book a viewing</strong>. The times
            offered are the agent&rsquo;s real availability. You will need an
            account, and the agent confirms or declines the request.
          </p>
        </Section>

        <Section heading="Account and security">
          <p>
            Manage sign-in, two-factor authentication and active sessions under
            your account. If you think your account has been accessed by someone
            else, change your password &mdash; that signs every other session
            out.
          </p>
        </Section>

        <Section heading="Still stuck?">
          <p>
            Use the chat in the corner of any page, or see{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact
            </Link>
            .
          </p>
        </Section>
      </PageShell>
      <SiteFooter />
    </>
  );
}
