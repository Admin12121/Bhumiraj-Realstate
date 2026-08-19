"use client"

import { useRef, useState } from "react"
import { Image as ImageIcon, Loader2, SendHorizontal, Smile, X } from "lucide-react"
import { SUPPORT_ATTACHMENT_MAX_BYTES } from "@real-estate/contracts"
import { uploadMedia, waitForMediaReady } from "@/features/media/api/media-api"

/** A small curated set beats pulling a full emoji library into the bundle. */
const EMOJI = [
  "🙂", "😀", "😅", "🙏", "👍", "👋", "🎉", "❤️",
  "🏠", "🏡", "🏢", "🔑", "📍", "📅", "📷", "💬",
  "✅", "❌", "⚠️", "❓", "💰", "📝", "⭐", "🔥",
]

const ACCEPTED = "image/png,image/jpeg,image/webp,image/avif"

export function ChatComposer({
  onSend,
  sending,
  disabled,
  canAttach = true,
}: {
  onSend: (body: string, attachmentId?: string) => void
  sending: boolean
  disabled?: boolean
  /** Uploads need a session, so a guest is told rather than left to fail. */
  canAttach?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachment, setAttachment] = useState<{
    id: string
    name: string
    preview: string
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function pick(file: File) {
    setError(null)

    if (!canAttach) {
      setError("Sign in to send an image.")
      return
    }

    if (!file.type.startsWith("image/")) {
      setError("Images only.")
      return
    }
    if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
      setError("That image is over 10MB.")
      return
    }

    setUploading(true)
    try {
      // Goes through the same pipeline as listing photos: uploaded, virus
      // scanned by the worker, re-encoded, and only then marked READY.
      const assetId = await uploadMedia(file, "MESSAGE_ATTACHMENT")
      await waitForMediaReady(assetId)
      setAttachment({
        id: assetId,
        name: file.name,
        preview: URL.createObjectURL(file),
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That image could not be attached.",
      )
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    const body = draft.trim()
    if (!body && !attachment) return
    onSend(body || "(image)", attachment?.id)
    setDraft("")
    if (attachment) URL.revokeObjectURL(attachment.preview)
    setAttachment(null)
    setEmojiOpen(false)
  }

  const busy = sending || uploading

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="relative shrink-0 border-t border-[#eaeaea] bg-[#f7f7f7] p-[12px]"
    >
      {emojiOpen ? (
        <div className="absolute bottom-[calc(100%+6px)] right-3 z-10 grid w-[232px] grid-cols-8 gap-1 rounded-2xl border border-black/[.08] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,.14)]">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setDraft((value) => `${value}${emoji}`)
                inputRef.current?.focus()
              }}
              className="grid size-6 place-items-center rounded text-[16px] hover:bg-[#f1f1ef]"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      {attachment ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white p-1.5 pr-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.preview}
            alt=""
            className="size-9 rounded-lg object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-[12px] text-[#494949]">
            {attachment.name}
          </span>
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => {
              URL.revokeObjectURL(attachment.preview)
              setAttachment(null)
            }}
            className="grid size-6 place-items-center rounded-full text-[#8a8a8a] hover:bg-[#f1f1ef]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mb-2 px-1 text-[12px] text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex h-[42px] w-full items-center rounded-full border border-black/[.045] bg-white pr-[4px] pl-[15px] shadow-[0_1px_2px_rgba(0,0,0,.02)]">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Your message"
          aria-label="Your message"
          maxLength={4000}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-[15px] leading-5 font-normal text-[#202020] outline-none placeholder:text-[#999999]"
        />

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void pick(file)
          }}
        />
        <button
          type="button"
          aria-label={
            canAttach ? "Attach an image" : "Sign in to attach an image"
          }
          title={canAttach ? undefined : "Sign in to send an image"}
          disabled={busy || Boolean(attachment) || !canAttach}
          onClick={() => fileRef.current?.click()}
          className="grid size-7 shrink-0 place-items-center text-[#b7b7b7] transition-colors hover:text-[#8a8a8a] disabled:opacity-40"
        >
          {uploading ? (
            <Loader2 className="size-[17px] animate-spin" />
          ) : (
            <ImageIcon className="size-[17px]" strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          aria-label="Add emoji"
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen((value) => !value)}
          className="grid size-7 shrink-0 place-items-center text-[#202020]"
        >
          <Smile className="size-[16px]" strokeWidth={1.6} />
        </button>

        <button
          type="submit"
          aria-label="Send message"
          disabled={busy || (!draft.trim() && !attachment)}
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#202020] text-white transition-opacity disabled:opacity-35"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </form>
  )
}
