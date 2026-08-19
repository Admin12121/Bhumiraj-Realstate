import type { Metadata } from "next";
import { PublicHeader, SiteFooter } from "@/app/_components";
import { PageShell, Section } from "../_components/page-shell";

export const metadata: Metadata = {
  title: "About",
  description: "Who Bhumiraj Estates is and how the marketplace works.",
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <PageShell title="About"
      lead="A Nepal property marketplace where every listing is checked before it is published.">
        <Section heading="What we do">
          <p>
            Bhumiraj Estates lists residential and commercial property across
            Nepal. Owners submit a property, our team verifies the ownership
            documents against land-registry records, and only then does the
            listing appear publicly.
          </p>
        </Section>

        <Section heading="One agent per property">
          <p>
            Every published property is represented by a single appointed
            agent. They handle the viewing, the negotiation and the transfer, so
            a buyer always knows who is accountable and an owner is never
            chasing several people at once.
          </p>
        </Section>

        <Section heading="What it costs">
          <p>
            Enquiring, saving a property and booking a viewing are free. Owners
            pay a listing fee, which is shown before payment and verified by our
            team before the property goes live.
          </p>
        </Section>
      </PageShell>
      <SiteFooter />
    </>
  );
}
