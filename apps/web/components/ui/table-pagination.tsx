"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 25;
const MAX_VISIBLE_PAGES = 3;

/** How many pages to pin at each end: the first three and the last three. */
const EDGE_PAGES = [0, 1, 2];

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number | undefined;
  pageSize?: number | undefined;
  className?: string;
};

/**
 * The run of pages around the current one.
 *
 * The first and last are added separately by the caller, with an ellipsis where
 * there is a gap — so a long list reads `1 2 3 … 32 33 34` rather than walking
 * a window from one end to the other. The two ends are the pages people reach
 * for: the beginning, and how far it goes.
 */
function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages: number[] = [];

  let start = Math.max(1, currentPage - Math.floor(MAX_VISIBLE_PAGES / 2));
  const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);

  if (end - start + 1 < MAX_VISIBLE_PAGES) {
    start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

/** Which page numbers to show, with `null` marking a gap. */
export function paginationPages(
  currentPage: number,
  totalPages: number,
): (number | null)[] {
  const shown = [
    ...new Set([
      ...EDGE_PAGES.map((offset) => 1 + offset),
      ...getVisiblePages(currentPage, totalPages),
      ...EDGE_PAGES.map((offset) => totalPages - offset),
    ]),
  ]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  return shown.flatMap((page, index) => {
    const previous = shown[index - 1];
    return index > 0 && previous !== undefined && page - previous > 1
      ? [null, page]
      : [page];
  });
}

function PageButton({
  active,
  disabled,
  children,
  onClick,
  className,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "default" : "secondary"}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn("min-w-9 px-2.5", className)}
    >
      {children}
    </Button>
  );
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  className,
}: TablePaginationProps) {
  const pageCount = Math.max(1, totalPages);
  const withGaps = paginationPages(currentPage, pageCount);
  const hasTotalItems = typeof totalItems === "number";
  const rangeStart =
    hasTotalItems && totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd =
    hasTotalItems && totalItems > 0
      ? Math.min(totalItems, currentPage * pageSize)
      : 0;

  return (
    <div
      className={cn(
        "flex flex-col justify-center gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="hidden text-sm text-muted-foreground tabular-nums sm:block">
        {hasTotalItems
          ? totalItems > 0
            ? `Showing ${rangeStart}-${rangeEnd} of ${totalItems}`
            : "Showing 0 of 0"
          : `Page ${currentPage} of ${pageCount}`}
      </div>

      <nav
        aria-label="Pagination"
        className="flex flex-wrap items-center justify-center gap-1 md:justify-end"
      >
        {/* First and last, not "back two" and "forward two". A double chevron
            means the end of the list everywhere else, and reading it as a
            two-page jump is the kind of surprise that makes somebody click it
            twice to see what it does. */}
        <PageButton
          label="First page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          className="px-2"
        >
          <ChevronsLeft className="size-4" />
        </PageButton>
        <PageButton
          label="Previous page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="px-2"
        >
          <ChevronLeft className="size-4" />
        </PageButton>

        {withGaps.map((page, index) =>
          page === null ? (
            <span
              aria-hidden
              className="px-1 text-sm text-muted-foreground"
              key={`gap-${index}`}
            >
              …
            </span>
          ) : (
            <PageButton
              active={page === currentPage}
              key={page}
              label={`Page ${page}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </PageButton>
          ),
        )}

        <PageButton
          label="Next page"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          className="px-2"
        >
          <ChevronRight className="size-4" />
        </PageButton>
        <PageButton
          label="Last page"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(pageCount)}
          className="px-2"
        >
          <ChevronsRight className="size-4" />
        </PageButton>
      </nav>
    </div>
  );
}
