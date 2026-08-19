"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, MailPlus, ShieldAlert, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  createStaffInvitation,
  getAdminAccess,
  getStaffInvitations,
  getStaffMembers,
  getStaffRbacCatalog,
  revokeStaffInvitation,
  transferOwnership,
} from "@/features/admin/api/admin-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useStepUp } from "./step-up-dialog"
import { PanelHeading, PanelRecords, PanelSection } from "./panel-layout"

export function StaffGovernancePanel() {
  const { guard } = useStepUp()
  const client = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [inviteLink, setInviteLink] = useState("")
  const [revokingInvitationId, setRevokingInvitationId] = useState<
    string | null
  >(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState("")
  const [previousOwnerRoleIds, setPreviousOwnerRoleIds] = useState<string[]>([])
  const [confirmation, setConfirmation] = useState("")

  const access = useQuery({
    queryKey: ["admin", "access"],
    queryFn: getAdminAccess,
  })
  const catalog = useQuery({
    queryKey: ["admin", "rbac", "catalog"],
    queryFn: getStaffRbacCatalog,
  })
  const invitations = useQuery({
    queryKey: ["admin", "staff-invitations"],
    queryFn: () => getStaffInvitations(1),
  })
  const staff = useQuery({
    queryKey: ["admin", "staff", "owner-transfer"],
    queryFn: () => getStaffMembers(1, "", 100),
    enabled: access.data?.accountType === "OWNER",
  })
  const manageableRoles =
    catalog.data?.roles.filter((role) => role.manageable) ?? []

  const invite = useMutation({
    mutationFn: () => guard(() => createStaffInvitation(email, roleIds)),
    onSuccess: async (result) => {
      setInviteLink(result.inviteLink)
      toast.success(
        result.delivery === "SENT"
          ? "Staff invitation sent."
          : "Invitation created. Copy the secure link to deliver it manually."
      )
      await client.invalidateQueries({
        queryKey: ["admin", "staff-invitations"],
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => guard(() => revokeStaffInvitation(id)),
    onSuccess: async () => {
      setRevokingInvitationId(null)
      toast.success("Staff invitation revoked.")
      await client.invalidateQueries({
        queryKey: ["admin", "staff-invitations"],
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const transfer = useMutation({
    mutationFn: () =>
      guard(() => transferOwnership(targetUserId, previousOwnerRoleIds)),
    onSuccess: () => location.assign("/sign-in"),
    onError: (error: Error) => toast.error(error.message),
  })

  function toggleRole(id: string, checked: boolean, ownerTransfer = false) {
    const setter = ownerTransfer ? setPreviousOwnerRoleIds : setRoleIds
    setter((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((roleId) => roleId !== id)
    )
  }

  return (
    <div className="space-y-6">
      <PanelSection>
        <PanelHeading
          title="Staff invitations"
          description="Invitations expire after seven days and can be accepted only by the matching verified email."
          actions={
          <Button
            onClick={() => {
              setEmail("")
              setRoleIds([])
              setInviteLink("")
              setInviteOpen(true)
            }}
          >
            <MailPlus />
            Invite staff
          </Button>
          }
        />

        <PanelRecords>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="w-56">Roles</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-40">Expires</TableHead>
              <TableHead className="w-32 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.data?.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.roles.map((role) => (
                      <Badge key={role.id} variant="outline">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === "PENDING" ? "warning" : "secondary"
                    }
                  >
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(item.expiresAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="destructive-outline"
                    disabled={item.status !== "PENDING"}
                    aria-label={`Revoke invitation for ${item.email}`}
                    onClick={() => setRevokingInvitationId(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(invitations.isPending ||
              invitations.data?.items.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="p-8 text-center text-muted-foreground"
                >
                  {invitations.isPending
                    ? "Loading invitations…"
                    : "No staff invitations yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </PanelRecords>
      </PanelSection>

      {access.data?.accountType === "OWNER" && (
        <section className="rounded-xl border border-destructive/30 bg-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="size-5 text-destructive" /> Owner
                governance
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Transfer the single owner authority to an active staff member
                with verified email and 2FA. Both accounts will be signed out
                and your account will receive the selected fallback roles.
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
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invite a staff member</DialogTitle>
            <DialogDescription>
              The recipient may sign up as a customer first, then accept using
              this exact email.
            </DialogDescription>
          </DialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              invite.mutate()
            }}
          >
            <DialogPanel className="space-y-5">
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <RoleChoices
                roles={manageableRoles}
                selected={roleIds}
                onToggle={(id, checked) => toggleRole(id, checked)}
              />
              {inviteLink && (
                <Alert variant="success">
                  <MailPlus />
                  <AlertTitle>Invitation ready</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={inviteLink}
                        readOnly
                        aria-label="Invitation link"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Copy invitation link"
                        onClick={() =>
                          void navigator.clipboard.writeText(inviteLink)
                        }
                      >
                        <Copy />
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Close
              </DialogClose>
              <Button
                type="submit"
                loading={invite.isPending}
                disabled={!email.trim() || roleIds.length === 0}
              >
                Create invitation
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={Boolean(revokingInvitationId)}
        onOpenChange={(open) => !open && setRevokingInvitationId(null)}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invitation link will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              loading={revoke.isPending}
              onClick={() =>
                revokingInvitationId && revoke.mutate(revokingInvitationId)
              }
            >
              Revoke invitation
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

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
                <div className="space-y-2 rounded-xl border p-2">
                  {staff.data?.items
                    .filter(
                      (member) =>
                        member.accountType === "STAFF" &&
                        member.membershipStatus === "ACTIVE" &&
                        member.emailVerified &&
                        member.twoFactorEnabled
                    )
                    .map((member) => (
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
                <FieldDescription>
                  Ineligible staff are intentionally omitted until email
                  verification and 2FA are complete.
                </FieldDescription>
              </Field>
              <RoleChoices
                title="Your fallback staff roles"
                roles={manageableRoles}
                selected={previousOwnerRoleIds}
                onToggle={(id, checked) => toggleRole(id, checked, true)}
              />
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
    </div>
  )
}

function RoleChoices({
  title = "Staff roles",
  roles,
  selected,
  onToggle,
}: {
  title?: string
  roles: Array<{ id: string; name: string; color: string; position: number }>
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const id = `governance-role-${title}-${role.id}`
          return (
            <div
              key={role.id}
              className="flex items-start gap-3 rounded-xl border p-3"
            >
              <Checkbox
                id={id}
                checked={selected.includes(role.id)}
                onCheckedChange={(checked) => onToggle(role.id, checked)}
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
    </div>
  )
}
