"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type React from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  className,
  ...props
}: AvatarPrimitive.Root.Props): React.ReactElement {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-background align-middle font-medium text-xs has-data-[slot=avatar-badge]:overflow-visible [&:not(:has([data-slot=avatar-badge]))]:overflow-hidden",
        className,
      )}
      data-slot="avatar"
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: AvatarPrimitive.Image.Props): React.ReactElement {
  return (
    <AvatarPrimitive.Image
      className={cn("size-full object-cover", className)}
      data-slot="avatar-image"
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props): React.ReactElement {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

/** A small status dot on the avatar's corner, e.g. an online indicator. */
export function AvatarBadge({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
        className,
      )}
      data-slot="avatar-badge"
      {...props}
    />
  );
}

/**
 * Overlapping avatars. Used to show, at a glance, which staff currently have a
 * conversation open.
 */
export function AvatarGroup({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex items-center -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      data-slot="avatar-group"
      {...props}
    />
  );
}

/** The "+3" chip closing an AvatarGroup that had to be truncated. */
export function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "z-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs ring-2 ring-background",
        className,
      )}
      data-slot="avatar-group-count"
      {...props}
    />
  );
}

export { AvatarPrimitive };
