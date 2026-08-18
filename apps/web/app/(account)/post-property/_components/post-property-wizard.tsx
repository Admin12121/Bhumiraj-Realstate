"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Gavel,
  ImagePlus,
  Loader2,
  MapPin,
  UploadCloud,
} from "lucide-react";
import { createListingSchema } from "@real-estate/contracts";
import { createListing, submitListing } from "@/features/listings/api/listings-api";
import { uploadPropertyImage } from "@/features/media/api/media-api";
import { toast } from "sonner";

const steps = ["Property", "Location", "Details", "Images", "Review"];

function localDateTime(offsetMs: number) {
  const date = new Date(Date.now() + offsetMs);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const initialForm = {
  title: "",
  description: "",
  listingType: "SALE",
  propertyType: "HOUSE",
  price: "",
  rentPeriod: "MONTH",
  province: "Bagmati",
  district: "Lalitpur",
  municipality: "Lalitpur Metropolitan City",
  ward: "",
  locality: "Bhaisepati",
  street: "",
  latitude: "",
  longitude: "",
  publicLocationPrecision: "APPROXIMATE",
  bedrooms: "4",
  bathrooms: "4",
  kitchens: "1",
  floors: "2",
  areaSqFt: "2750",
  parkingSpaces: "1",
  builtYear: "",
  furnishing: "SEMI_FURNISHED",
  auctionStartingAmount: "",
  auctionReserveAmount: "",
  auctionMinimumIncrement: "10000",
  auctionStartsAt: localDateTime(60 * 60 * 1000),
  auctionEndsAt: localDateTime(25 * 60 * 60 * 1000),
  auctionExtensionWindow: "120",
  auctionExtensionDuration: "120",
  auctionMaximumExtension: "30",
};

type FormState = typeof initialForm;

export function PostPropertyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);

  const isAuction = form.listingType === "AUCTION";
  const isRent = form.listingType === "RENT";
  const previewPrice = useMemo(() => {
    const value = isAuction ? form.auctionStartingAmount : form.price;
    return value ? new Intl.NumberFormat("en-NP").format(Number(value)) : "Not set";
  }, [form.auctionStartingAmount, form.price, isAuction]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Add at least one property image.");

      const mediaAssetIds: string[] = [];
      for (const file of files) {
        mediaAssetIds.push(await uploadPropertyImage(file));
      }

      const payload = createListingSchema.parse({
        title: form.title,
        description: form.description,
        listingType: form.listingType,
        propertyType: form.propertyType,
        price: isAuction
          ? null
          : {
              amountMinor: toMinorUnits(form.price),
              currency: "NPR",
            },
        rentPeriod: isRent ? form.rentPeriod : null,
        auction: isAuction
          ? {
              startingAmountMinor: toMinorUnits(form.auctionStartingAmount),
              reserveAmountMinor: form.auctionReserveAmount
                ? toMinorUnits(form.auctionReserveAmount)
                : null,
              minimumIncrementMinor: toMinorUnits(
                form.auctionMinimumIncrement,
              ),
              startsAt: new Date(form.auctionStartsAt).toISOString(),
              endsAt: new Date(form.auctionEndsAt).toISOString(),
              extensionWindowSeconds: Number(form.auctionExtensionWindow),
              extensionDurationSeconds: Number(form.auctionExtensionDuration),
              maximumExtensionMinutes: Number(form.auctionMaximumExtension),
            }
          : null,
        address: {
          province: form.province,
          district: form.district,
          municipality: form.municipality,
          ward: form.ward || undefined,
          locality: form.locality,
          street: form.street || undefined,
          latitude: optionalNumber(form.latitude),
          longitude: optionalNumber(form.longitude),
          publicLocationPrecision: form.publicLocationPrecision,
        },
        specifications: {
          bedrooms: optionalInteger(form.bedrooms),
          bathrooms: optionalInteger(form.bathrooms),
          kitchens: optionalInteger(form.kitchens),
          floors: optionalInteger(form.floors),
          parkingSpaces: optionalInteger(form.parkingSpaces),
          areaSqFt: Number(form.areaSqFt),
          builtYear: optionalInteger(form.builtYear),
          furnishing: form.furnishing || undefined,
        },
        amenityIds: [],
        mediaAssetIds,
      });

      const listing = await createListing(payload);
      await submitListing(listing.id);
      return listing;
    },
    onSuccess: (listing) => {
      // Payment comes next: the listing is saved but not yet in the review queue.
      toast.success("Property saved. Complete the listing fee to continue.");
      router.push(`/post-property/pay/${listing.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="surface overflow-hidden rounded-[24px]">
      <div className="border-b bg-slate-50 px-6 py-5">
        <div className="flex justify-between gap-2">
          {steps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                  index <= step
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-400"
                }`}
              >
                {index < step ? <CheckCircle2 className="size-4" /> : index + 1}
              </span>
              <span className="hidden text-xs font-semibold sm:block">{label}</span>
              {index < steps.length - 1 && (
                <span className="h-px flex-1 bg-slate-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step < steps.length - 1) setStep((current) => current + 1);
          else mutation.mutate();
        }}
        className="p-6 sm:p-8"
      >
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Listing title"
              value={form.title}
              onChange={(value) => set("title", value)}
              placeholder="Modern 4BHK house in Bhaisepati"
              className="sm:col-span-2"
            />
            <SelectField
              label="Listing type"
              value={form.listingType}
              onChange={(value) => set("listingType", value)}
              options={["SALE", "RENT", "AUCTION"]}
            />
            <SelectField
              label="Property type"
              value={form.propertyType}
              onChange={(value) => set("propertyType", value)}
              options={[
                "HOUSE",
                "APARTMENT",
                "LAND",
                "COMMERCIAL",
                "OFFICE",
                "WAREHOUSE",
              ]}
            />
            {!isAuction && (
              <Field
                label={isRent ? "Rent (NPR)" : "Price (NPR)"}
                type="number"
                value={form.price}
                onChange={(value) => set("price", value)}
                placeholder="34500000"
              />
            )}
            {isRent && (
              <SelectField
                label="Rent period"
                value={form.rentPeriod}
                onChange={(value) => set("rentPeriod", value)}
                options={["DAY", "WEEK", "MONTH", "YEAR"]}
              />
            )}
            <label className="text-sm font-medium sm:col-span-2">
              Description
              <textarea
                required
                minLength={50}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                rows={7}
                className="mt-2 w-full rounded-xl border p-3"
                placeholder="Describe the property, neighborhood, access and important conditions."
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Province" value={form.province} onChange={(value) => set("province", value)} />
            <Field label="District" value={form.district} onChange={(value) => set("district", value)} />
            <Field label="Municipality" value={form.municipality} onChange={(value) => set("municipality", value)} />
            <Field label="Ward" required={false} value={form.ward} onChange={(value) => set("ward", value)} />
            <Field label="Locality" value={form.locality} onChange={(value) => set("locality", value)} />
            <Field label="Street" required={false} value={form.street} onChange={(value) => set("street", value)} />
            <Field label="Latitude" required={false} type="number" step="any" value={form.latitude} onChange={(value) => set("latitude", value)} />
            <Field label="Longitude" required={false} type="number" step="any" value={form.longitude} onChange={(value) => set("longitude", value)} />
            <SelectField
              label="Public map precision"
              value={form.publicLocationPrecision}
              onChange={(value) => set("publicLocationPrecision", value)}
              options={["APPROXIMATE", "LOCALITY", "EXACT"]}
              className="sm:col-span-2"
            />
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 sm:col-span-2">
              <MapPin className="mr-2 inline size-4" />
              Exact coordinates stay private unless you explicitly select exact public precision.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Bedrooms" required={false} type="number" value={form.bedrooms} onChange={(value) => set("bedrooms", value)} />
              <Field label="Bathrooms" required={false} type="number" value={form.bathrooms} onChange={(value) => set("bathrooms", value)} />
              <Field label="Kitchens" required={false} type="number" value={form.kitchens} onChange={(value) => set("kitchens", value)} />
              <Field label="Floors" required={false} type="number" value={form.floors} onChange={(value) => set("floors", value)} />
              <Field label="Area (sq. ft.)" type="number" value={form.areaSqFt} onChange={(value) => set("areaSqFt", value)} />
              <Field label="Parking spaces" required={false} type="number" value={form.parkingSpaces} onChange={(value) => set("parkingSpaces", value)} />
              <Field label="Built year" required={false} type="number" value={form.builtYear} onChange={(value) => set("builtYear", value)} />
              <SelectField label="Furnishing" value={form.furnishing} onChange={(value) => set("furnishing", value)} options={["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"]} />
            </div>

            {isAuction && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Gavel className="size-5 text-amber-800" />
                  <div>
                    <h2 className="font-semibold text-amber-950">Live bidding configuration</h2>
                    <p className="text-xs text-amber-800">The schedule is reviewed before publication.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starting amount (NPR)" type="number" value={form.auctionStartingAmount} onChange={(value) => set("auctionStartingAmount", value)} />
                  <Field label="Reserve amount (NPR)" required={false} type="number" value={form.auctionReserveAmount} onChange={(value) => set("auctionReserveAmount", value)} />
                  <Field label="Minimum increment (NPR)" type="number" value={form.auctionMinimumIncrement} onChange={(value) => set("auctionMinimumIncrement", value)} />
                  <Field label="Starts at" type="datetime-local" value={form.auctionStartsAt} onChange={(value) => set("auctionStartsAt", value)} />
                  <Field label="Ends at" type="datetime-local" value={form.auctionEndsAt} onChange={(value) => set("auctionEndsAt", value)} />
                  <Field label="Extension window (seconds)" type="number" value={form.auctionExtensionWindow} onChange={(value) => set("auctionExtensionWindow", value)} />
                  <Field label="Extension duration (seconds)" type="number" value={form.auctionExtensionDuration} onChange={(value) => set("auctionExtensionDuration", value)} />
                  <Field label="Maximum extension (minutes)" type="number" value={form.auctionMaximumExtension} onChange={(value) => set("auctionMaximumExtension", value)} />
                </div>
              </section>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <label className="grid min-h-56 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="sr-only"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []).slice(0, 20))
                }
              />
              <span>
                <ImagePlus className="mx-auto size-10 text-emerald-700" />
                <span className="mt-3 block font-semibold">Select property images</span>
                <span className="mt-1 block text-xs text-slate-500">
                  JPEG, PNG, WebP or AVIF Â· up to 25 MB each
                </span>
              </span>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {files.map((file) => (
                <div key={`${file.name}-${file.size}`} className="truncate rounded-lg border bg-white p-2 text-xs">
                  {file.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border p-5">
              <h2 className="text-xl font-semibold">{form.title || "Untitled property"}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {form.propertyType} Â· {form.listingType} Â· {form.locality}, {form.district}
              </p>
              <p className="mt-3 font-semibold text-emerald-900">NPR {previewPrice}</p>
              <p className="mt-4 text-sm leading-6">{form.description}</p>
              <p className="mt-4 text-sm font-semibold">{files.length} image(s) ready to upload</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Moderators verify the listing, ownership information and auction schedule before publication.
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            disabled={step === 0 || mutation.isPending}
            onClick={() => setStep((current) => current - 1)}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Back
          </button>
          <button
            disabled={mutation.isPending}
            className="brand-button flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : step === steps.length - 1 ? (
              <UploadCloud className="size-4" />
            ) : null}
            {mutation.isPending
              ? "Uploading and submittingâ€¦"
              : step === steps.length - 1
                ? "Submit property"
                : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function toMinorUnits(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid positive amount.");
  return String(Math.round(amount * 100));
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}

function optionalInteger(value: string) {
  return value.trim() ? Math.trunc(Number(value)) : undefined;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
  required = true,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className={`text-sm font-medium ${className}`}>
      {label}
      <input
        required={required}
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
}) {
  return (
    <label className={`text-sm font-medium ${className}`}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
