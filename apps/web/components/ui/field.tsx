"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import type React from "react";
import { cn } from "@/lib/utils";

/** Stacks a form's fields. Plain layout, so it may wrap anything. */
export function FieldGroup({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-5 *:data-[slot=field-group]:gap-4",
        className,
      )}
      data-slot="field-group"
      {...props}
    />
  );
}

/** Rule with centred label, used between alternative sign-in methods. */
export function FieldSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("relative -my-2 h-5 text-sm", className)}
      data-slot="field-separator"
      data-content={children ? "true" : "false"}
      {...props}
    >
      <div className="absolute inset-0 top-1/2 h-px bg-border" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

/**
 * Field-styled prose that does not need a Field root, for the footnotes that
 * sit beside a form rather than inside one.
 */
export function FieldNote({
  className,
  ...props
}: React.ComponentProps<"p">): React.ReactElement {
  return (
    <p
      className={cn(
        "text-left text-sm leading-normal font-normal text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 hover:[&>a]:text-primary",
        className,
      )}
      data-slot="field-description"
      {...props}
    />
  );
}

export function Field({
  className,
  ...props
}: FieldPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldPrimitive.Root
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="field"
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props): React.ReactElement {
  return (
    <FieldPrimitive.Label
      className={cn(
        "inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground data-disabled:opacity-64 sm:text-sm/4",
        className,
      )}
      data-slot="field-label"
      {...props}
    />
  );
}

export function FieldItem({
  className,
  ...props
}: FieldPrimitive.Item.Props): React.ReactElement {
  return (
    <FieldPrimitive.Item
      className={cn("flex", className)}
      data-slot="field-item"
      {...props}
    />
  );
}

export function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props): React.ReactElement {
  return (
    <FieldPrimitive.Description
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

export function FieldError({
  className,
  ...props
}: FieldPrimitive.Error.Props): React.ReactElement {
  return (
    <FieldPrimitive.Error
      className={cn("text-destructive-foreground text-xs", className)}
      data-slot="field-error"
      {...props}
    />
  );
}

export const FieldControl: typeof FieldPrimitive.Control =
  FieldPrimitive.Control;
export const FieldValidity: typeof FieldPrimitive.Validity =
  FieldPrimitive.Validity;

export { FieldPrimitive };
