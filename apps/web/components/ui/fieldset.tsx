"use client";

import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import type React from "react";
import { cn } from "@/lib/utils";

export function Fieldset({
  className,
  ...props
}: FieldsetPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Root
      className={className}
      data-slot="fieldset"
      {...props}
    />
  );
}
export function FieldsetLegend({
  className,
  ...props
}: FieldsetPrimitive.Legend.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Legend
      className={cn("font-semibold text-foreground", className)}
      data-slot="fieldset-legend"
      {...props}
    />
  );
}

/**
 * Explanatory text under a legend.
 *
 * `FieldDescription` is a Base UI Field part and throws outside a Field root,
 * so a fieldset-level description needs its own element.
 */
export function FieldsetDescription({
  className,
  ...props
}: React.ComponentProps<"p">): React.ReactElement {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="fieldset-description"
      {...props}
    />
  );
}

export { FieldsetPrimitive };
