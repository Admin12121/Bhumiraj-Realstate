import type { Metadata } from "next";
import { ContactDetails } from "../_components/org-details";
import { PublicHeader, SiteFooter } from "@/app/_components";
import { PageShell, Section } from "../_components/page-shell";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the Bhumiraj Estates team.",
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <PageShell title="Contact"
      lead="Questions about a property, a listing or your account.">
        <Section heading="Chat with us">
          <p>
            The quickest route is the chat in the bottom corner of any page. A
            member of the team answers there, and the conversation is kept with
            your account once you sign in.
          </p>
        </Section>

        <Section heading="Direct details">
          <ContactDetails />
        </Section>

        <Section heading="About a specific property">
          <p>
            Use the <strong>Contact agent</strong> button on the property page.
            It reaches the appointed agent directly, which is faster than going
            through the general enquiry line.
          </p>
        </Section>
      </PageShell>
      <SiteFooter />
    </>
  );
}
