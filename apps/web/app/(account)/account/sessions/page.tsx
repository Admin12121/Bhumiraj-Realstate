import { redirect } from "next/navigation";

/** Merged into the single settings screen; kept so existing links still work. */
export default function Page() {
  redirect("/account/settings?tab=sessions");
}
