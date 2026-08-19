"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Clock, Loader2, Send } from "lucide-react"
import {
  closeSupportThread,
  getSupportThreadDetail,
  getSupportThreads,
  replyToSupportThread,
} from "@/features/support/api/support-api"
import { Frame } from "@/components/ui/frame"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { useHasStaffPermission } from "./admin-shell"

const STATUSES = ["OPEN", "ASSIGNED", "CLOSED"] as const

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "Expiring now"
  return `Guest · erases in ${Math.max(1, Math.round(ms / 60000))}m`
}

/** Staff inbox for general site enquiries. */
export function SupportInbox() {
  const canReply = useHasStaffPermission("admin.support.reply")
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("OPEN")
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const threads = useQuery({
    queryKey: ["admin", "support", status],
    queryFn: ({ signal }) => getSupportThreads({ status, limit: 25 }, signal),
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  })

  const detail = useQuery({
    queryKey: ["admin", "support", "thread", selected],
    queryFn: ({ signal }) => getSupportThreadDetail(selected!, signal),
    enabled: selected !== null,
    refetchInterval: 10_000,
  })

  const reply = useMutation({
    mutationFn: (body: string) => replyToSupportThread(selected!, body),
    onSuccess: async () => {
      setDraft("")
      await queryClient.invalidateQueries({ queryKey: ["admin", "support"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const close = useMutation({
    mutationFn: () => closeSupportThread(selected!),
    onSuccess: async () => {
      toast.success("Conversation closed.")
      setSelected(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "support"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const items = threads.data?.items ?? []

  return (
    <div className="grid gap-4">
      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as (typeof STATUSES)[number])
          setSelected(null)
        }}
      >
        <TabsList>
          {STATUSES.map((option) => (
            <TabsTab key={option} value={option}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      <Frame>
        <div className="grid overflow-hidden rounded-xl border bg-background bg-clip-padding lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b lg:border-r lg:border-b-0">
          {threads.isPending ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              No {status.toLowerCase()} conversations.
            </p>
          ) : (
            <ul className="max-h-[560px] divide-y overflow-y-auto">
              {items.map((item) => {
                const expiry = expiryLabel(item.expiresAt)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                        selected === item.id ? "bg-emerald-50/60" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {item.visitorName}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {item.messageCount} msg
                        </span>
                      </div>
                      {item.lastMessagePreview ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {item.lastMessagePreview}
                        </p>
                      ) : null}
                      {expiry ? (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <Clock className="size-3" />
                          {expiry}
                        </p>
                      ) : item.assignedToName ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {item.assignedToName}
                        </p>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex min-h-[360px] flex-col">
          {!selected ? (
            <p className="grid flex-1 place-items-center p-6 text-sm text-slate-500">
              Select a conversation.
            </p>
          ) : detail.isPending ? (
            <p className="p-6 text-sm text-slate-500">Loading conversation…</p>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {(detail.data?.messages ?? []).map((message) => {
                  const staff = message.authorRole === "STAFF"
                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col ${staff ? "items-end" : "items-start"}`}
                    >
                      <span
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                          staff
                            ? "bg-emerald-700 text-white"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {message.body}
                      </span>
                      <span className="mt-1 text-[11px] text-slate-400">
                        {staff ? (message.authorName ?? "Staff") : "Visitor"}
                      </span>
                    </div>
                  )
                })}
              </div>

              {canReply ? (
                <form
                  className="flex items-end gap-2 border-t p-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const body = draft.trim()
                    if (body) reply.mutate(body)
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={1}
                    maxLength={4000}
                    placeholder="Write a reply…"
                    aria-label="Reply"
                    className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-700"
                  />
                  <button
                    type="submit"
                    disabled={reply.isPending || !draft.trim()}
                    aria-label="Send reply"
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white disabled:opacity-40"
                  >
                    {reply.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => close.mutate()}
                    disabled={close.isPending}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    Close
                  </button>
                </form>
              ) : null}
            </>
          )}
          </div>
        </div>
      </Frame>
    </div>
  )
}
