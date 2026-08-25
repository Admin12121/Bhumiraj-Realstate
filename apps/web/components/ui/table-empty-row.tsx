"use client";

import type { ComponentType } from "react";

import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * The one empty state every table in the app uses. Tables had each grown their
 * own — a bare sentence here, a centred paragraph there — so the product read
 * as several products.
 */
export function TableEmptyRow({
  colSpan,
  when,
  icon: Icon,
  title,
  description,
  compact = false,
}: {
  colSpan: number;
  /** Render only when the table has no rows. */
  when: boolean;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** Less vertical room, for tables in a narrow side column. */
  compact?: boolean;
}) {
  if (!when) return null;

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <Empty className={compact ? "gap-2 py-8" : "py-14"}>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </Empty>
      </TableCell>
    </TableRow>
  );
}
