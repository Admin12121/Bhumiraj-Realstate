"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronLeft,
  Clock,
  MessageCircle,
} from "lucide-react"
import { useSession } from "@real-estate/auth/client"
import {
  getSupportThread,
  sendSupportMessage,
} from "@/features/support/api/support-api"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { ChatComposer } from "./chat-composer"

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Panel({ onClose }: { onClose: () => void }) {
  const session = useSession()
  const queryClient = useQueryClient()

  const thread = useQuery({
    queryKey: ["support", "thread"],
    queryFn: ({ signal }) => getSupportThread(signal),
    refetchInterval: 10_000,
  })

  const send = useMutation({
    mutationFn: (input: { body: string; attachmentId?: string | undefined }) =>
      sendSupportMessage(input.body, input.attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["support", "thread"] })
    },
  })

  const messages = thread.data?.thread?.messages ?? []
  const ttlMinutes = thread.data?.ttlMinutes ?? null

  return (
    <section
      role="dialog"
      aria-label="Bhumiraj concierge chat"
      className="absolute right-0 bottom-[calc(100%+23px)] isolate flex h-[566px] w-[335px] origin-bottom-right animate-[chat-open_.22s_cubic-bezier(.215,.61,.355,1)] flex-col overflow-hidden rounded-[20px] border border-black/[.08] bg-white shadow-[0_4px_18px_rgba(0,0,0,.10)]"
    >
      <header className="relative h-[118px] shrink-0 border-b border-[#eaeaea] bg-[#f7f7f7]">
        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          className="absolute top-[42px] left-[11px] grid size-8 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] transition-colors hover:bg-[#eaeaea]"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </button>

        <Image
          src="/Logo.webp"
          alt=""
          width={58}
          height={51}
          className="absolute top-[12px] left-1/2 h-[51px] w-[58px] -translate-x-1/2 object-contain"
        />

        <div className="absolute inset-x-12 top-[71px] text-center">
          <p className="text-[13px] leading-[17px] font-normal text-[#494949]">
            Bhumiraj Concierge
          </p>
          <p className="text-[13px] leading-[17px] font-medium text-[#111111]">
            Chat with us
          </p>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col bg-white">
        {thread.isPending ? (
          <p className="grid h-full place-items-center text-[14px] text-[#999]">
            Loading…
          </p>
        ) : messages.length === 0 ? (
          <p className="grid h-full place-items-center text-[14px] leading-5 text-[#999999]">
            How can we help you?
          </p>
        ) : (
          /* The scroller only follows the live edge when the reader is already
             there, so a reply arriving mid-read does not yank the view. */
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="flex flex-col gap-3 px-4 py-4">
                  <MessageGroup>
                    {messages.map((message) => {
                      const mine = message.authorRole === "VISITOR"
                      return (
                        <MessageScrollerItem key={message.id}>
                          <Message align={mine ? "end" : "start"}>
                            <MessageContent>
                              <Bubble
                                align={mine ? "end" : "start"}
                                variant={mine ? "default" : "muted"}
                              >
                                {message.attachmentUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={message.attachmentUrl}
                                    alt=""
                                    className="mb-1.5 max-h-[220px] w-full rounded-[10px] object-cover"
                                  />
                                ) : null}
                                <BubbleContent>{message.body}</BubbleContent>
                              </Bubble>
                              <MessageFooter className="text-[11px] text-[#9a9a9a]">
                                {mine
                                  ? "You"
                                  : (message.authorName ?? "Bhumiraj")}{" "}
                                · {timeOf(message.createdAt)}
                              </MessageFooter>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )
                    })}
                  </MessageGroup>

                  {ttlMinutes && !session.data ? (
                    <Marker variant="separator">
                      <MarkerIcon>
                        <Clock />
                      </MarkerIcon>
                      <MarkerContent>
                        Erased {ttlMinutes} minutes after this goes quiet
                      </MarkerContent>
                    </Marker>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </div>

      <ChatComposer
        onSend={(body, attachmentId) => send.mutate({ body, attachmentId })}
        sending={send.isPending}
        canAttach={Boolean(session.data)}
      />
    </section>
  )
}

/**
 * The site's single chat surface. Answers questions about Bhumiraj itself; the
 * per-property agent conversation is separate and lives in the account.
 */
export function SupportChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Staff already have the inbox, and the auth pages should stay uncluttered.
  const hidden =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/two-factor") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password")
  if (hidden) return null

  return (
    <div className="group fixed right-8 bottom-4 z-[61]">
      {open ? <Panel onClose={() => setOpen(false)} /> : null}

      {open ? null : (
        <span className="pointer-events-none absolute top-1/2 right-[calc(100%+8px)] -translate-y-1/2 rounded-lg bg-[#202020] px-2.5 py-1.5 text-[12px] leading-4 font-medium whitespace-nowrap text-white opacity-0 shadow-[0_6px_6px_-3px_rgba(0,0,0,.04),0_2px_8px_rgba(0,0,0,.08)] transition-opacity group-hover:opacity-100">
          Chat with Concierge
        </span>
      )}

      <button
        id="concierge-chat"
        type="button"
        data-open={open ? "true" : "false"}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        className="relative z-10 grid size-12 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] transition-colors hover:bg-[#eaeaea]"
      >
        {open ? (
          <ChevronDown className="size-7" strokeWidth={1.5} />
        ) : (
          <MessageCircle className="size-5" strokeWidth={1.8} />
        )}
      </button>
    </div>
  )
}
