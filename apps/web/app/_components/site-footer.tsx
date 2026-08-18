"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, type FormEvent } from "react"
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  Image as ImageIcon,
  MessageCircle,
  Smile,
} from "lucide-react"

const columns = [
  { title: "Company", links: ["About", "Blog", "Contact", "Careers"] },
  { title: "Resources", links: ["Locations", "Legal", "Download App"] },
  { title: "Agents", links: ["List on Bhumiraj", "Agent tools", "Events"] },
  { title: "Partners", links: ["Ambassadors", "Property managers"] },
] as const

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 font-semibold tracking-[-0.04em] text-black">
      <Image
        src="/Logo.webp"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg object-contain"
      />
      {!compact && <span className="text-[20px] leading-none">BHUMIRAJ</span>}
    </div>
  )
}

function ConciergeChat({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState<string[]>([])

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = message.trim()
    if (!next) return
    setSent((items) => [...items, next])
    setMessage("")
  }

  if (!open) return null

  return (
    <section
      role="dialog"
      aria-label="Bhumiraj concierge chat"
      className="absolute right-0 bottom-[calc(100%+23px)] isolate flex h-[566px] animate-[chat-open_.22s_cubic-bezier(.215,.61,.355,1)] origin-bottom-right w-[335px] flex-col overflow-hidden rounded-[20px] border border-black/[.08] bg-white shadow-[0_4px_18px_rgba(0,0,0,.10)]"
    >
      {/* 118px soft-grey header with a centred identity stack. */}
      <header className="relative h-[118px] shrink-0 border-b border-[#eaeaea] bg-[#f7f7f7]">
        <button
          type="button"
          aria-label="Back"
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

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
        {sent.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="-translate-y-px text-[14px] leading-5 font-normal text-[#999999]">
              How can we help you?
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-end gap-2.5 px-4 py-4">
            {sent.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="ml-auto max-w-[82%] rounded-[16px] rounded-br-[5px] bg-[#202020] px-3.5 py-2.5 text-[14px] leading-5 text-white"
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 67px grey composer with a 42px rounded input. */}
      <form
        onSubmit={submit}
        className="h-[67px] shrink-0 border-t border-[#eaeaea] bg-[#f7f7f7] p-[12px]"
      >
        <div className="flex h-[42px] w-full items-center rounded-full border border-black/[.045] bg-white pr-[4px] pl-[15px] shadow-[0_1px_2px_rgba(0,0,0,.02)]">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Your message"
            aria-label="Your message"
            className="min-w-0 flex-1 bg-transparent text-[15px] leading-5 font-normal text-[#202020] outline-none placeholder:text-[#999999]"
          />
          <button
            type="button"
            aria-label="Add image"
            className="grid size-7 shrink-0 place-items-center text-[#b7b7b7]"
          >
            <ImageIcon className="size-[17px]" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Add emoji"
            className="grid size-7 shrink-0 place-items-center text-[#202020]"
          >
            <Smile className="size-[16px]" strokeWidth={1.6} />
          </button>
          <button
            type="submit"
            aria-label="Send message"
            className={`grid size-8 shrink-0 place-items-center rounded-full text-white transition-colors ${
              message.trim() ? "bg-[#202020]" : "bg-[#bfc1c2]"
            }`}
          >
            <ArrowUp className="size-[17px]" strokeWidth={1.5} />
          </button>
        </div>
      </form>
    </section>
  )
}

export function SiteFooter() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      <footer className="relative w-full bg-[#f7f7f7] text-[14px] leading-5 text-black">
        <div className="border-t border-black/[.05] py-8">
          <div className="mx-auto flex max-w-site flex-wrap items-center gap-x-8 gap-y-3 px-6 lg:px-8 2xl:px-12">
            <p className="w-full font-[550] text-[#202020] md:w-auto">
              Follow us @bhumiraj
            </p>
            {["X (Twitter)", "Instagram", "TikTok", "LinkedIn", "YouTube"].map(
              (label) => (
                <a
                  key={label}
                  href="#"
                  className="text-[#636363] underline-offset-4 hover:underline"
                >
                  {label}
                </a>
              ),
            )}
          </div>
        </div>

        <div className="border-t border-black/[.05] py-12">
          <div className="mx-auto grid min-h-[240px] max-w-site grid-cols-2 gap-x-4 gap-y-6 px-6 md:grid-cols-6 lg:grid-cols-12 lg:px-8 2xl:px-12">
            <div className="col-span-full mb-6 flex items-start lg:col-span-4 lg:mb-0">
              <Link href="/">
                <BrandMark />
              </Link>
            </div>
            {columns.map((column) => (
              <div
                key={column.title}
                className="col-span-1 md:col-span-3 lg:col-span-2"
              >
                <h3 className="pb-2.5 font-[550] text-[#202020]">
                  {column.title}
                </h3>
                <ul>
                  {column.links.map((label) => (
                    <li key={label} className="py-1.5">
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 text-[#636363] hover:text-[#202020] hover:underline hover:underline-offset-4"
                      >
                        {label}
                        {label === "Agent tools" && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] leading-none font-[550] tracking-wide uppercase text-[#202020]">
                            New
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-black/[.05]">
          <div className="mx-auto flex max-w-site flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8 text-[#636363] lg:px-8 2xl:px-12">
            <span>© {new Date().getFullYear()} Bhumiraj Estates.</span>
          </div>
        </div>
      </footer>

      <div className="group fixed right-8 bottom-4 z-[61]">
        <ConciergeChat open={chatOpen} onClose={() => setChatOpen(false)} />

        {!chatOpen && (
          <span className="pointer-events-none absolute top-1/2 right-[calc(100%+8px)] -translate-y-1/2 rounded-lg bg-[#202020] px-2.5 py-1.5 text-[12px] leading-4 font-medium whitespace-nowrap text-white opacity-0 shadow-[0_6px_6px_-3px_rgba(0,0,0,.04),0_2px_8px_rgba(0,0,0,.08)] transition-opacity group-hover:opacity-100">
            Chat with Concierge
          </span>
        )}

        <button
          id="concierge-chat"
          data-open={chatOpen ? "true" : "false"}
          type="button"
          aria-label={chatOpen ? "Close chat" : "Open chat"}
          aria-expanded={chatOpen}
          onClick={() => setChatOpen((value) => !value)}
          className="relative z-10 grid size-12 place-items-center rounded-full bg-[#f0f0f0] text-[#202020] transition-colors hover:bg-[#eaeaea]"
        >
          {chatOpen ? (
            <ChevronDown className="size-7" strokeWidth={1.5} />
          ) : (
            <MessageCircle className="size-5" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </>
  )
}

export { BrandMark }
