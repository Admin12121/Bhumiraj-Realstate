"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import {
  getAdminAccess,
  getStaffMembers,
  getStaffRbacCatalog,
  transferOwnership,
} from "@/features/admin/api/admin-api"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPanel,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PanelSection } from "./panel-layout"
import { useStepUp } from "./step-up-dialog"

/**
 * Ownership lives with platform settings, not with staff administration.
 * Transferring it is a change to what the platform *is*, not day-to-day
 * people management, and filing it under Staff sent people hunting.
 */
export function OwnerGovernancePanel() {
  const { guard } = useStepUp()
  const client = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState("")
  const [previousOwnerRoleIds, setPreviousOwnerRoleIds] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState("")

  const access = useQuery({ queryKey: ["admin", "access"], queryFn: getAdminAccess })
  const staff = useQuery({
    queryKey: ["admin", "staff", 1, ""],
    queryFn: () => getStaffMembers(1, ""),
  })
  const catalog = useQuery({
    queryKey: ["admin", "rbac", "catalog"],
    queryFn: getStaffRbacCatalog,
  })

  const manageableRoles = (catalog.data?.roles ?? []).filter(
    (role) => role.manageable,
  )

  const transfer = useMutation({
    mutationFn: () =>
      guard(() => transferOwnership(targetUserId, previousOwnerRoleIds)),
    onSuccess: async () => {
      toast.success("Ownership transferred. Both accounts were signed out.")
      setTransferOpen(false)
      setTargetUserId("")
      setPreviousOwnerRoleIds([])
      setConfirmation("")
      await client.invalidateQueries({ queryKey: ["admin"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Only the sitting owner can hand ownership on, so nobody else sees the door.
  if (access.data?.accountType !== "OWNER") return null

  const eligible = (staff.data?.items ?? []).filter(
    (member) =>
      member.accountType === "STAFF" &&
      member.membershipStatus === "ACTIVE" &&
      member.emailVerified &&
      member.twoFactorEnabled,
  )

  return (
    <PanelSection>

      <section className="rounded-xl border border-destructive/30 bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-5 text-destructive" />
              Transfer platform ownership
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Moves the single owner authority to an active staff member with a
              verified email and 2FA. Both accounts are signed out, and your
              account keeps the fallback roles you choose.
            </p>
          </div>
          <Button
            variant="destructive-outline"
            onClick={() => setTransferOpen(true)}
          >
            Transfer ownership
          </Button>
        </div>
      </section>

      <AlertDialog open={transferOpen} onOpenChange={setTransferOpen}>
        <AlertDialogPopup className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer platform ownership</AlertDialogTitle>
            <AlertDialogDescription>
              This atomically moves the single owner authority and signs out
              both accounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              transfer.mutate()
            }}
          >
            <AlertDialogPanel className="space-y-5">
              <Field>
                <FieldLabel>Eligible new owner</FieldLabel>
                {eligible.length === 0 ? (
                  <p className="rounded-xl border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                    No staff member is eligible yet. Ownership can only move to
                    an active staff account with a verified email and 2FA
                    enabled.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl border p-2">
                    {eligible.map((member) => (
                      <Button
                        key={member.id}
                        type="button"
                        variant={
                          targetUserId === member.id ? "secondary" : "ghost"
                        }
                        className="h-auto w-full justify-start text-left"
                        onClick={() => setTargetUserId(member.id)}
                      >
                        <span>
                          <span className="block">{member.name}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {member.email}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
                <FieldDescription>
                  Ineligible staff are intentionally omitted until email
                  verification and 2FA are complete.
                </FieldDescription>
              </Field>

              <div>
                <p className="mb-3 text-sm font-medium">
                  Your fallback staff roles
                </p>
                {manageableRoles.length === 0 ? (
                  <p className="rounded-xl border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                    Create at least one staff role first — you need somewhere to
                    land after handing ownership over.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {manageableRoles.map((role) => {
                      const id = `ownership-role-${role.id}`
                      return (
                        <div
                          key={role.id}
                          className="flex items-start gap-3 rounded-xl border p-3"
                        >
                          <Checkbox
                            id={id}
                            checked={previousOwnerRoleIds.includes(role.id)}
                            onCheckedChange={(checked) =>
                              setPreviousOwnerRoleIds((current) =>
                                checked
                                  ? [...new Set([...current, role.id])]
                                  : current.filter((item) => item !== role.id),
                              )
                            }
                          />
                          <Label htmlFor={id} className="cursor-pointer">
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: role.color }}
                              />
                              {role.name}
                              <Badge size="sm" variant="outline">
                                {role.position}
                              </Badge>
                            </span>
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <Field>
                <FieldLabel>Type TRANSFER OWNERSHIP to confirm</FieldLabel>
                <Input
                  name="confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                />
              </Field>
            </AlertDialogPanel>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" />}>
                Cancel
              </AlertDialogClose>
              <Button
                type="submit"
                variant="destructive"
                loading={transfer.isPending}
                disabled={
                  !targetUserId ||
                  previousOwnerRoleIds.length === 0 ||
                  confirmation !== "TRANSFER OWNERSHIP"
                }
              >
                Transfer ownership
              </Button>
            </AlertDialogFooter>
          </Form>
        </AlertDialogPopup>
      </AlertDialog>
    </PanelSection>
  )
}
