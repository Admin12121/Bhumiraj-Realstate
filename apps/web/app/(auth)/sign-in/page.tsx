import { SignInForm } from "../_components";
import { safeReturnPath } from "@/shared/security/safe-return-path";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  // Resolved on the server so the form needs no client-side search-param hook,
  // and therefore no Suspense boundary that can strand the whole page.
  const { callbackURL } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <SignInForm callbackURL={safeReturnPath(callbackURL)} />
      </div>
    </main>
  );
}
