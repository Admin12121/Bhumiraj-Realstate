"use client";

import { useState } from "react";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Frame, FramePanel } from "@/components/ui/frame";
import { FileUploader } from "@/components/ui/file-uploader";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";

const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif";
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

type FormState = {
  name: string;
  username: string;
  phone: string;
  bio: string;
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
  const username = form.username.trim();
  if (username && !/^[a-z0-9_]{3,30}$/.test(username)) {
    errors.username =
      "Use 3–30 characters: lowercase letters, numbers and underscores only.";
  }
  if (form.phone.trim().length > 30) {
    errors.phone = "That phone number is too long.";
  }
  if (form.bio.trim().length > 500) {
    errors.bio = "Your bio must be 500 characters or fewer.";
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
          username: profile.data.username ?? "",
          phone: profile.data.phone ?? "",
          bio: profile.data.bio ?? "",
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
        ...(current.username.trim()
          ? { username: current.username.trim() }
          : {}),
        bio: current.bio.trim() || null,
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
    >
      {/* Framed like the Security, Sessions and Passkeys tabs beside it. */}
      <Frame>
        <FramePanel className="space-y-6">
          <Fieldset>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <FileUploader
                  title="New profile photo"
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
                  title="New cover photo"
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
            </FieldGroup>
          </Fieldset>

          <FieldSeparator />

          <Fieldset>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
                  <Input
                    id="profile-name"
                    value={values.name}
                    onChange={(event) => set("name", event.target.value)}
                    maxLength={100}
                    autoComplete="name"
                  />
                  <FieldError match>{errors.name}</FieldError>
                </Field>

                <Field invalid={Boolean(errors.username)}>
                  <FieldLabel htmlFor="profile-username">Username</FieldLabel>
                  <Input
                    id="profile-username"
                    value={values.username}
                    onChange={(event) => set("username", event.target.value)}
                    maxLength={30}
                    placeholder="your_handle"
                    autoComplete="username"
                  />
                  <FieldDescription>
                    Lowercase letters, numbers and underscores.
                  </FieldDescription>
                  <FieldError match>{errors.username}</FieldError>
                </Field>

                <Field invalid={Boolean(errors.phone)}>
                  <FieldLabel htmlFor="profile-phone">Phone</FieldLabel>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={values.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    maxLength={30}
                    placeholder="98XXXXXXXX"
                    autoComplete="tel"
                  />
                  <FieldError match>{errors.phone}</FieldError>
                </Field>

                <Field disabled>
                  <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                  <Input
                    id="profile-email"
                    value={profile.data?.email ?? ""}
                    disabled
                    readOnly
                  />
                  <FieldDescription>
                    Change your email from the Security tab.
                  </FieldDescription>
                </Field>
              </div>

              <Field invalid={Boolean(errors.bio)}>
                <FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
                <Textarea
                  id="profile-bio"
                  value={values.bio}
                  onChange={(event) => set("bio", event.target.value)}
                  maxLength={500}
                  rows={5}
                  placeholder="A short introduction shown on your public profile."
                />
                <FieldDescription>
                  {values.bio.trim().length}/500 characters.
                </FieldDescription>
                <FieldError match>{errors.bio}</FieldError>
              </Field>
            </FieldGroup>
          </Fieldset>

          <div className="flex items-center justify-end border-t pt-6">
            <Button type="submit" loading={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </FramePanel>
      </Frame>
    </form>
  );
}
