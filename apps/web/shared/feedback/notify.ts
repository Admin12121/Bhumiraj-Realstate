import { toast } from "sonner"

type NotifyOptions = { description?: string; duration?: number }

/**
 * One place to raise user-visible feedback, so every surface reports events
 * the same way. Sonner's Toaster is mounted once in AppProviders.
 */
export const notify = {
  success: (message: string, options?: NotifyOptions) =>
    toast.success(message, options),
  error: (message: string, options?: NotifyOptions) =>
    toast.error(message, options),
  warning: (message: string, options?: NotifyOptions) =>
    toast.warning(message, options),
  info: (message: string, options?: NotifyOptions) =>
    toast.info(message, options),
  /** For things the operator must acknowledge; stays until dismissed. */
  alert: (message: string, options?: NotifyOptions) =>
    toast.error(message, { duration: Infinity, ...options }),
  promise: toast.promise,
  dismiss: toast.dismiss,
}

/** Pulls a readable message out of whatever a failed call threw. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return fallback
}
