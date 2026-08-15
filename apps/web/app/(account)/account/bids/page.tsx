import { AccountShell, MyBids } from "../_components";

export default function Page() {
  return (
    <AccountShell
      title="My bids"
      description="Your immutable live-auction bid history."
    >
      <MyBids />
    </AccountShell>
  );
}