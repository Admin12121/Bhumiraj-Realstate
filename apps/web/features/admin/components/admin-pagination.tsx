import { ChevronLeft, ChevronRight } from "lucide-react";

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
      <span className="text-xs text-slate-500">
        Page {page} of {safePageCount}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border p-2 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= safePageCount}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border p-2 disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
