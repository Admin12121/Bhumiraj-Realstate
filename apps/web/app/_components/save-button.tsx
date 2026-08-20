"use client"

import { usePathname, useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Heart } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { useSession } from "@real-estate/auth/client"
import { apiRequest } from "@/shared/http/api"
import { queryKeys } from "@/shared/query/query-keys"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/shared/http/error-message";

const favoriteResponseSchema = z.object({ saved: z.boolean() })

/**
 * The one save control for the whole app. Saving requires a session, so an
 * anonymous click routes to sign-in and returns to the page it started on.
 */
export function SaveButton({
  listingId,
  initialSaved = false,
  className,
  iconClassName,
  label,
}: {
  /** Absent for sample listings, which have no database row to save against. */
  listingId?: string | undefined
  initialSaved?: boolean
  className?: string
  iconClassName?: string
  label?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const session = useSession()
  const queryClient = useQueryClient()

  const favorite = useMutation({
    mutationFn: (shouldSave: boolean) =>
      apiRequest(`/favorites/${listingId}`, {
        method: shouldSave ? "POST" : "DELETE",
        schema: favoriteResponseSchema,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.listings.all })
      void queryClient.invalidateQueries({ queryKey: ["favorites"] })
      toast.success(
        result.saved ? "Property saved" : "Removed from saved properties",
      )
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const saved = favorite.data?.saved ?? initialSaved

  function handleClick(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (!session.data) {
      router.push(`/sign-in?callbackURL=${encodeURIComponent(pathname)}`)
      return
    }
    if (!listingId) {
      toast.info("Sample properties cannot be saved.")
      return
    }
    favorite.mutate(!saved)
  }

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved properties" : "Save property"}
      aria-pressed={saved}
      onClick={handleClick}
      disabled={favorite.isPending}
      className={cn("disabled:opacity-60", className)}
    >
      <Heart
        className={cn(
          "size-4",
          saved ? "fill-red-500 text-red-500" : "",
          iconClassName,
        )}
        strokeWidth={1.8}
      />
      {label}
    </button>
  )
}
