"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/features/admin/api/admin-api";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { useHasStaffPermission } from "../../_components/admin-shell";
import { useStepUp } from "../../_components/step-up-dialog";
import { errorMessage } from "@/shared/http/error-message";

type PlatformSettings = Awaited<ReturnType<typeof getPlatformSettings>>;

export function SettingsPanel() {
  const client = useQueryClient();
  const { guard } = useStepUp();
  const canManage = useHasStaffPermission("admin.settings.manage");
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getPlatformSettings,
  });
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const values = draft ?? query.data;

  const mutation = useMutation({
    mutationFn: (next: PlatformSettings) =>
      guard(() => updatePlatformSettings(next)),
    onSuccess: async () => {
      toast.success("Platform settings saved.");
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (!values) {
    return (
      <section className="rounded-xl border bg-background p-8 text-sm text-muted-foreground">
        {query.isError ? "Settings could not be loaded." : "Loading settings…"}
      </section>
    );
  }

  const set = <Key extends keyof PlatformSettings>(
    key: Key,
    value: PlatformSettings[Key],
  ) => setDraft({ ...values, [key]: value });

  return (
    <section className="max-w-3xl rounded-xl border bg-background p-6">
      <div className="space-y-5">
        <SettingSwitch
          label="Require property moderation"
          description="New listings stay unpublished until a moderator approves them."
          value={Boolean(values.propertyModerationRequired)}
          disabled={!canManage}
          onChange={(value) => set("propertyModerationRequired", value)}
        />
        <SettingSwitch
          label="Require verified identity for auctions"
          description="Bidders must complete identity verification before registering."
          value={Boolean(values.auctionIdentityRequired)}
          disabled={!canManage}
          onChange={(value) => set("auctionIdentityRequired", value)}
        />
        <SettingNumber
          label="Default anti-sniping window (seconds)"
          value={Number(values.defaultAuctionExtensionWindowSeconds)}
          disabled={!canManage}
          onChange={(value) =>
            set("defaultAuctionExtensionWindowSeconds", value)
          }
        />
        <SettingNumber
          label="Default extension duration (seconds)"
          value={Number(values.defaultAuctionExtensionDurationSeconds)}
          disabled={!canManage}
          onChange={(value) =>
            set("defaultAuctionExtensionDurationSeconds", value)
          }
        />
        <SettingNumber
          label="Maximum property images"
          value={Number(values.maximumPropertyImages)}
          disabled={!canManage}
          onChange={(value) => set("maximumPropertyImages", value)}
        />
      </div>

      {canManage ? (
        <Button
          className="mt-7"
          loading={mutation.isPending}
          disabled={draft === null}
          onClick={() => mutation.mutate(values)}
        >
          Save settings
        </Button>
      ) : null}
    </section>
  );
}

function SettingSwitch({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field className="flex-row items-center justify-between rounded-xl border p-4">
      <div className="min-w-0">
        <FieldLabel className="font-medium">{label}</FieldLabel>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={value} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  );
}

function SettingNumber({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    // FieldLabel needs a Field root above it; the number field is the control.
    <Field className="grid gap-2 sm:grid-cols-[1fr_190px] sm:items-center sm:gap-4">
      <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
      <NumberField
        value={value}
        min={0}
        disabled={disabled}
        onValueChange={(next) => onChange(next ?? 0)}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </Field>
  );
}
