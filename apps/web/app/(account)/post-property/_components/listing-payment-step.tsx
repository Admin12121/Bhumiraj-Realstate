"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2, QrCode, UploadCloud, Wallet } from "lucide-react";
import type { PaymentMethod } from "@real-estate/contracts";
import {
  getListingFee,
  submitPaymentProof,
} from "@/features/listings/api/listing-payments-api";
import { uploadMedia, waitForMediaReady } from "@/features/media/api/media-api";
import { formatMinorAmount } from "@/shared/utilities/money";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Fieldset,
  FieldsetDescription,
  FieldsetLegend,
} from "@/components/ui/fieldset";
import { RadioGroup, Radio } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUploader } from "@/components/ui/file-uploader";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/shared/http/error-message";

const KIND_ICON = {
  QR: QrCode,
  BANK_TRANSFER: Building2,
  WALLET: Wallet,
} as const;

const MAX_PROOF_BYTES = 50 * 1024 * 1024;

/** The account details for the chosen method, as a table rather than loose text. */
function MethodDetails({ method }: { method: PaymentMethod }) {
  const rows = [
    ["Account name", method.accountName],
    ["Account number", method.accountNumber],
    ["Bank", method.bankName],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0 && !method.imageUrl && !method.instructions) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/40 p-4 sm:grid-cols-[auto_1fr] sm:items-start">
      {method.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={method.imageUrl}
          alt={`${method.label} payment code`}
          className="size-40 rounded-lg border bg-background object-contain p-2"
        />
      ) : null}
      <div className="min-w-0 space-y-3">
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-md border bg-background">
            <Table>
              <TableBody className="text-[13px]">
                {rows.map(([label, value]) => (
                  <TableRow key={label}>
                    <TableHead className="h-9 w-40 py-2 font-normal text-muted-foreground">
                      {label}
                    </TableHead>
                    <TableCell className="py-2 font-medium tabular-nums">
                      {value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {method.instructions ? (
          <p className="text-muted-foreground text-xs">{method.instructions}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shows the fee and the ways to settle it, then takes a screenshot of the
 * transfer. Verification is manual, so no money moves through the app here.
 */
export function ListingPaymentStep({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  const [
    { files, isDragging, errors },
    {
      clearFiles,
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
    },
  ] = useFileUpload({
    accept: "image/*",
    maxFiles: 1,
    maxSize: MAX_PROOF_BYTES,
    multiple: false,
  });

  const fee = useQuery({
    queryKey: ["listing-fee"],
    queryFn: ({ signal }) => getListingFee(signal),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const proof = files[0]?.file;
      if (!methodId) throw new Error("Choose how you paid.");
      if (!proof) throw new Error("Attach a screenshot of the payment.");
      if (!fee.data) throw new Error("The listing fee could not be loaded.");

      const assetId = await uploadMedia(proof, "PAYMENT_PROOF");
      await waitForMediaReady(assetId);

      return submitPaymentProof({
        listingId,
        mediaAssetId: assetId,
        method: methodId,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        amountMinor: fee.data.amountMinor,
        currency: fee.data.currency,
      });
    },
    onSuccess: () => {
      toast.success("Payment submitted. We will verify it shortly.");
      router.push("/account");
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (fee.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (fee.isError || !fee.data) {
    return (
      <Alert variant="error">
        <AlertTitle>Payment details unavailable</AlertTitle>
        <AlertDescription>
          The listing fee could not be loaded. Try again shortly.
        </AlertDescription>
      </Alert>
    );
  }

  if (!fee.data.enabled) {
    return (
      <Alert>
        <AlertTitle>No listing fee</AlertTitle>
        <AlertDescription>
          Nothing is charged right now — your property is already queued for
          review.
        </AlertDescription>
      </Alert>
    );
  }

  const methods = fee.data.methods.filter((method) => method.enabled);
  const selected = methods.find((method) => method.id === methodId) ?? null;

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <div className="rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">Listing fee</p>
        <p className="mt-1 font-semibold text-3xl tabular-nums">
          {formatMinorAmount(fee.data.amountMinor, fee.data.currency)}
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          Pay with any method below, then upload the screenshot. A moderator
          verifies it before your property is assigned an agent.
        </p>
      </div>

      {methods.length === 0 ? (
        <Alert>
          <AlertTitle>No payment methods configured</AlertTitle>
          <AlertDescription>
            Nobody has set up a way to pay yet. Please contact support.
          </AlertDescription>
        </Alert>
      ) : (
        <Fieldset>
          <FieldsetLegend>Payment method</FieldsetLegend>
          <FieldsetDescription>
            Pick the account you paid into so we can match the transfer.
          </FieldsetDescription>
          <FieldGroup>
            <RadioGroup
              className="grid gap-3 sm:grid-cols-2"
              value={methodId}
              onValueChange={(value) => setMethodId(String(value ?? ""))}
            >
              {methods.map((method) => {
                const Icon = KIND_ICON[method.kind];
                return (
                  <Field key={method.id}>
                    {/* The label is the real <label> and wraps the control, so
                        the whole card is the hit area without nesting labels. */}
                    <FieldLabel className="w-full cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal transition-colors has-data-checked:border-primary has-data-checked:bg-accent/50">
                      <Radio value={method.id} className="mt-0.5" />
                      <Icon
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{method.label}</span>
                        {method.bankName ? (
                          <span className="block text-muted-foreground text-xs">
                            {method.bankName}
                          </span>
                        ) : null}
                      </span>
                    </FieldLabel>
                  </Field>
                );
              })}
            </RadioGroup>

            {selected ? <MethodDetails method={selected} /> : null}
          </FieldGroup>
        </Fieldset>
      )}

      <Fieldset>
        <FieldsetLegend>Proof of payment</FieldsetLegend>
        <FieldsetDescription>
          A screenshot of the receipt from your banking or wallet app.
        </FieldsetDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="payment-reference">
              Transaction reference
            </FieldLabel>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={120}
              placeholder="The transaction ID from your banking app"
            />
            <FieldDescription>
              Optional, but it makes verification much faster.
            </FieldDescription>
          </Field>

          <FileUploader
            title="Upload the payment screenshot"
            files={files}
            isDragging={isDragging}
            errors={errors}
            inputProps={getInputProps()}
            maxFiles={1}
            maxSize={MAX_PROOF_BYTES}
            onOpen={openFileDialog}
            onRemove={removeFile}
            onClear={clearFiles}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        </FieldGroup>
      </Fieldset>

      <Button
        type="submit"
        disabled={submit.isPending || methods.length === 0}
        className="gap-2"
      >
        {submit.isPending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <UploadCloud aria-hidden className="size-4" />
        )}
        {submit.isPending ? "Submitting payment…" : "Submit payment"}
      </Button>
    </form>
  );
}
