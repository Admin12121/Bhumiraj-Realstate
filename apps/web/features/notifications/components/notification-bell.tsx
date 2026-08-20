"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notifications-api";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";

/**
 * Unread notifications, reachable from every workspace.
 *
 * Alerts were only visible by navigating to a page, so anything that happened
 * while you were working went unseen until you went looking for it.
 */
export function NotificationBell({ inverse = false }: { inverse?: boolean }) {
  const client = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => getNotifications(false, 12),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = notifications.data?.items ?? [];
  const unread = items.filter((item) => item.readAt === null);

  const refresh = () =>
    client.invalidateQueries({ queryKey: ["notifications"] });

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh,
  });

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            aria-label={
              unread.length
                ? `Notifications, ${unread.length} unread`
                : "Notifications"
            }
            size="icon"
            variant="ghost"
            className={cn(
              "relative",
              inverse && "text-white hover:bg-white/10",
            )}
          />
        }
      >
        <Bell />
        {unread.length > 0 ? (
          <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular-nums">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        ) : null}
      </MenuTrigger>

      <MenuPopup align="end" sideOffset={6} className="w-[22rem] max-w-[90vw]">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => readAll.mutate()}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <MenuSeparator />

        <MenuGroup>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {notifications.isPending
                ? "Loading…"
                : "Nothing to catch up on."}
            </p>
          ) : (
            items.slice(0, 8).map((item) => (
              <MenuItem
                key={item.id}
                closeOnClick={false}
                onClick={() => {
                  if (item.readAt === null) readOne.mutate(item.id);
                }}
                className="items-start gap-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    item.readAt === null ? "bg-primary" : "bg-transparent",
                  )}
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {item.body}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </span>
              </MenuItem>
            ))
          )}
        </MenuGroup>

        <MenuSeparator />

        <MenuItem render={<Link href="/account/alerts" />}>
          View all alerts
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
