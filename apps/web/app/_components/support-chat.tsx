"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, MessageCircle, Send, X } from "lucide-react"
import { useSession } from "@real-estate/auth/client"
import {
  getSupportThread,
  sendSupportMessage,
} from "@/features/support/api/support-api"

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * General site enquiry widget. Answers questions about Bhumiraj itself — it is
 * not the agent conversation, which is per-property and lives in the account.
 */
export function SupportChat() {
  const pathname = usePathname()
  const session = useSession()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  const thread = useQuery({
    queryKey: ["support", "thread"],
    queryFn: ({ signal }) => getSupportThread(signal),
    // Only poll while the panel is open; a closed widget should cost nothing.
    refetchInterval: open ? 10_000 : false,
    enabled: open,
  })

  const send = useMutation({
    mutationFn: (body: string) => sendSupportMessage(body),
    onSuccess: async () => {
      setDraft("")
      await queryClient.invalidateQueries({ queryKey: ["support", "thread"] })
    },
  })

  const messages = thread.data?.thread?.messages ?? []
  const ttlMinutes = thread.data?.ttlMinutes ?? null

  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, open])

  // Staff already have the inbox, and the auth pages should stay uncluttered.
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/two-factor") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password")
  if (hidden) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask a question"
        className="fixed right-5 bottom-5 z-50 grid size-14 place-items-center rounded-full bg-emerald-700 text-white shadow-[0_8px_24px_rgba(0,0,0,.22)] transition-transform hover:scale-105"
      >
        <MessageCircle className="size-6" strokeWidth={1.9} />
      </button>
    )
  }

  return (
    <section
      aria-label="Support chat"
      className="fixed right-5 bottom-5 z-50 flex h-[min(560px,calc(100vh-3rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,.24)] [animation:chat-open_.24s_ease-out]"
    >
      <header className="flex items-start justify-between gap-3 bg-emerald-800 px-4 py-3.5 text-white">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Ask Bhumiraj</p>
          <p className="mt-0.5 text-[12px] text-white/75">
            Questions about buying, selling or listing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/15"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {thread.isPending ? (
          <p className="text-[13px] text-slate-500">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-[13px] leading-6 text-slate-600">
            Hello. Ask us anything about listing a property, fees or how
            Bhumiraj works and a member of our team will reply here.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const mine = message.authorRole === "VISITOR"
              return (
                <li
                  key={message.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <span
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-6 ${
                      mine
                        ? "bg-emerald-700 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {message.body}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400">
                    {mine ? "You" : (message.authorName ?? "Bhumiraj")} ·{" "}
                    {timeOf(message.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {ttlMinutes && !session.data ? (
        <p className="border-t bg-amber-50 px-4 py-2 text-[11px] leading-4 text-amber-900">
          This conversation is deleted {ttlMinutes} minutes after it goes quiet.{" "}
          <a href="/sign-up" className="font-semibold underline">
            Create an account
          </a>{" "}
          to keep it.
        </p>
      ) : null}

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          const body = draft.trim()
          if (body) send.mutate(body)
        }}
      >
        <label className="sr-only" htmlFor="support-message">
          Your message
        </label>
        <textarea
          id="support-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              const body = draft.trim()
              if (body) send.mutate(body)
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Type your question…"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border px-3 py-2 text-[14px] outline-none focus:border-emerald-700"
        />
        <button
          type="submit"
          disabled={send.isPending || !draft.trim()}
          aria-label="Send message"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:opacity-40"
        >
          {send.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
    </section>
  )
}
