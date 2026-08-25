"use client";

import { ListingPostFeed } from "@/app/(public)/_components/agent-listing-feed";

/** The same post column as the home feed, filtered to what the viewer saved. */
export function SavedProperties() {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      <ListingPostFeed
        emptyMessage="Tap the heart on any property to keep it here."
        filters={{ savedOnly: true }}
      />
    </div>
  );
}
