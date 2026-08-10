"use client";

import { useRef } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "../api/account-api";
import { queryKeys } from "@/shared/query/query-keys";
import {
  uploadMedia,
  waitForMediaReady,
} from "@/features/media/api/media-api";

export function ProfileForm() {
  const queryClient = useQueryClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const profile = useQuery({
    queryKey: queryKeys.profile("me"),
    queryFn: getMyProfile,
  });
  const mutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const fields = new FormData(form);
      const avatar = avatarRef.current?.files?.[0];
      const cover = coverRef.current?.files?.[0];
      const [imageAssetId, coverAssetId] = await Promise.all([
        avatar
          ? uploadMedia(avatar, "PROFILE_IMAGE").then((id) =>
              waitForMediaReady(id),
            )
          : Promise.resolve(undefined),
        cover
          ? uploadMedia(cover, "COVER_IMAGE").then((id) =>
              waitForMediaReady(id),
            )
          : Promise.resolve(undefined),
      ]);
      return updateMyProfile({
        name: String(fields.get("name")),
        username: String(fields.get("username")) || undefined,
        bio: String(fields.get("bio")) || null,
        phone: String(fields.get("phone")) || null,
        imageAssetId,
        coverAssetId,
      });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      avatarRef.current && (avatarRef.current.value = "");
      coverRef.current && (coverRef.current.value = "");
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile("me") });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(event.currentTarget);
  }

  if (profile.isLoading) {
    return <div className="surface rounded-2xl p-8">Loading profile…</div>;
  }
  if (!profile.data) {
    return <div className="surface rounded-2xl p-8">Unable to load your profile.</div>;
  }

  return (
    <form
      onSubmit={submit}
      className="surface grid gap-5 rounded-2xl p-6 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <h2 className="font-semibold">Profile media</h2>
        <p className="mt-1 text-xs text-slate-500">
          Images are uploaded directly to object storage and published after secure processing.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm font-semibold text-slate-700 hover:border-emerald-600">
            <Camera className="size-5 text-emerald-700" />
            <span>New profile photo</span>
            <input
              ref={avatarRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm font-semibold text-slate-700 hover:border-emerald-600">
            <Camera className="size-5 text-emerald-700" />
            <span>New cover photo</span>
            <input
              ref={coverRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
            />
          </label>
        </div>
      </div>

      <label className="text-sm font-medium">
        Full name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={profile.data.name}
          className="mt-2 h-11 w-full rounded-xl border px-3"
        />
      </label>
      <label className="text-sm font-medium">
        Username
        <input
          name="username"
          pattern="[a-z0-9_]{3,30}"
          defaultValue={profile.data.username ?? ""}
          className="mt-2 h-11 w-full rounded-xl border px-3"
        />
      </label>
      <label className="text-sm font-medium">
        Phone
        <input
          name="phone"
          defaultValue={profile.data.phone ?? ""}
          className="mt-2 h-11 w-full rounded-xl border px-3"
        />
      </label>
      <label className="text-sm font-medium">
        Email
        <input
          disabled
          value={profile.data.email ?? ""}
          className="mt-2 h-11 w-full rounded-xl border bg-slate-50 px-3 text-slate-500"
        />
      </label>
      <label className="text-sm font-medium sm:col-span-2">
        Bio
        <textarea
          name="bio"
          maxLength={500}
          defaultValue={profile.data.bio ?? ""}
          rows={5}
          className="mt-2 w-full rounded-xl border p-3"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          disabled={mutation.isPending}
          className="brand-button flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
