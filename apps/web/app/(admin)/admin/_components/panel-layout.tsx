"use client";

import type { ReactNode } from "react";

import { Frame } from "@/components/ui/frame";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search } from "lucide-react";

/**
 * The shape every admin panel takes: heading, then a toolbar, then the records
 * inside a frame, then the pager — each its own element rather than one banded
 * card. Panels were each inventing this, which is why no two looked alike.
 */
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

export function PanelHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** Primary actions for this panel, aligned to the end of the row. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
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

/** For record lists that are not tabular; keeps them on the same frame. */
export function PanelPanel({ children }: { children: ReactNode }) {
  return (
    <Frame>
      <div className="overflow-hidden rounded-xl border bg-background bg-clip-padding">
        {children}
      </div>
    </Frame>
  );
}

/** A spacer so a toolbar's selects sit at the end of the row. */
export function PanelToolbarSpacer() {
  return <div aria-hidden className="hidden lg:block" />;
}
