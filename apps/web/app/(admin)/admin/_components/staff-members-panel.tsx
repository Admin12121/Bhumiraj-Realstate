"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { staffMemberSchema } from "@real-estate/contracts"
import {
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserCog,
  UserRoundX,
} from "lucide-react"
import { toast } from "sonner"
import {
  createStaffMember,
  getStaffCandidates,
  getStaffMembers,
  getStaffRbacCatalog,
  revokeStaffMember,
  setStaffMemberStatus,
  setStaffMemberRoles,
} from "@/features/admin/api/admin-api"
import { useHasStaffPermission } from "./admin-shell"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminPagination } from "./admin-pagination"

type StaffMember = z.infer<typeof staffMemberSchema>

export function StaffMembersPanel() {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [revoking, setRevoking] = useState<StaffMember | null>(null)
  const [suspending, setSuspending] = useState<StaffMember | null>(null)
  const [suspensionReason, setSuspensionReason] = useState("")
  const [promoting, setPromoting] = useState(false)
  const [candidateSearch, setCandidateSearch] = useState("")
  const [debouncedCandidateSearch, setDebouncedCandidateSearch] = useState("")
  const [candidateId, setCandidateId] = useState("")
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedCandidateSearch(candidateSearch.trim()),
      300
    )
    return () => clearTimeout(timer)
  }, [candidateSearch])

  const staff = useQuery({
    queryKey: ["admin", "staff", page, debouncedSearch],
    queryFn: () => getStaffMembers(page, debouncedSearch),
    placeholderData: (previous) => previous,
  })
  const catalog = useQuery({
    queryKey: ["admin", "rbac", "catalog"],
    queryFn: getStaffRbacCatalog,
  })
  const candidates = useQuery({
    queryKey: ["admin", "staff-candidates", debouncedCandidateSearch],
    queryFn: () => getStaffCandidates(debouncedCandidateSearch),
    enabled: promoting && debouncedCandidateSearch.length >= 2,
  })
  const manageableRoles =
    catalog.data?.roles.filter(({ manageable }) => manageable) ?? []
  const canManage = useHasStaffPermission("admin.staff.manage")
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["admin", "staff"] }),
      client.invalidateQueries({ queryKey: ["admin", "rbac"] }),
    ])
  }

  const promote = useMutation({
    mutationFn: () => createStaffMember(candidateId, selectedRoleIds),
    onSuccess: async () => {
      toast.success("Customer promoted to staff. They must sign in again.")
      setPromoting(false)
      resetPromotion()
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const updateRoles = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("No staff member selected.")
      await setStaffMemberRoles(editing.id, selectedRoleIds)
    },
    onSuccess: async () => {
      toast.success("Staff roles updated.")
      setEditing(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const revoke = useMutation({
    mutationFn: (userId: string) => revokeStaffMember(userId),
    onSuccess: async () => {
      toast.success("Staff access revoked. Active sessions were terminated.")
      setRevoking(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const changeStatus = useMutation({
    mutationFn: ({
      member,
      status,
      reason,
    }: {
      member: StaffMember
      status: "ACTIVE" | "SUSPENDED"
      reason?: string
    }) => setStaffMemberStatus(member.id, status, reason),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.status === "SUSPENDED"
          ? "Staff access suspended and sessions terminated."
          : "Staff access reactivated. The member must sign in again."
      )
      setSuspending(null)
      setSuspensionReason("")
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function resetPromotion() {
    setCandidateSearch("")
    setDebouncedCandidateSearch("")
    setCandidateId("")
    setSelectedRoleIds([])
  }
  function toggleRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((current) =>
      checked
        ? [...new Set([...current, roleId])]
        : current.filter((id) => id !== roleId)
    )
  }

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-semibold">Staff members</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner is hardcoded. Staff permissions come only from their assigned
            custom roles.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              resetPromotion()
              setPromoting(true)
            }}
          >
            <Plus />
            Add staff member
          </Button>
        )}
      </div>
      <div className="border-b p-4">
        <div className="relative max-w-md">
          <Search className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search staff by name or email"
            aria-label="Search staff"
            className="[&_input]:pl-9"
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-5">Member</TableHead>
            <TableHead>Account type</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="px-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.data?.items.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="px-5 py-4">
                <p className="font-medium">{member.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.email}
                </p>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    member.accountType === "OWNER" ? "success" : "secondary"
                  }
                >
                  {member.accountType}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex max-w-sm flex-wrap gap-1.5">
                  {member.roles.length === 0 ? (
                    <span className="text-xs text-destructive">
                      No role assigned
                    </span>
                  ) : (
                    member.roles.map((role) => (
                      <Badge key={role.id} variant="outline">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    member.banned ||
                    member.lifecycleStatus !== "ACTIVE" ||
                    member.membershipStatus === "SUSPENDED"
                      ? "error"
                      : "success"
                  }
                >
                  {member.banned
                    ? "ACCOUNT SUSPENDED"
                    : (member.membershipStatus ?? member.lifecycleStatus)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(member.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="px-5 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!member.manageable}
                    onClick={() => {
                      setSelectedRoleIds(member.roleIds)
                      setEditing(member)
                    }}
                  >
                    <Pencil />
                    Roles
                  </Button>
                  {member.accountType === "STAFF" &&
                    (member.membershipStatus === "SUSPENDED" ? (
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!member.manageable || changeStatus.isPending}
                        aria-label={`Reactivate staff access for ${member.email}`}
                        onClick={() =>
                          changeStatus.mutate({ member, status: "ACTIVE" })
                        }
                      >
                        <PlayCircle />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!member.manageable}
                        aria-label={`Suspend staff access for ${member.email}`}
                        onClick={() => {
                          setSuspensionReason("")
                          setSuspending(member)
                        }}
                      >
                        <UserRoundX />
                      </Button>
                    ))}
                  <Button
                    size="icon"
                    variant="destructive-outline"
                    disabled={!member.manageable}
                    aria-label={`Revoke staff access for ${member.email}`}
                    onClick={() => setRevoking(member)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {(staff.isPending ||
            staff.isError ||
            staff.data?.items.length === 0) && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="p-10 text-center text-muted-foreground"
              >
                {staff.isPending
                  ? "Loading staff…"
                  : staff.isError
                    ? "Staff could not be loaded."
                    : "No staff members match this search."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AdminPagination
        page={staff.data?.page ?? page}
        pageCount={staff.data?.pageCount ?? 1}
        onPage={setPage}
      />

      <Dialog
        open={promoting}
        onOpenChange={(open) => {
          setPromoting(open)
          if (!open) resetPromotion()
        }}
      >
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              Choose an existing active customer. Their sessions will be revoked
              after promotion.
            </DialogDescription>
          </DialogHeader>
          <Form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              promote.mutate()
            }}
            className="contents"
          >
            <DialogPanel className="space-y-5">
              <Field>
                <FieldLabel>Find customer</FieldLabel>
                <Input
                  value={candidateSearch}
                  onChange={(event) => {
                    setCandidateSearch(event.target.value)
                    setCandidateId("")
                  }}
                  placeholder="Search by name or email"
                  minLength={2}
                />
                <FieldDescription>
                  Agents cannot be promoted directly to staff.
                </FieldDescription>
              </Field>
              {debouncedCandidateSearch.length >= 2 && (
                <div className="space-y-2 rounded-xl border p-2">
                  {candidates.isPending ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      Searching…
                    </p>
                  ) : candidates.data?.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No active customers found.
                    </p>
                  ) : (
                    candidates.data?.map((candidate) => (
                      <Button
                        key={candidate.id}
                        type="button"
                        variant={
                          candidateId === candidate.id ? "secondary" : "ghost"
                        }
                        className="h-auto w-full justify-start px-3 py-2 text-left"
                        onClick={() => setCandidateId(candidate.id)}
                      >
                        <span>
                          <span className="block">{candidate.name}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {candidate.email}
                          </span>
                        </span>
                      </Button>
                    ))
                  )}
                </div>
              )}
              <RoleChecklist
                roles={manageableRoles}
                selected={selectedRoleIds}
                onToggle={toggleRole}
              />
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                loading={promote.isPending}
                disabled={!candidateId || selectedRoleIds.length === 0}
              >
                <UserCog />
                Promote to staff
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Manage roles for {editing?.name}</DialogTitle>
            <DialogDescription>
              Effective permissions are the union of all selected roles.
            </DialogDescription>
          </DialogHeader>
          <Form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              updateRoles.mutate()
            }}
            className="contents"
          >
            <DialogPanel>
              <RoleChecklist
                roles={manageableRoles}
                selected={selectedRoleIds}
                onToggle={toggleRole}
              />
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                loading={updateRoles.isPending}
                disabled={selectedRoleIds.length === 0}
              >
                Save roles
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke staff access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking?.email} will become a customer, lose all staff roles,
              and be signed out from every active session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              loading={revoke.isPending}
              onClick={() => revoking && revoke.mutate(revoking.id)}
            >
              Revoke access
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      <Dialog
        open={Boolean(suspending)}
        onOpenChange={(open) => {
          if (!open) {
            setSuspending(null)
            setSuspensionReason("")
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Suspend staff access?</DialogTitle>
            <DialogDescription>
              {suspending?.email} will lose administration access immediately
              and all active sessions will be terminated. The account remains a
              staff account until reactivated or revoked.
            </DialogDescription>
          </DialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              if (suspending) {
                changeStatus.mutate({
                  member: suspending,
                  status: "SUSPENDED",
                  reason: suspensionReason,
                })
              }
            }}
          >
            <DialogPanel>
              <Field>
                <FieldLabel>Suspension reason</FieldLabel>
                <Textarea
                  name="reason"
                  value={suspensionReason}
                  onChange={(event) => setSuspensionReason(event.target.value)}
                  minLength={3}
                  maxLength={500}
                  required
                />
              </Field>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                variant="destructive"
                loading={changeStatus.isPending}
                disabled={suspensionReason.trim().length < 3}
              >
                Suspend access
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>
    </section>
  )
}

function RoleChecklist({
  roles,
  selected,
  onToggle,
}: {
  roles: Array<{
    id: string
    name: string
    description: string | null
    color: string
    position: number
  }>
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium">Staff roles</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const id = `staff-role-${role.id}`
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
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  {role.name}
                  <Badge size="sm" variant="outline">
                    {role.position}
                  </Badge>
                </span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {role.description || "No description"}
                </span>
              </Label>
            </div>
          )
        })}
      </div>
      {roles.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No manageable roles are available. Create a lower-position role first.
        </p>
      )}
    </div>
  )
}
