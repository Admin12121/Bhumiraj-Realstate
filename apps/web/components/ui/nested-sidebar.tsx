"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import { ArrowLeft, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COLLAPSED_WIDTH = "3.25rem";

/**
 * The rail that lists the records inside an editor page — staff roles today,
 * anything record-shaped later.
 *
 * It exists as one component rather than a copy per page because "consistent"
 * has to be structural: otherwise every panel grows its own header layout and
 * re-implements the collapse behaviour. Panels supply their items; everything
 * around them is fixed here.
 *
 * Collapse state is local on purpose. This rail and the admin sidebar are
 * independent — collapsing one must never move the other — so it deliberately
 * does not read or write the shared sidebar cookie, and leaves Cmd+B alone.
 */
export function NestedSidebar({
  actions,
  children,
  fullHeight = false,
  header,
  items,
  onBack,
  backLabel,
  width = "18rem",
}: {
  /** Buttons for the right end of the rail header. Hidden when collapsed — no room. */
  actions?: ReactNode;
  /** The detail pane. */
  children: ReactNode;
  /**
   * Fills the area under the app header instead of sitting in the page flow.
   * Use with `AdminShell bleed` / `AccountShell bleed`, which drop the padding.
   */
  fullHeight?: boolean;
  /** The detail pane's header row. Put the toggle it is handed at the start. */
  header: (toggle: ReactNode) => ReactNode;
  /** The rail's items. `open` is false in icon-only mode, where labels hide. */
  items: (open: boolean) => ReactNode;
  onBack?: () => void;
  backLabel?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(true);

  const toggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={open ? "Collapse list" : "Expand list"}
            className="size-7"
            onClick={() => setOpen((current) => !current)}
            size="icon"
            variant="secondary"
          >
            <PanelLeft />
          </Button>
        }
      />
      <TooltipPopup>{open ? "Collapse list" : "Expand list"}</TooltipPopup>
    </Tooltip>
  );

  return (
    // The width is applied to `Sidebar` directly, so feeding `open` to the
    // provider looks redundant — it is not. `SidebarMenuButton` only shows its
    // tooltip while the provider reports `collapsed`, and those tooltips are the
    // only labels an icon-only rail has.
    <SidebarProvider
      defaultOpen
      keyboardShortcut={false}
      onOpenChange={setOpen}
      open={open}
      persistOpen={false}
      unstyled
      className={cn(
        "flex overflow-hidden bg-background",
        fullHeight
          ? "h-[calc(100dvh-var(--header-height))] border-t"
          : "min-h-[24rem] rounded-xl border bg-clip-padding",
      )}
      style={
        {
          "--sidebar-width": open ? `min(100%, ${width})` : COLLAPSED_WIDTH,
          "--sidebar-width-icon": COLLAPSED_WIDTH,
        } as CSSProperties
      }
    >
      <Sidebar
        className="min-w-0 shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-linear"
        collapsible="none"
        style={{ width: open ? width : COLLAPSED_WIDTH }}
        variant="sidebar"
      >
        {/* Leaving and adding are opposite intents, so they sit at opposite ends
            rather than in one undifferentiated row of icons. Collapsed there is
            only room for back, which centres in the narrow rail. */}
        <SidebarHeader
          className={cn(
            "h-12 shrink-0 flex-row items-center border-b",
            open ? "justify-between p-3" : "justify-center p-1",
          )}
        >
          {onBack ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={backLabel ?? "Back"}
                    className="size-7"
                    onClick={onBack}
                    size="icon"
                    variant="ghost"
                  >
                    <ArrowLeft />
                  </Button>
                }
              />
              <TooltipPopup>{backLabel ?? "Back"}</TooltipPopup>
            </Tooltip>
          ) : null}
          {open ? actions : null}
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{items(open)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        {/* The toggle lives outside the rail, at the start of the detail header,
            so it stays in one place whether the rail is open or collapsed —
            a control that moves when used is a control you have to hunt for. */}
        {header(toggle)}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * A button for the rail header.
 *
 * Exists so panels declare *what* the action is and not how it looks — size,
 * variant and tooltip are the parts that have to match across panels.
 */
export function NestedSidebarAction({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "ghost" | "secondary";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="size-7"
            onClick={onClick}
            size="icon"
            variant={variant}
          >
            {icon}
          </Button>
        }
      />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * One record in the rail.
 *
 * In icon-only mode the label is dropped and the icon centred, with the label
 * moving to a tooltip — otherwise a collapsed rail is a column of anonymous
 * squares.
 */
export function NestedSidebarItem({
  children,
  icon,
  isActive,
  label,
  onClick,
  open,
  trailing,
}: {
  /** Rendered instead of `label` when a panel needs richer markup. */
  children?: ReactNode;
  icon: ReactNode;
  isActive?: boolean;
  label: string;
  onClick?: () => void;
  open: boolean;
  /** Status marker at the end of the row; hidden when collapsed. */
  trailing?: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={cn(!open && "justify-center")}
        isActive={isActive ?? false}
        {...(onClick ? { onClick } : {})}
        tooltip={label}
      >
        {icon}
        {open ? (
          <>
            {children ?? (
              <span className="min-w-0 flex-1 truncate">{label}</span>
            )}
            {trailing}
          </>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
