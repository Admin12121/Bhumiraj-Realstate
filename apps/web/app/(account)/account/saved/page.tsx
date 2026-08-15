import { AccountShell, SavedProperties } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="Saved properties"
      description="Properties you bookmarked for later."
    >
      <SavedProperties />
    </AccountShell>
  );
}