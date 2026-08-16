import { SearchResults } from "./_components/search-results";

export const metadata = { title: "Search properties" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    district?: string;
    propertyType?: string;
    sort?: string;
  }>;
}) {
  // Read on the server so the page needs no client search-param hook.
  const criteria = await searchParams;
  return <SearchResults criteria={criteria} />;
}
