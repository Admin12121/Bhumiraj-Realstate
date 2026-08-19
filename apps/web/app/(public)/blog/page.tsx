import type { Metadata } from "next";
import { PublicHeader, SiteFooter } from "@/app/_components";
import { PageShell, Section } from "../_components/page-shell";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on the Nepal property market from Bhumiraj Estates.",
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <PageShell title="Blog"
      lead="Market notes and product updates.">
        <Section heading="Nothing published yet">
          <p>
            We have not published any articles. When we do, they will appear
            here and in the site&rsquo;s feed. Until then, the fastest way to
            hear from us is to ask the team directly through the chat.
          </p>
        </Section>
      </PageShell>
      <SiteFooter />
    </>
  );
}
