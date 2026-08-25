"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMyProfile,
  updateMyProfile,
} from "@/features/account/api/account-api";
import { queryKeys } from "@/shared/query/query-keys";
import { uploadMedia, waitForMediaReady } from "@/features/media/api/media-api";
import { errorMessage } from "@/shared/http/error-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFileUpload } from "@/hooks/use-file-upload";

const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif";
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

type FormState = {
  name: string;
  phone: string;
};
type Errors = Partial<Record<keyof FormState, string>>;

/** The rules the API enforces, checked next to the field they belong to. */
function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.name.trim().length < 2) {
    errors.name = "Enter your full name.";
  } else if (form.name.trim().length > 100) {
    errors.name = "Your name must be 100 characters or fewer.";
  }
  // A phone number is what an agent calls back on, so it is required rather
  // than optional: an account without one cannot list or bid.
  const phone = form.phone.trim();
  if (!phone) {
    errors.phone = "Add a phone number so agents can reach you.";
  } else if (!/^[0-9+\-\s()]{7,30}$/.test(phone)) {
    errors.phone = "Enter a valid phone number.";
  }
  return errors;
}

export function ProfileForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const [
    { files: avatarFiles, isDragging: avatarDragging, errors: avatarErrors },
    avatar,
  ] = useFileUpload({
    accept: IMAGE_TYPES,
    maxFiles: 1,
    maxSize: MAX_IMAGE_BYTES,
    multiple: false,
  });
  const [
    { files: coverFiles, isDragging: coverDragging, errors: coverErrors },
    cover,
  ] = useFileUpload({
    accept: IMAGE_TYPES,
    maxFiles: 1,
    maxSize: MAX_IMAGE_BYTES,
    multiple: false,
  });

  const profile = useQuery({
    queryKey: queryKeys.profile("me"),
    queryFn: getMyProfile,
  });

  // Derived, not synced through an effect: the draft takes over on first edit.
  const values: FormState | null = form ??
    (profile.data
      ? {
          name: profile.data.name,
          phone: profile.data.phone ?? "",
        }
      : null);

  const mutation = useMutation({
    mutationFn: async (current: FormState) => {
      const avatarFile = avatarFiles[0]?.file;
      const coverFile = coverFiles[0]?.file;
      // Both at once: waiting for one scan and re-encode before starting the
      // other doubled the wait for no reason.
      const [imageAssetId, coverAssetId] = await Promise.all([
        avatarFile
          ? uploadMedia(avatarFile, "PROFILE_IMAGE").then(waitForMediaReady)
          : Promise.resolve(undefined),
        coverFile
          ? uploadMedia(coverFile, "COVER_IMAGE").then(waitForMediaReady)
          : Promise.resolve(undefined),
      ]);

      return updateMyProfile({
        name: current.name.trim(),
        phone: current.phone.trim() || null,
        ...(imageAssetId ? { imageAssetId } : {}),
        ...(coverAssetId ? { coverAssetId } : {}),
      });
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      avatar.clearFiles();
      cover.clearFiles();
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile("me") });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (profile.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (profile.isError || !values) {
    return (
      <Alert variant="error">
        <AlertTitle>Profile unavailable</AlertTitle>
        <AlertDescription>
          Your profile could not be loaded. Try again shortly.
        </AlertDescription>
      </Alert>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...(current ?? values), [key]: value }));
    // Clearing as they type stops a message sitting under a field they fixed.
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };



  /** One row: what it is on the left, the control on the right. */
  const rows: Array<{
    key: keyof FormState;
    label: string;
    hint: string;
    control: ReactNode;
  }> = [
    {
      key: "name",
      label: "Full name",
      hint: "Shown wherever you appear on the marketplace",
      control: (
        <Input
          aria-label="Full name"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          maxLength={100}
          autoComplete="name"
        />
      ),
    },
    {
      key: "phone",
      label: "Phone",
      hint: "Required — how an agent reaches you about a listing",
      control: (
        <Input
          aria-label="Phone"
          type="tel"
          value={values.phone}
          onChange={(event) => set("phone", event.target.value)}
          maxLength={30}
          placeholder="98XXXXXXXX"
          autoComplete="tel"
        />
      ),
    },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const found = validate(values);
        if (Object.keys(found).length > 0) {
          setErrors(found);
          return;
        }
        mutation.mutate(values);
      }}
      className="grid gap-4"
    >
      {/* Laid out like the Security, Sessions and Passkeys tabs beside it. */}
      <Frame>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Profile</TableHead>
              <TableHead className="w-[46%]">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div className="font-medium">Photos</div>
                <div className="text-muted-foreground text-xs">
                  Profile picture and the cover on your public page
                </div>
              </TableCell>
              <TableCell>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FileUploader
                    title="Profile photo"
                    files={avatarFiles}
                    isDragging={avatarDragging}
                    errors={avatarErrors}
                    inputProps={avatar.getInputProps()}
                    maxFiles={1}
                    maxSize={MAX_IMAGE_BYTES}
                    onOpen={avatar.openFileDialog}
                    onRemove={avatar.removeFile}
                    onClear={avatar.clearFiles}
                    onDragEnter={avatar.handleDragEnter}
                    onDragLeave={avatar.handleDragLeave}
                    onDragOver={avatar.handleDragOver}
                    onDrop={avatar.handleDrop}
                  />
                  <FileUploader
                    title="Cover photo"
                    files={coverFiles}
                    isDragging={coverDragging}
                    errors={coverErrors}
                    inputProps={cover.getInputProps()}
                    maxFiles={1}
                    maxSize={MAX_IMAGE_BYTES}
                    onOpen={cover.openFileDialog}
                    onRemove={cover.removeFile}
                    onClear={cover.clearFiles}
                    onDragEnter={cover.handleDragEnter}
                    onDragLeave={cover.handleDragLeave}
                    onDragOver={cover.handleDragOver}
                    onDrop={cover.handleDrop}
                  />
                </div>
              </TableCell>
            </TableRow>

            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="font-medium">{row.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {row.hint}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1.5">
                    {row.control}
                    {errors[row.key] ? (
                      <p
                        className="text-destructive-foreground text-xs"
                        role="alert"
                      >
                        {errors[row.key]}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell>
                <div className="font-medium">Email</div>
                <div className="text-muted-foreground text-xs">
                  Change it from the Security tab
                </div>
              </TableCell>
              <TableCell>
                <Input
                  aria-label="Email"
                  value={profile.data?.email ?? ""}
                  disabled
                  readOnly
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Frame>

      <div className="flex justify-end">
        <Button type="submit" loading={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
