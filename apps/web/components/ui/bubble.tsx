import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const bubbleVariants = cva(
  "relative w-fit max-w-[85%] min-w-0 break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        muted: "bg-muted text-foreground",
        outline: "border bg-background text-foreground",
      },
      align: {
        start: "me-auto rounded-bl-sm",
        end: "ms-auto rounded-br-sm",
      },
    },
    defaultVariants: { variant: "default", align: "start" },
  }
)

/**
 * One message bubble. Grouped bubbles square off the edge they share so a run
 * of messages from the same author reads as a single block.
 */
function Bubble({
  className,
  variant,
  align,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return (
    <div
      data-slot="bubble"
      data-align={align ?? "start"}
      className={cn(
        bubbleVariants({ variant, align }),
        "in-data-[slot=bubble-group]:not-last:rounded-b-2xl",
        className
      )}
      {...props}
    />
  )
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn("whitespace-pre-wrap", className)}
      {...props}
    />
  )
}

/** Consecutive bubbles from one author, tightened up into a run. */
function BubbleGroup({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="bubble-group"
      data-align={align}
      className={cn(
        "flex min-w-0 flex-col gap-1 data-[align=end]:items-end",
        className
      )}
      {...props}
    />
  )
}

function BubbleReactions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-reactions"
      className={cn(
        "mt-1.5 -mb-0.5 flex flex-wrap items-center gap-1 text-xs leading-none",
        className
      )}
      {...props}
    />
  )
}

export { Bubble, BubbleContent, BubbleGroup, BubbleReactions, bubbleVariants }
