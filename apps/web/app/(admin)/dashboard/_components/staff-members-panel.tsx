"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { staffMemberSchema } from "@real-estate/contracts"
import {
  ArrowLeft,
  EllipsisVertical,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  UserCog,
  UserRoundX,
  UsersRound,
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
import { useStepUp } from "./step-up-dialog"
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
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
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
import { TablePagination } from "@/components/ui/table-pagination"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  PanelEmptyRow,
  PanelRecords,
  PanelSearch,
  PanelSection,
  PanelToolbar,
  PanelToolbarSpacer,
} from "./panel-layout"
import { errorMessage } from "@/shared/http/error-message";

type StaffMember = z.infer<typeof staffMemberSchema>

export function StaffMembersPanel({
  listFooter,
}: {
  /** Rendered under the list; hidden while the editor owns the screen. */
  listFooter?: ReactNode
} = {}) {
  const { guard } = useStepUp()
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
  const [listTab, setListTab] = useState("members")
  const [editorTab, setEditorTab] = useState<"overview" | "roles" | "access">(
    "overview",
  )

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
    mutationFn: () => guard(() => createStaffMember(candidateId, selectedRoleIds)),
    onSuccess: async () => {
      toast.success("Customer promoted to staff. They must sign in again.")
      setPromoting(false)
      resetPromotion()
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })
  const updateRoles = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("No staff member selected.")
      const member = editing
      await guard(() => setStaffMemberRoles(member.id, selectedRoleIds))
    },
    onSuccess: async () => {
      toast.success("Staff roles updated.")
      setEditing(null)
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })
  const revoke = useMutation({
    mutationFn: (userId: string) => guard(() => revokeStaffMember(userId)),
    onSuccess: async () => {
      toast.success("Staff access revoked. Active sessions were terminated.")
      setRevoking(null)
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
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
    }) => guard(() => setStaffMemberStatus(member.id, status, reason)),
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
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  function openEditor(member: StaffMember) {
    setSelectedRoleIds(member.roleIds)
    setEditing(member)
    setEditorTab("overview")
  }

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

  const dialogs = (
    <>
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
    </>
  )

  const members = staff.data?.items ?? []

  if (editing) {
    const member = editing
    const roleNames = manageableRoles
      .filter((role) => selectedRoleIds.includes(role.id))
      .map((role) => role.name)

    return (
      <>
        <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden border-t bg-background">
          <div className="flex w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground max-md:hidden">
            <div className="flex h-12 shrink-0 items-center justify-between border-b p-3">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Back to staff"
                onClick={() => setEditing(null)}
              >
                <ArrowLeft />
              </Button>
              {canManage ? (
                <Button
                  size="icon-sm"
                  aria-label="Add staff member"
                  onClick={() => {
                    resetPromotion()
                    setPromoting(true)
                  }}
                >
                  <Plus />
                </Button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground select-none">
                Staff
              </p>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {members.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openEditor(row)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        row.id === member.id
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-semibold uppercase">
                        {(row.name || "?").slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Back to staff"
                  className="md:hidden"
                  onClick={() => setEditing(null)}
                >
                  <ArrowLeft />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
              </div>
              <Badge
                size="sm"
                variant={
                  member.membershipStatus === "SUSPENDED" ? "error" : "success"
                }
              >
                {member.membershipStatus ?? member.lifecycleStatus}
              </Badge>
            </div>

            <Tabs
              value={editorTab}
              onValueChange={(value) =>
                setEditorTab(value as "overview" | "roles" | "access")
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="shrink-0 p-2">
                <TabsList className="w-full">
                  <TabsTab value="overview">Overview</TabsTab>
                  <TabsTab value="roles">Roles ({selectedRoleIds.length})</TabsTab>
                  <TabsTab value="access">Access</TabsTab>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <TabsPanel value="overview">
                  <dl className="grid gap-4 p-4 sm:grid-cols-2">
                    {[
                      ["Account type", member.accountType],
                      [
                        "Membership",
                        member.membershipStatus ?? member.lifecycleStatus,
                      ],
                      ["Email", member.email],
                      [
                        "Email verified",
                        member.emailVerified ? "Yes" : "No",
                      ],
                      [
                        "Two-factor",
                        member.twoFactorEnabled ? "Enabled" : "Disabled",
                      ],
                      [
                        "Roles",
                        roleNames.length ? roleNames.join(", ") : "None assigned",
                      ],
                      [
                        "Joined",
                        new Date(member.createdAt).toLocaleDateString(),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border p-3">
                        <dt className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </TabsPanel>

                <TabsPanel value="roles">
                  <Form
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault()
                      updateRoles.mutate()
                    }}
                    className="grid gap-4 p-4"
                  >
                    <p className="text-sm text-muted-foreground">
                      Effective permissions are the union of all selected roles.
                    </p>
                    <RoleChecklist
                      roles={manageableRoles}
                      selected={selectedRoleIds}
                      onToggle={toggleRole}
                    />
                    {canManage ? (
                      <div>
                        <Button
                          type="submit"
                          loading={updateRoles.isPending}
                          disabled={selectedRoleIds.length === 0}
                        >
                          Save roles
                        </Button>
                      </div>
                    ) : null}
                  </Form>
                </TabsPanel>

                <TabsPanel value="access">
                  <div className="grid gap-4 p-4">
                    {member.accountType === "STAFF" ? (
                      <section className="rounded-xl border p-4">
                        <h4 className="font-medium">Staff access</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Suspending ends their sessions immediately and keeps
                          their roles for when they return.
                        </p>
                        <div className="mt-3">
                          {member.membershipStatus === "SUSPENDED" ? (
                            <Button
                              variant="outline"
                              disabled={!member.manageable || changeStatus.isPending}
                              onClick={() =>
                                changeStatus.mutate({ member, status: "ACTIVE" })
                              }
                            >
                              <PlayCircle />
                              Reactivate access
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              disabled={!member.manageable}
                              onClick={() => {
                                setSuspensionReason("")
                                setSuspending(member)
                              }}
                            >
                              <UserRoundX />
                              Suspend access
                            </Button>
                          )}
                        </div>
                      </section>
                    ) : null}

                    <section className="rounded-xl border border-destructive/30 p-4">
                      <h4 className="font-medium text-destructive">
                        Revoke staff access
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Removes every staff role and returns the account to a
                        customer. Active sessions are terminated.
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="destructive-outline"
                          disabled={!member.manageable}
                          onClick={() => setRevoking(member)}
                        >
                          <Trash2 />
                          Revoke staff access
                        </Button>
                      </div>
                    </section>
                  </div>
                </TabsPanel>
              </div>
            </Tabs>
          </div>
        </div>
        {dialogs}
      </>
    )
  }

  return (
    <div className="space-y-8 p-2">
    <Tabs
      value={listTab}
      onValueChange={(value) => setListTab(String(value))}
      className="grid gap-4"
    >
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTab value="members">
          Members ({staff.data?.total ?? 0})
        </TabsTab>
        <TabsTab value="invitations">Invitations</TabsTab>
      </TabsList>

      <TabsPanel value="members">
        <PanelSection>

          <PanelToolbar className="lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)_auto]">
            <PanelSearch
              value={search}
              onValueChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder="Search staff by name or email"
              label="Search staff"
            />
            <PanelToolbarSpacer />
            {canManage ? (
              <Button
                size="icon"
                aria-label="Add staff member"
                onClick={() => {
                  resetPromotion()
                  setPromoting(true)
                }}
              >
                <Plus />
              </Button>
            ) : null}
          </PanelToolbar>

          <PanelRecords>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Members - {staff.data?.total ?? 0}</TableHead>
                <TableHead className="w-36">Account type</TableHead>
                <TableHead className="w-56">Roles</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-28">Joined</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.data?.items.map((member) => (
                <TableRow
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() => openEditor(member)}
                >
                  <TableCell>
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
                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex justify-end">
                      <Menu>
                        <MenuTrigger
                          render={
                            <Button
                              aria-label={`Actions for ${member.email}`}
                              size="icon-sm"
                              variant="ghost"
                            />
                          }
                        >
                          <EllipsisVertical />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuGroup>
                            <MenuGroupLabel>Staff member</MenuGroupLabel>
                            <MenuItem
                              closeOnClick
                              disabled={!member.manageable}
                              onClick={() => openEditor(member)}
                            >
                              <Pencil />
                              Manage roles and access
                            </MenuItem>
                          </MenuGroup>

                          {member.accountType === "STAFF" ? (
                            <>
                              <MenuSeparator />
                              <MenuGroup>
                                <MenuGroupLabel>Access</MenuGroupLabel>
                                {member.membershipStatus === "SUSPENDED" ? (
                                  <MenuItem
                                    closeOnClick
                                    disabled={
                                      !member.manageable || changeStatus.isPending
                                    }
                                    onClick={() =>
                                      changeStatus.mutate({
                                        member,
                                        status: "ACTIVE",
                                      })
                                    }
                                  >
                                    <PlayCircle />
                                    Reactivate access
                                  </MenuItem>
                                ) : (
                                  <MenuItem
                                    closeOnClick
                                    disabled={!member.manageable}
                                    onClick={() => {
                                      setSuspensionReason("")
                                      setSuspending(member)
                                    }}
                                  >
                                    <UserRoundX />
                                    Suspend access
                                  </MenuItem>
                                )}
                              </MenuGroup>
                            </>
                          ) : null}

                          <MenuSeparator />
                          <MenuItem
                            closeOnClick
                            variant="destructive"
                            disabled={!member.manageable}
                            onClick={() => setRevoking(member)}
                          >
                            <Trash2 />
                            Revoke staff access
                          </MenuItem>
                        </MenuPopup>
                      </Menu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
                <PanelEmptyRow
                  colSpan={6}
                  when={(staff.data?.items.length ?? 0) === 0}
                  icon={UsersRound}
                  title={staff.isPending ? "Loading…" : "No staff members"}
                  description={staff.isError ? "Staff could not be loaded." : "Promote an existing account to staff to get started."}
                />
            </TableBody>
          </Table>
          </PanelRecords>
          <TablePagination
            currentPage={staff.data?.page ?? page}
            totalPages={staff.data?.pageCount ?? 1}
            totalItems={staff.data?.total}
            pageSize={staff.data?.pageSize}
            onPageChange={setPage}
          />
          {dialogs}
        </PanelSection>
      </TabsPanel>

      <TabsPanel value="invitations">{listFooter}</TabsPanel>
    </Tabs>
    </div>
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
