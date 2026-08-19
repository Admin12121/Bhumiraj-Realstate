import { AccountShell } from "../account/_components";
import { PostPropertyWizard } from "./_components";

export default function Page() {
  return (
    <AccountShell
      title="Post a property"
      description="Create a verified sale, rental or auction listing."
    >
      <PostPropertyWizard />
    </AccountShell>
  );
}