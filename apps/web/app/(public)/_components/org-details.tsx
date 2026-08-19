/**
 * Contact and company facts come from configuration. Anything left unset is
 * omitted rather than shown as a placeholder, so the page never states a
 * detail the business has not actually provided.
 */
const CONTACT = [
  { label: "Email", value: process.env.NEXT_PUBLIC_CONTACT_EMAIL },
  { label: "Phone", value: process.env.NEXT_PUBLIC_CONTACT_PHONE },
  { label: "Address", value: process.env.NEXT_PUBLIC_CONTACT_ADDRESS },
].flatMap((row) => (row.value ? [{ ...row, value: row.value }] : []));

const COMPANY = [
  {
    label: "Registered name",
    value: process.env.NEXT_PUBLIC_COMPANY_NAME,
  },
  {
    label: "Registration number",
    value: process.env.NEXT_PUBLIC_COMPANY_REGISTRATION,
  },
].flatMap((row) => (row.value ? [{ ...row, value: row.value }] : []));

function Details({
  rows,
  empty,
}: {
  rows: { label: string; value: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[15px] leading-6 text-[#8a8a8a]">{empty}</p>;
  }

  return (
    <dl className="grid gap-3 rounded-2xl bg-[#f7f7f6] p-5 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-[13px] text-[#737373]">{row.label}</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-[#202020]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ContactDetails() {
  return (
    <Details
      rows={CONTACT}
      empty="Direct contact details have not been published yet. The chat reaches the team fastest."
    />
  );
}

export function CompanyDetails() {
  return (
    <Details
      rows={COMPANY}
      empty="Company registration details have not been published yet."
    />
  );
}
