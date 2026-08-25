"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, QrCode, Wallet } from "lucide-react";
import type { PaymentMethod } from "@real-estate/contracts";
import { getListingFee } from "@/features/listings/api/listing-payments-api";
import { formatMinorAmount } from "@/shared/utilities/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import type { UploadFile, useFileUpload } from "@/hooks/use-file-upload";

const KIND_ICON = {
  QR: QrCode,
  BANK_TRANSFER: Building2,
  WALLET: Wallet,
} as const;

export const MAX_PROOF_BYTES = 50 * 1024 * 1024;

/** The account details for the chosen method, as a table rather than loose text. */
function MethodDetails({ method }: { method: PaymentMethod }) {
  const rows = [
    ["Account name", method.accountName],
    ["Account number", method.accountNumber],
    ["Bank", method.bankName],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0 && !method.imageUrl && !method.instructions) return null;

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
 * The listing fee, collected inside the wizard rather than on a page after it.
 * Sending the seller to a separate screen once the listing already existed left
 * a saved-but-unpaid listing behind every time someone closed the tab.
 */
export function ListingFeeStep({
  method,
  reference,
  files,
  isDragging,
  errors,
  proofError,
  methodError,
  upload,
  onMethodChange,
  onReferenceChange,
}: {
  method: string;
  reference: string;
  files: readonly UploadFile[];
  isDragging: boolean;
  errors: readonly string[];
  proofError: string | null;
  methodError: string | null;
  upload: ReturnType<typeof useFileUpload>[1];
  onMethodChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
}) {
  const fee = useQuery({
    queryKey: ["listing-fee"],
    queryFn: ({ signal }) => getListingFee(signal),
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
          Nothing is charged right now — continue to post your property.
        </AlertDescription>
      </Alert>
    );
  }

  const methods = fee.data.methods.filter((entry) => entry.enabled);
  const selected = methods.find((entry) => entry.id === method) ?? null;

  return (
    <div className="space-y-6">
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
          <FieldGroup>
            <Field invalid={Boolean(methodError)}>
              <RadioGroup
                className="grid gap-3 sm:grid-cols-2"
                value={method || null}
                onValueChange={(value) => onMethodChange(String(value ?? ""))}
              >
                {methods.map((entry) => {
                  const Icon = KIND_ICON[entry.kind];
                  return (
                    <FieldLabel
                      key={entry.id}
                      className="w-full cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal transition-colors has-data-checked:border-primary has-data-checked:bg-accent/50"
                    >
                      <Radio value={entry.id} className="mt-0.5" />
                      <Icon
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{entry.label}</span>
                        {entry.bankName ? (
                          <span className="block text-muted-foreground text-xs">
                            {entry.bankName}
                          </span>
                        ) : null}
                      </span>
                    </FieldLabel>
                  );
                })}
              </RadioGroup>
              <FieldError match>{methodError}</FieldError>
            </Field>

            {selected ? <MethodDetails method={selected} /> : null}

            <Field>
              <FieldLabel htmlFor="payment-reference">
                Transaction reference
              </FieldLabel>
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => onReferenceChange(event.target.value)}
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
              inputProps={upload.getInputProps()}
              maxFiles={1}
              maxSize={MAX_PROOF_BYTES}
              onOpen={upload.openFileDialog}
              onRemove={upload.removeFile}
              onClear={upload.clearFiles}
              onDragEnter={upload.handleDragEnter}
              onDragLeave={upload.handleDragLeave}
              onDragOver={upload.handleDragOver}
              onDrop={upload.handleDrop}
            />
            {proofError ? (
              <p className="text-destructive-foreground text-xs" role="alert">
                {proofError}
              </p>
            ) : null}
          </FieldGroup>
        </Fieldset>
      )}
    </div>
  );
}
