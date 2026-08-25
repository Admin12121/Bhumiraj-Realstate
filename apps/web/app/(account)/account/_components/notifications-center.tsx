"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notifications-api";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Everything the account has been told about, newest first. */
export function NotificationsCenter() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => getNotifications(false, 50),
    refetchInterval: 60_000,
  });

  useRealtimeEvents(() => {
    void client.invalidateQueries({ queryKey: ["notifications"] });
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });

  const items = query.data?.items ?? [];
  const unread = items.filter((item) => item.readAt === null).length;

  if (query.isPending) {
    return (
      <div className="grid gap-2">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton className="h-20 w-full rounded-xl" key={key} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Bell />
          </EmptyMedia>
          <EmptyTitle>Nothing yet</EmptyTitle>
          <EmptyDescription>
            Sign-ins, listing updates and messages will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[680px] gap-3">
      {unread > 0 ? (
        <div className="flex justify-end">
          <Button
            loading={readAll.isPending}
            onClick={() => readAll.mutate()}
            size="sm"
            variant="outline"
          >
            <CheckCheck />
            Mark all read
          </Button>
        </div>
      ) : null}

      <Frame>
        {items.map((item) => (
          <FramePanel
            className={cn(
              "cursor-pointer transition-colors",
              item.readAt === null && "bg-accent/40",
            )}
            key={item.id}
            onClick={() => item.readAt === null && readOne.mutate(item.id)}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.readAt === null ? "bg-primary" : "bg-transparent",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="mt-0.5 text-muted-foreground text-sm">
                  {item.body}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </FramePanel>
        ))}
      </Frame>
    </div>
  );
}
