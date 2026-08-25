"use client";

import { PanelEmpty, PanelSurface } from "../../_components/panel-layout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import {
  getAdminMessages,
  } from "@/features/admin/api/admin-api";

export function AdminMessagesPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "messages", page],
    queryFn: () => getAdminMessages(page),
    placeholderData: (previous) => previous,
  });
  const items = query.data?.items ?? [];

  return (
    <PanelSurface
      page={query.data?.page ?? page}
      pageCount={query.data?.pageCount ?? 1}
      total={query.data?.total}
      pageSize={query.data?.pageSize}
      onPage={setPage}
    >
      {items.length === 0 ? (
        <PanelEmpty
          icon={MessagesSquare}
          title={
            query.isLoading ? "Loading conversations…" : "No conversations yet"
          }
          description={
            query.isError
              ? "Conversations could not be loaded."
              : "Conversations between buyers, sellers and agents appear here."
          }
        />
      ) : (
        <div className="divide-y">
          {items.map((conversation) => (
            <article key={conversation.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {conversation.participants
                    .map((participant) => participant.name)
                    .join(", ") || "Support conversation"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {conversation.messageCount} messages
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {conversation.lastMessage?.body ?? "No messages yet."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Updated {new Date(conversation.updatedAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </PanelSurface>
  );
}
