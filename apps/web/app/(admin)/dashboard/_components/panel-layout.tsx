"use client";

import type { ReactNode } from "react";

import { Frame } from "@/components/ui/frame";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { FileSearch, Search } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TablePagination } from "@/components/ui/table-pagination";

export function PanelSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `grid gap-4 ${className}` : "grid gap-4"}>
      {children}
    </section>
  );
}


/**
 * The filter row. The reference lays it out on a grid with the search pinned to
 * a comfortable reading width and the selects pushed to the far end.
 */
export function PanelToolbar({
  children,
  className = "lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)]",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`grid gap-3 ${className}`}>{children}</div>;
}

export function PanelSearch({
  value,
  onValueChange,
  placeholder,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <InputGroup>
      <InputGroupInput
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        type="search"
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );
}

/** Records sit on the muted frame, matching the reference's card tables. */
export function PanelRecords({ children }: { children: ReactNode }) {
  return <Frame>{children}</Frame>;
}


/** A spacer so a toolbar's selects sit at the end of the row. */
export function PanelToolbarSpacer() {
  return <div aria-hidden className="hidden lg:block" />;
}

export function PanelSurface({
  children,
  toolbar,
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  page: number;
  pageCount: number;
  total?: number | undefined;
  pageSize?: number | undefined;
  onPage: (page: number) => void;
}) {
  return (
    <div className="grid gap-4">
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
        </div>
      ) : null}
      <Frame>
        <div className="rounded-xl border bg-background bg-clip-padding">
          {children}
        </div>
      </Frame>
      <TablePagination
        currentPage={page}
        totalPages={pageCount}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={onPage}
      />
    </div>
  );
}

export function PanelEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileSearch;
  title: string;
  description: string;
}) {
  return (
    <Empty className="py-14">
      <EmptyMedia variant="icon">
        <Icon />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </Empty>
  );
}

/**
 * Severity is derived from the action name, not stored. Anything that removes
 * access, moves ownership or bans an account is the set you scan for first;
 * state changes are the middle; creation and acceptance are routine.
 */

export { TableEmptyRow as PanelEmptyRow } from "@/components/ui/table-empty-row";
