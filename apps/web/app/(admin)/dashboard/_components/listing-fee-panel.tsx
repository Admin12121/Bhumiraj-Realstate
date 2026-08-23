"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, QrCode, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { ListingFeeSettings, PaymentMethod } from "@real-estate/contracts";

import {
  getListingFeeSettings,
  updateListingFeeSettings,
} from "@/features/admin/api/admin-api";
import { uploadMedia, waitForMediaReady } from "@/features/media/api/media-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Fieldset,
  FieldsetDescription,
  FieldsetLegend,
} from "@/components/ui/fieldset";
import { Frame } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useHasStaffPermission } from "./admin-shell";
import { useStepUp } from "./step-up-dialog";
import { errorMessage } from "@/shared/http/error-message";

const KINDS = [
  { value: "QR", label: "QR code" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "WALLET", label: "Wallet" },
];

const KIND_ICON = {
  QR: QrCode,
  BANK_TRANSFER: Building2,
  WALLET: Wallet,
} as const;

function blankMethod(index: number): PaymentMethod {
  return {
    id: `method-${index + 1}-${Date.now().toString(36)}`,
    label: "",
    kind: "BANK_TRANSFER",
    imageAssetId: null,
    imageUrl: null,
    accountName: null,
    accountNumber: null,
    bankName: null,
    instructions: null,
    enabled: true,
  };
}

/**
 * What a seller is charged, and the ways they can pay it.
 *
 * The customer payment screen renders whatever is configured here — a QR image,
 * bank details, a wallet — so an empty list is why sellers were told no payment
 * method exists.
 */
export function ListingFeePanel() {
  const client = useQueryClient();
  const { guard } = useStepUp();
  const canManage = useHasStaffPermission("admin.settings.manage");

  const query = useQuery({
    queryKey: ["admin", "listing-fee"],
    queryFn: getListingFeeSettings,
  });

  const [draft, setDraft] = useState<ListingFeeSettings | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Derived, not synced through an effect: the draft simply takes over once
  // the administrator edits something.
  const values = draft ?? query.data ?? null;

  const save = useMutation({
    mutationFn: (next: ListingFeeSettings) =>
      guard(() => updateListingFeeSettings(next)),
    onSuccess: async () => {
      toast.success("Listing fee saved.");
      await client.invalidateQueries({ queryKey: ["admin", "listing-fee"] });
      await client.invalidateQueries({ queryKey: ["listing-fee"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (query.isPending || values === null) {
    return (
      <p className="text-sm text-muted-foreground">Loading fee settings…</p>
    );
  }
  if (query.isError) {
    return (
      <p className="text-sm text-destructive">
        The listing fee could not be loaded.
      </p>
    );
  }

  const patch = (changes: Partial<ListingFeeSettings>) =>
    setDraft((current) => ({ ...(current ?? values), ...changes }));

  const patchMethod = (id: string, changes: Partial<PaymentMethod>) =>
    setDraft((current) => {
      const base = current ?? values;
      return {
        ...base,
        methods: base.methods.map((method) =>
          method.id === id ? { ...method, ...changes } : method,
        ),
      };
    });

  async function uploadQr(id: string, file: File) {
    setUploadingFor(id);
    try {
      // Same pipeline as listing photos: scanned and re-encoded before it is
      // ever shown to a seller.
      const assetId = await uploadMedia(file, "PAYMENT_QR");
      await waitForMediaReady(assetId);
      // The CDN URL is derived server-side on save, so only the id is kept.
      patchMethod(id, { imageAssetId: assetId, imageUrl: null });
      toast.success("QR image attached. Save to publish it.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "The image could not be added.",
      );
    } finally {
      setUploadingFor(null);
    }
  }

  return (
    <div className="grid gap-6">
      <Fieldset>
        <FieldsetLegend>Listing fee</FieldsetLegend>
        <FieldsetDescription>
          Charged once per property, before it enters the review queue.
        </FieldsetDescription>
        <FieldGroup>
          <Field className="flex-row items-center justify-between rounded-xl border p-4">
            <div className="min-w-0">
              <FieldLabel className="font-medium">Charge a fee</FieldLabel>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Turn this off and properties skip payment entirely.
              </p>
            </div>
            <Switch
              checked={values.enabled}
              disabled={!canManage}
              onCheckedChange={(checked) => patch({ enabled: checked })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="fee-amount">Amount</FieldLabel>
              <Input
                id="fee-amount"
                type="number"
                min={0}
                disabled={!canManage}
                value={Number(values.amountMinor) / 100}
                onChange={(event) =>
                  patch({
                    amountMinor: String(
                      Math.round(Number(event.target.value || 0) * 100),
                    ),
                  })
                }
              />
              <FieldDescription>
                Entered in {values.currency}, stored in the smallest unit.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="fee-currency">Currency</FieldLabel>
              <Input
                id="fee-currency"
                maxLength={3}
                disabled={!canManage}
                value={values.currency}
                onChange={(event) =>
                  patch({ currency: event.target.value.toUpperCase() })
                }
              />
            </Field>
          </div>
        </FieldGroup>
      </Fieldset>

      <FieldSeparator />

      <Fieldset>
        <FieldsetLegend>Payment methods</FieldsetLegend>
        <FieldsetDescription>
          Sellers see these on the payment screen and upload a receipt against
          whichever one they used.
        </FieldsetDescription>

        <div className="mt-4 grid gap-4">
          {values.methods.length === 0 ? (
            <p className="rounded-xl border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              No payment methods yet. Sellers cannot pay until you add one.
            </p>
          ) : null}

          {values.methods.map((method) => {
            const Icon = KIND_ICON[method.kind];
            return (
              <Frame key={method.id}>
                <div className="grid gap-4 rounded-xl border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="font-medium">
                        {method.label || "Untitled method"}
                      </span>
                      <Badge
                        size="sm"
                        variant={method.enabled ? "success" : "secondary"}
                      >
                        {method.enabled ? "Shown" : "Hidden"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={method.enabled}
                        disabled={!canManage}
                        aria-label={`Show ${method.label || "method"}`}
                        onCheckedChange={(checked) =>
                          patchMethod(method.id, { enabled: checked })
                        }
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={!canManage}
                        aria-label={`Remove ${method.label || "method"}`}
                        onClick={() =>
                          patch({
                            methods: values.methods.filter(
                              (item) => item.id !== method.id,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`label-${method.id}`}>
                          Label
                        </FieldLabel>
                        <Input
                          id={`label-${method.id}`}
                          value={method.label}
                          disabled={!canManage}
                          placeholder="eSewa, Nabil Bank, …"
                          onChange={(event) =>
                            patchMethod(method.id, { label: event.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`kind-${method.id}`}>
                          Kind
                        </FieldLabel>
                        <Select
                          items={KINDS}
                          value={method.kind}
                          disabled={!canManage}
                          onValueChange={(value) =>
                            patchMethod(method.id, {
                              kind: String(value) as PaymentMethod["kind"],
                            })
                          }
                        >
                          <SelectTrigger id={`kind-${method.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectPopup>
                            {KINDS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      </Field>
                    </div>

                    {method.kind === "BANK_TRANSFER" ? (
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field>
                          <FieldLabel htmlFor={`bank-${method.id}`}>
                            Bank
                          </FieldLabel>
                          <Input
                            id={`bank-${method.id}`}
                            value={method.bankName ?? ""}
                            disabled={!canManage}
                            onChange={(event) =>
                              patchMethod(method.id, {
                                bankName: event.target.value || null,
                              })
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`account-name-${method.id}`}>
                            Account name
                          </FieldLabel>
                          <Input
                            id={`account-name-${method.id}`}
                            value={method.accountName ?? ""}
                            disabled={!canManage}
                            onChange={(event) =>
                              patchMethod(method.id, {
                                accountName: event.target.value || null,
                              })
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`account-number-${method.id}`}>
                            Account number
                          </FieldLabel>
                          <Input
                            id={`account-number-${method.id}`}
                            value={method.accountNumber ?? ""}
                            disabled={!canManage}
                            onChange={(event) =>
                              patchMethod(method.id, {
                                accountNumber: event.target.value || null,
                              })
                            }
                          />
                        </Field>
                      </div>
                    ) : (
                      <Field>
                        <FieldLabel>QR or wallet image</FieldLabel>
                        <div className="flex flex-wrap items-center gap-3">
                          {method.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={method.imageUrl}
                              alt=""
                              className="size-24 rounded-lg border bg-background object-contain p-1"
                            />
                          ) : method.imageAssetId ? (
                            <span className="grid size-24 place-items-center rounded-lg border bg-muted/40 text-center text-[11px] text-muted-foreground">
                              Attached — save to publish
                            </span>
                          ) : null}
                          <input
                            id={`qr-${method.id}`}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) void uploadQr(method.id, file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!canManage}
                            loading={uploadingFor === method.id}
                            onClick={() =>
                              document
                                .querySelector<HTMLInputElement>(
                                  `#qr-${method.id}`,
                                )
                                ?.click()
                            }
                          >
                            {method.imageAssetId ? "Replace image" : "Upload image"}
                          </Button>
                        </div>
                        <FieldDescription>
                          Sellers scan this to pay, so upload the code itself.
                        </FieldDescription>
                      </Field>
                    )}

                    <Field>
                      <FieldLabel htmlFor={`instructions-${method.id}`}>
                        Instructions
                      </FieldLabel>
                      <Textarea
                        id={`instructions-${method.id}`}
                        value={method.instructions ?? ""}
                        disabled={!canManage}
                        maxLength={500}
                        placeholder="Anything the seller needs to include, such as a reference."
                        onChange={(event) =>
                          patchMethod(method.id, {
                            instructions: event.target.value || null,
                          })
                        }
                      />
                    </Field>
                  </FieldGroup>
                </div>
              </Frame>
            );
          })}

          {canManage ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() =>
                patch({
                  methods: [...values.methods, blankMethod(values.methods.length)],
                })
              }
            >
              <Plus />
              Add payment method
            </Button>
          ) : null}
        </div>
      </Fieldset>

      {canManage ? (
        <div className="flex items-center gap-3">
          <Button loading={save.isPending} onClick={() => save.mutate(values)}>
            Save payment settings
          </Button>
          <Button
            variant="ghost"
            disabled={save.isPending}
            onClick={() => setDraft(query.data ?? null)}
          >
            Discard changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
