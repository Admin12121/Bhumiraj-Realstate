import { AuthSplitLayout, SignInForm } from "../_components";
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
    <AuthSplitLayout
      title="Welcome back"
      description="Sign in to save properties, message agents and manage your listings."
    >
      <SignInForm callbackURL={safeReturnPath(callbackURL)} />
    </AuthSplitLayout>
  );
}
