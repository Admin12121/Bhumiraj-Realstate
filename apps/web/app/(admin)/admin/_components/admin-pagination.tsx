"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminPagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const safePageCount = Math.max(pageCount, 1);
  return (
    <div className="flex items-center justify-between border-t p-4">
      <span className="text-xs text-muted-foreground">Page {page} of {safePageCount}</span>
      <div className="flex gap-2">
        <Button size="icon" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft /></Button>
        <Button size="icon" variant="outline" aria-label="Next page" disabled={page >= safePageCount} onClick={() => onPage(page + 1)}><ChevronRight /></Button>
      </div>
    </div>
  );
}
