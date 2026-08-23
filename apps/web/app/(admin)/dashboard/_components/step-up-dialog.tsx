"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import Link from "next/link"
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { authClient } from "@real-estate/auth/client"
import { HttpError } from "@real-estate/http"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const STEP_UP_CODES = new Set([
  "STAFF_STEP_UP_REQUIRED",
  "STAFF_FRESH_SESSION_REQUIRED",
])

export function isStepUpError(error: unknown): boolean {
  return error instanceof HttpError && STEP_UP_CODES.has(error.code)
}

type Method = "choose" | "totp" | "backup"

/** Thrown when the operator closes the step-up prompt instead of confirming. */
export class StepUpCancelledError extends Error {
  constructor() {
    super("Confirmation cancelled.")
    this.name = "StepUpCancelledError"
  }
}

type StepUpContextValue = {
  /**
   * Runs an action, and if the server asks for step-up, prompts for a second
   * factor and runs it again once confirmed. Resolves with the action's own
   * result so callers keep their types; rejects if the operator cancels.
   */
  guard: <T>(action: () => Promise<T>) => Promise<T>
}

const StepUpContext = createContext<StepUpContextValue>({
  guard: (action) => action(),
})

export function useStepUp(): StepUpContextValue {
  return useContext(StepUpContext)
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingAction] = useState<{
    run: () => Promise<unknown>
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
  } | null>(null)
  const [method, setMethod] = useState<Method>("choose")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    setPendingAction(null)
    setMethod("choose")
    setCode("")
    setBusy(false)
  }, [])

  const guard = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action()
    } catch (error) {
      if (!isStepUpError(error)) throw error
      return new Promise<T>((resolve, reject) => {
        setPendingAction({
          run: action,
          resolve: resolve as (value: unknown) => void,
          reject,
        })
      })
    }
  }, [])

  async function afterConfirmed() {
    if (!pendingAction) return
    try {
      const result = await pendingAction.run()
      pendingAction.resolve(result)
      close()
    } catch (error) {
      setBusy(false)
      pendingAction.reject(error)
      close()
    }
  }

  async function confirmWithPasskey() {
    setBusy(true)
    const result = await authClient.signIn.passkey()
    if (result?.error) {
      setBusy(false)
      return toast.error(result.error.message || "Passkey confirmation failed.")
    }
    await afterConfirmed()
  }

  async function confirmWithCode() {
    setBusy(true)
    const result =
      method === "backup"
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code })
    if (result?.error) {
      setBusy(false)
      return toast.error(result.error.message || "That code was not accepted.")
    }
    await afterConfirmed()
  }

  return (
    <StepUpContext.Provider value={{ guard }}>
      {children}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            pendingAction?.reject(new StepUpCancelledError())
            close()
          }
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Confirm it&apos;s you</DialogTitle>
              <DialogDescription>
                This action changes platform authority, so it needs a second
                factor. Pick whichever you have to hand.
              </DialogDescription>
            </DialogHeader>

            {method === "choose" ? (
              <div className="space-y-2">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  loading={busy}
                  onClick={confirmWithPasskey}
                >
                  <Fingerprint />
                  Use a passkey
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => setMethod("totp")}
                >
                  <ShieldCheck />
                  Enter an authenticator code
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => setMethod("backup")}
                >
                  <KeyRound />
                  Use a backup code
                </Button>
                <p className="pt-2 text-xs text-muted-foreground">
                  Nothing set up yet?{" "}
                  <Link
                    href="/dashboard/account"
                    className="font-semibold text-emerald-700"
                  >
                    Add a passkey or authenticator
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <Field>
                <FieldLabel htmlFor="step-up-code">
                  {method === "backup" ? "Backup code" : "Authenticator code"}
                </FieldLabel>
                <Input
                  id="step-up-code"
                  autoFocus
                  value={code}
                  inputMode={method === "backup" ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  onChange={(event) => setCode(event.target.value)}
                />
                <FieldDescription>
                  <button
                    type="button"
                    className="font-semibold text-emerald-700"
                    onClick={() => {
                      setMethod("choose")
                      setCode("")
                    }}
                  >
                    Try another way
                  </button>
                </FieldDescription>
              </Field>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  pendingAction?.reject(new StepUpCancelledError())
                  close()
                }}
              >
                Cancel
              </Button>
              {method !== "choose" && (
                <Button
                  loading={busy}
                  disabled={code.trim().length < 6}
                  onClick={confirmWithCode}
                >
                  Confirm
                </Button>
              )}
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </StepUpContext.Provider>
  )
}
