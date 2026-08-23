"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check, UploadCloud } from "lucide-react";
import { useSession } from "@real-estate/auth/client";
import {
  createListingSchema,
  listingTypeSchema,
  propertyTypeSchema,
  rentPeriodSchema,
  FURNISHING_LEVELS,
  LOCATION_PRECISIONS,
} from "@real-estate/contracts";
import { createListing, submitListing } from "@/features/listings/api/listings-api";
import { uploadPropertyImage } from "@/features/media/api/media-api";
import { toast } from "sonner";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/ui/file-uploader";
import { useFileUpload } from "@/hooks/use-file-upload";
import { LocationPicker } from "./location-picker";
import { errorMessage } from "@/shared/http/error-message";
import { cn } from "@/lib/utils";
import {
  PropertyPost,
  type PropertyPostData,
} from "@/app/_components/property-post";
import { formatMinorAmount } from "@/shared/utilities/money";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const steps = ["Property", "Location", "Details", "Images", "Post"];

const option = (value: string) => ({ value, label: value.replace(/_/g, " ") });

// Derived from the contract, never retyped. A hand-written copy of this list is
// how the form came to offer FLAT, BUSINESS and SHOP — three values the API
// rejects, and only after every photo had already been uploaded.
const LISTING_TYPES = listingTypeSchema.options.map(option);
const PROPERTY_TYPES = propertyTypeSchema.options.map(option);
const RENT_PERIODS = rentPeriodSchema.options.map(option);
const PRECISIONS = LOCATION_PRECISIONS.map(option);
const FURNISHINGS = FURNISHING_LEVELS.map(option);

type SpecField = {
  key: keyof FormState;
  label: string;
  required?: boolean;
};
type AuctionField = {
  key: keyof FormState;
  label: string;
  type: string;
  optional?: boolean;
};

const SPEC_FIELDS: readonly SpecField[] = [
  { key: "bedrooms", label: "Bedrooms" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "kitchens", label: "Kitchens" },
  { key: "floors", label: "Floors" },
  { key: "areaSqFt", label: "Area (sq. ft.)", required: true },
  { key: "parkingSpaces", label: "Parking spaces" },
  { key: "builtYear", label: "Built year" },
] satisfies readonly SpecField[];

const AUCTION_FIELDS: readonly AuctionField[] = [
  { key: "auctionStartingAmount", label: "Starting amount (NPR)", type: "number" },
  {
    key: "auctionReserveAmount",
    label: "Reserve amount (NPR)",
    type: "number",
    optional: true,
  },
  {
    key: "auctionMinimumIncrement",
    label: "Minimum increment (NPR)",
    type: "number",
  },
  { key: "auctionStartsAt", label: "Starts at", type: "datetime-local" },
  { key: "auctionEndsAt", label: "Ends at", type: "datetime-local" },
  {
    key: "auctionExtensionWindow",
    label: "Extension window (seconds)",
    type: "number",
  },
  {
    key: "auctionExtensionDuration",
    label: "Extension duration (seconds)",
    type: "number",
  },
  {
    key: "auctionMaximumExtension",
    label: "Maximum extension (minutes)",
    type: "number",
  },
] satisfies readonly AuctionField[];

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
type Errors = Partial<Record<keyof FormState | "images", string>>;

/**
 * The rules the API enforces, checked next to the field they belong to.
 *
 * Submitting first and reporting afterwards is what produced a wall of
 * validation text on the last step for a title typed on the first one.
 */
function validateStep(
  step: number,
  form: FormState,
  imageCount: number,
): Errors {
  const errors: Errors = {};
  const isAuction = form.listingType === "AUCTION";

  if (step === 0) {
    if (form.title.trim().length < 10) {
      errors.title = "Give the listing a title of at least 10 characters.";
    }
    if (form.description.trim().length < 50) {
      errors.description =
        "Describe the property in at least 50 characters so buyers know what it is.";
    }
    if (isAuction) {
      if (!form.auctionStartingAmount) {
        errors.auctionStartingAmount = "Set the amount bidding starts at.";
      }
    } else if (!form.price) {
      errors.price = "Enter the asking price.";
    }
  }

  if (step === 1) {
    if (form.province.trim().length < 2) errors.province = "Choose a province.";
    if (form.district.trim().length < 2) errors.district = "Choose a district.";
    if (form.municipality.trim().length < 2) {
      errors.municipality = "Enter the municipality.";
    }
    if (form.locality.trim().length < 2) {
      errors.locality = "Enter the locality or tole.";
    }
  }

  if (step === 2) {
    if (!form.areaSqFt || Number(form.areaSqFt) <= 0) {
      errors.areaSqFt = "Enter the area in square feet.";
    }
    if (isAuction) {
      if (!form.auctionEndsAt || !form.auctionStartsAt) {
        errors.auctionEndsAt = "Set when the auction starts and ends.";
      } else if (
        new Date(form.auctionEndsAt) <= new Date(form.auctionStartsAt)
      ) {
        errors.auctionEndsAt = "The auction must end after it starts.";
      }
    }
  }

  if (step === 3 && imageCount === 0) {
    errors.images = "Add at least one photo of the property.";
  }

  return errors;
}

export function PostPropertyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  // How far the form has been validated, so the stepper can offer those steps
  // without letting anyone skip ahead past an incomplete one.
  const [reached, setReached] = useState(0);
  const [uploaded, setUploaded] = useState(0);

  const MAX_IMAGES = 20;
  const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const [
    { files: uploads, isDragging, errors: uploadErrors },
    upload,
  ] = useFileUpload({
    accept: "image/jpeg,image/png,image/webp,image/avif",
    maxFiles: MAX_IMAGES,
    maxSize: MAX_IMAGE_BYTES,
  });
  const files = uploads.map((item) => item.file);

  const isAuction = form.listingType === "AUCTION";
  const isRent = form.listingType === "RENT";
  const session = useSession();

  /** The form state shaped as the post the marketplace feed will render. */
  const previewPost: PropertyPostData = useMemo(() => {
    const amount = isAuction ? form.auctionStartingAmount : form.price;
    const user = session.data?.user;
    return {
      slug: "preview",
      title: form.title || "Untitled property",
      description: form.description,
      // Every photo, in the order they were added: the first is the cover and
      // the rest are what the carousel pages through.
      images: uploads.map((item) => item.preview),
      agent: {
        name: user?.name ?? "Bhumiraj Estates",
        image: user?.image ?? null,
        verified: false,
      },
      publishedAt: new Date().toISOString(),
      ...(amount
        ? { price: formatMinorAmount(toMinorUnits(amount), "NPR") }
        : {}),
      location: `${form.locality} | ${form.district}`,
      propertyType: form.propertyType,
      ...(form.areaSqFt
        ? { area: `${Number(form.areaSqFt).toLocaleString()} sq ft` }
        : {}),
      category: isRent ? "For rent" : "For sale",
      ...(form.latitude ? { latitude: Number(form.latitude) } : {}),
      ...(form.longitude ? { longitude: Number(form.longitude) } : {}),
    };
  }, [form, isAuction, isRent, session.data?.user, uploads]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Add at least one property image.");

      // Uploading one at a time meant waiting for each scan and re-encode in
      // turn, so five photos took minutes. A small pool keeps order while
      // overlapping the waiting, without flooding the scanner.
      setUploaded(0);
      const mediaAssetIds: string[] = new Array(files.length);
      let next = 0;
      const worker = async () => {
        while (true) {
          const index = next;
          next += 1;
          if (index >= files.length) return;
          mediaAssetIds[index] = await uploadPropertyImage(files[index]!);
          setUploaded((current) => current + 1);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, files.length) }, worker),
      );

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
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Clearing as they type stops a message sitting under a field they fixed.
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  /** Validates every step up to `target`, stopping at the first that fails. */
  function goTo(target: number) {
    if (target <= step) {
      setErrors({});
      setStep(target);
      return;
    }
    for (let index = step; index < target; index += 1) {
      const found = validateStep(index, form, files.length);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(index);
        return;
      }
    }
    setErrors({});
    setReached((current) => Math.max(current, target));
    setStep(target);
  }

  return (
    <div>
      <nav aria-label="Progress" className="flex gap-2 overflow-x-auto pb-6">
        {steps.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                // Only steps already cleared are reachable; the rest would jump
                // over validation that has not run yet.
                disabled={index > reached || mutation.isPending}
                onClick={() => goTo(index)}
                className="flex min-w-0 items-center gap-2 rounded-md text-start focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border font-medium text-xs transition-colors",
                    done || current
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-sm sm:block",
                    current ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span aria-hidden className="h-px flex-1 bg-border" />
              ) : null}
            </div>
          );
        })}
      </nav>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const found = validateStep(step, form, files.length);
          if (Object.keys(found).length > 0) {
            setErrors(found);
            return;
          }
          if (step < steps.length - 1) goTo(step + 1);
          else mutation.mutate();
        }}
      >
        {step === 0 && (
          <Fieldset>
            <FieldGroup>
              <Field invalid={Boolean(errors.title)}>
                <FieldLabel htmlFor="listing-title">Listing title</FieldLabel>
                <Input
                  id="listing-title"
                  value={form.title}
                  onChange={(event) => set("title", event.target.value)}
                  placeholder="Modern 4BHK house in Bhaisepati"
                  maxLength={140}
                />
              <FieldError match>{errors.title}</FieldError>
                </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="listing-type">Listing type</FieldLabel>
                  <Select
                    items={LISTING_TYPES}
                    value={form.listingType}
                    onValueChange={(value) => set("listingType", String(value))}
                  >
                    <SelectTrigger id="listing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {LISTING_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="property-type">Property type</FieldLabel>
                  <Select
                    items={PROPERTY_TYPES}
                    value={form.propertyType}
                    onValueChange={(value) => set("propertyType", String(value))}
                  >
                    <SelectTrigger id="property-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {PROPERTY_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
              </div>

              {!isAuction && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field invalid={Boolean(errors.price)}>
                    <FieldLabel htmlFor="listing-price">
                      {isRent ? "Rent (NPR)" : "Price (NPR)"}
                    </FieldLabel>
                    <Input
                      id="listing-price"
                      type="number"
                      min={1}
                      value={form.price}
                      onChange={(event) => set("price", event.target.value)}
                    />
                  <FieldError match>{errors.price}</FieldError>
                </Field>

                  {isRent && (
                    <Field>
                      <FieldLabel htmlFor="rent-period">Rent period</FieldLabel>
                      <Select
                        items={RENT_PERIODS}
                        value={form.rentPeriod}
                        onValueChange={(value) =>
                          set("rentPeriod", String(value))
                        }
                      >
                        <SelectTrigger id="rent-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                          {RENT_PERIODS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </Field>
                  )}
                </div>
              )}

              <Field invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="listing-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="listing-description"
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  rows={6}
                  placeholder="Describe the property, neighbourhood, access and important conditions."
                />
                <FieldDescription>
                  Buyers read this first. Mention what a photo cannot show.
                </FieldDescription>
              <FieldError match>{errors.description}</FieldError>
                </Field>
            </FieldGroup>
          </Fieldset>
        )}

        {step === 1 && (
          <Fieldset>
            <FieldGroup>
              <LocationPicker
                province={form.province}
                district={form.district}
                latitude={form.latitude}
                longitude={form.longitude}
                onProvinceChange={(value) => set("province", value)}
                onDistrictChange={(value) => set("district", value)}
                onPointChange={(latitude, longitude) =>
                  setForm((current) => ({ ...current, latitude, longitude }))
                }
              />

              <FieldSeparator />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field invalid={Boolean(errors.municipality)}>
                  <FieldLabel htmlFor="municipality">Municipality</FieldLabel>
                  <Input
                    id="municipality"
                    value={form.municipality}
                    onChange={(event) =>
                      set("municipality", event.target.value)
                    }
                  />
                <FieldError match>{errors.municipality}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ward">Ward</FieldLabel>
                  <Input
                    id="ward"
                    value={form.ward}
                    onChange={(event) => set("ward", event.target.value)}
                  />
                </Field>
                <Field invalid={Boolean(errors.locality)}>
                  <FieldLabel htmlFor="locality">Locality</FieldLabel>
                  <Input
                    id="locality"
                    value={form.locality}
                    onChange={(event) => set("locality", event.target.value)}
                  />
                <FieldError match>{errors.locality}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="street">Street</FieldLabel>
                  <Input
                    id="street"
                    value={form.street}
                    onChange={(event) => set("street", event.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="precision">
                  Public map precision
                </FieldLabel>
                <Select
                  items={PRECISIONS}
                  value={form.publicLocationPrecision}
                  onValueChange={(value) =>
                    set("publicLocationPrecision", String(value))
                  }
                >
                  <SelectTrigger id="precision">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {PRECISIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <FieldDescription>
                  Exact coordinates stay private unless you choose exact public
                  precision.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </Fieldset>
        )}

        {step === 2 && (
          <div className="grid gap-8">
            <Fieldset>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-3">
                  {SPEC_FIELDS.map((spec) => (
                    <Field key={spec.key} invalid={Boolean(errors[spec.key])}>
                      <FieldLabel htmlFor={`spec-${spec.key}`}>
                        {spec.label}
                      </FieldLabel>
                      <Input
                        id={`spec-${spec.key}`}
                        type="number"
                        min={0}
                        value={form[spec.key]}
                        onChange={(event) => set(spec.key, event.target.value)}
                      />
                      <FieldError match>{errors[spec.key]}</FieldError>
                    </Field>
                  ))}
                  <Field>
                    <FieldLabel htmlFor="furnishing">Furnishing</FieldLabel>
                    <Select
                      items={FURNISHINGS}
                      value={form.furnishing}
                      onValueChange={(value) =>
                        set("furnishing", String(value))
                      }
                    >
                      <SelectTrigger id="furnishing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        {FURNISHINGS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </Fieldset>

            {isAuction && (
              <>
                <FieldSeparator />
                <Fieldset>
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {AUCTION_FIELDS.map((auction) => (
                        <Field
                          key={auction.key}
                          invalid={Boolean(errors[auction.key])}
                        >
                          <FieldLabel htmlFor={`auction-${auction.key}`}>
                            {auction.label}
                          </FieldLabel>
                          <Input
                            id={`auction-${auction.key}`}
                            type={auction.type}
                            value={form[auction.key]}
                            onChange={(event) =>
                              set(auction.key, event.target.value)
                            }
                          />
                          <FieldError match>{errors[auction.key]}</FieldError>
                        </Field>
                      ))}
                    </div>
                  </FieldGroup>
                </Fieldset>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <Fieldset>
            <FieldGroup>
              <FileUploader
                title="Select property images"
                files={uploads}
                isDragging={isDragging}
                errors={uploadErrors}
                inputProps={upload.getInputProps()}
                maxFiles={MAX_IMAGES}
                maxSize={MAX_IMAGE_BYTES}
                onOpen={upload.openFileDialog}
                onRemove={upload.removeFile}
                onClear={upload.clearFiles}
                onDragEnter={upload.handleDragEnter}
                onDragLeave={upload.handleDragLeave}
                onDragOver={upload.handleDragOver}
                onDrop={upload.handleDrop}
              />
              {errors.images ? (
                <p className="text-destructive-foreground text-xs" role="alert">
                  {errors.images}
                </p>
              ) : null}
            </FieldGroup>
          </Fieldset>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {/* The real card, not a summary: the seller checks how the listing
                will actually look on the marketplace before posting it. */}
            {/* The real feed post, with the byline dropped: the seller is
                checking their listing, not who is posting it. */}
            <div className="mx-auto w-full max-w-2xl">
              <PropertyPost preview showAgent={false} post={previewPost} />
            </div>
            <Alert>
              <AlertDescription>
                Moderators verify the listing, ownership information and auction
                schedule before publication.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || mutation.isPending}
            onClick={() => goTo(step - 1)}
          >
            Back
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {step === steps.length - 1 ? <UploadCloud /> : null}
            {mutation.isPending
              ? uploaded < files.length
                ? `Uploading ${uploaded + 1} of ${files.length}…`
                : "Publishing…"
              : step === steps.length - 1
                ? "Post property"
                : "Continue"}
          </Button>
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
