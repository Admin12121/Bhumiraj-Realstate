"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Building2,
  Check,
  Loader2,
  QrCode,
  UploadCloud,
  Wallet,
} from "lucide-react"
import type { PaymentMethod } from "@real-estate/contracts"
import {
  getListingFee,
  submitPaymentProof,
} from "@/features/listings/api/listing-payments-api"
import { uploadMedia, waitForMediaReady } from "@/features/media/api/media-api"
import { formatMinorAmount } from "@/shared/utilities/money"

const KIND_ICON = {
  QR: QrCode,
  BANK_TRANSFER: Building2,
  WALLET: Wallet,
} as const

/**
 * Shows the fee and the ways to settle it, then takes a screenshot of the
 * transfer. Verification is manual, so no money moves through the app here.
 */
export function ListingPaymentStep({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [methodId, setMethodId] = useState<string | null>(null)
  const [reference, setReference] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const fee = useQuery({
    queryKey: ["listing-fee"],
    queryFn: ({ signal }) => getListingFee(signal),
  })

  const submit = useMutation({
    mutationFn: async () => {
      if (!methodId) throw new Error("Choose how you paid.")
      if (!file) throw new Error("Attach a screenshot of the payment.")
      if (!fee.data) throw new Error("The listing fee could not be loaded.")

      const assetId = await uploadMedia(file, "PAYMENT_PROOF")
      await waitForMediaReady(assetId)

      return submitPaymentProof({
        listingId,
        mediaAssetId: assetId,
        method: methodId,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        amountMinor: fee.data.amountMinor,
        currency: fee.data.currency,
      })
    },
    onSuccess: () => {
      toast.success("Payment submitted. We will verify it shortly.")
      router.push("/account/saved")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (fee.isPending) {
    return <p className="p-6 text-sm text-slate-500">Loading payment details…</p>
  }
  if (fee.isError || !fee.data) {
    return (
      <p className="p-6 text-sm text-red-600">
        The listing fee could not be loaded. Try again shortly.
      </p>
    )
  }

  const methods = fee.data.methods.filter((method) => method.enabled)
  const selected = methods.find((method) => method.id === methodId) ?? null

  if (!fee.data.enabled) {
    return (
      <div className="rounded-2xl border p-6 text-sm">
        No listing fee is currently charged. Your property is already queued for
        review.
      </div>
    )
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit.mutate()
      }}
    >
      <div className="rounded-2xl border p-6">
        <p className="text-sm text-slate-500">Listing fee</p>
        <p className="mt-1 text-3xl font-semibold text-emerald-900">
          {formatMinorAmount(fee.data.amountMinor, fee.data.currency)}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Pay using any method below, then upload the screenshot. A moderator
          verifies it before your property is assigned an agent.
        </p>
      </div>

      {methods.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          No payment methods are configured yet. Please contact support.
        </p>
      ) : (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">How did you pay?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map((method: PaymentMethod) => {
              const Icon = KIND_ICON[method.kind]
              const active = methodId === method.id
              return (
                <label
                  key={method.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                    active
                      ? "border-emerald-700 bg-emerald-50"
                      : "hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={method.id}
                    checked={active}
                    onChange={() => setMethodId(method.id)}
                    className="sr-only"
                  />
                  <Icon className="mt-0.5 size-5 shrink-0 text-emerald-800" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {method.label}
                    </span>
                    {method.bankName ? (
                      <span className="block text-xs text-slate-500">
                        {method.bankName}
                      </span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {selected ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          {selected.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.imageUrl}
              alt={`${selected.label} payment code`}
              className="mb-3 size-44 rounded-lg border bg-white object-contain p-2"
            />
          ) : null}
          {selected.accountName ? (
            <p>
              <span className="text-slate-500">Account name: </span>
              {selected.accountName}
            </p>
          ) : null}
          {selected.accountNumber ? (
            <p>
              <span className="text-slate-500">Account number: </span>
              <span className="font-medium tabular-nums">
                {selected.accountNumber}
              </span>
            </p>
          ) : null}
          {selected.instructions ? (
            <p className="mt-2 text-slate-600">{selected.instructions}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="reference" className="block text-sm font-semibold">
          Transaction reference{" "}
          <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          maxLength={120}
          placeholder="The transaction ID from your banking app"
          className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-emerald-700"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="proof" className="block text-sm font-semibold">
          Payment screenshot
        </label>
        <input
          id="proof"
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        />
        {file ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-800">
            <Check className="size-4" />
            {file.name}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submit.isPending}
        className="brand-button inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {submit.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UploadCloud className="size-4" />
        )}
        {submit.isPending ? "Submitting payment…" : "Submit payment"}
      </button>
    </form>
  )
}
