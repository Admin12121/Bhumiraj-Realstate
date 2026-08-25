"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { staffRoleSummarySchema } from "@real-estate/contracts"
import {
  ArrowLeft,
  KeyRound,
  PanelLeft,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  assignStaffRole,
  createStaffRole,
  deleteStaffRole,
  getStaffMembers,
  getStaffRbacCatalog,
  removeStaffRole,
  setStaffRolePermissions,
  updateStaffRole,
} from "@/features/admin/api/admin-api"
import { PanelEmptyRow, PanelSection } from "./panel-layout"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Frame } from "@/components/ui/frame"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/shared/http/error-message";

type StaffRole = z.infer<typeof staffRoleSummarySchema>
type EditorTab = "display" | "permissions" | "members"
type RoleDraft = {
  name: string
  description: string
  color: string
  position: string
  permissionKeys: string[]
}

const emptyDraft: RoleDraft = {
  name: "",
  description: "",
  color: "#64748b",
  position: "10",
  permissionKeys: [],
}

function draftOf(role: StaffRole): RoleDraft {
  return {
    name: role.name,
    description: role.description ?? "",
    color: role.color,
    position: String(role.position),
    permissionKeys: role.permissionKeys,
  }
}

function RoleDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}

export function StaffRolesPanel() {
  const { guard } = useStepUp()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ["admin", "rbac", "catalog"],
    queryFn: getStaffRbacCatalog,
  })
  // `null` shows the list; a role or "new" opens the full-height editor.
  const [editing, setEditing] = useState<StaffRole | "new" | null>(null)
  const [tab, setTab] = useState<EditorTab>("display")
  const [deleting, setDeleting] = useState<StaffRole | null>(null)
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft)
  const [search, setSearch] = useState("")
  // The rail collapses to icons, independently of the app sidebar.
  const [railOpen, setRailOpen] = useState(true)
  const [memberToAdd, setMemberToAdd] = useState("")
  const canManage = useHasStaffPermission("admin.roles.manage")
  const canAssign = useHasStaffPermission("admin.staff.manage")

  // Membership lives on the staff record, so the role's Members tab reads the
  // staff list and filters it rather than asking for a per-role endpoint.
  const staff = useQuery({
    queryKey: ["admin", "staff", 1, ""],
    queryFn: () => getStaffMembers(1, ""),
  })

  const roles = query.data?.roles ?? []
  const isCreate = editing === "new"
  const selectedId = isCreate ? "new" : (editing?.id ?? null)

  const refresh = async () =>
    client.invalidateQueries({ queryKey: ["admin", "rbac"] })

  const save = useMutation({
    mutationFn: async () => {
      const position = Number(draft.position)
      if (!Number.isInteger(position) || position < 0 || position > 999)
        throw new Error("Position must be a whole number between 0 and 999.")
      const base = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        color: draft.color,
        position,
      }
      if (isCreate)
        return guard(() =>
          createStaffRole({ ...base, permissionKeys: draft.permissionKeys })
        )
      if (!editing) throw new Error("No role selected.")
      const role = editing
      return guard(async () => {
        await updateStaffRole(role.id, base)
        return setStaffRolePermissions(role.id, draft.permissionKeys)
      })
    },
    onSuccess: async () => {
      toast.success(isCreate ? "Staff role created." : "Staff role updated.")
      await refresh()
      if (isCreate) setEditing(null)
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const assignMember = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      guard(() => assignStaffRole(userId, roleId)),
    onSuccess: async () => {
      toast.success("Role assigned.")
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "rbac"] }),
        client.invalidateQueries({ queryKey: ["admin", "staff"] }),
      ])
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const unassignMember = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      guard(() => removeStaffRole(userId, roleId)),
    onSuccess: async () => {
      toast.success("Role removed.")
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "rbac"] }),
        client.invalidateQueries({ queryKey: ["admin", "staff"] }),
      ])
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => guard(() => deleteStaffRole(id)),
    onSuccess: async () => {
      toast.success("Staff role deleted.")
      setDeleting(null)
      setEditing(null)
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const allKeys = useMemo(
    () =>
      query.data?.permissionGroups.flatMap(({ permissions }) =>
        permissions.map(({ key }) => key)
      ) ?? [],
    [query.data]
  )

  const togglePermission = (key: string, checked: boolean) =>
    setDraft((current) => ({
      ...current,
      permissionKeys: checked
        ? [...new Set([...current.permissionKeys, key])]
        : current.permissionKeys.filter((item) => item !== key),
    }))

  const open = (role: StaffRole) => {
    setDraft(draftOf(role))
    setEditing(role)
    setTab("display")
  }
  const startNew = () => {
    setDraft(emptyDraft)
    setEditing("new")
    setTab("display")
  }

  const visible = roles.filter((role) =>
    search.trim()
      ? role.name.toLowerCase().includes(search.trim().toLowerCase())
      : true
  )

  // ── List view ────────────────────────────────────────────────────────────
  if (editing === null) {
    return (
      <div className="sm:p-6 p-2">
        <PanelSection>

          <div className="grid gap-3 lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)_auto]">
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles…"
                aria-label="Search roles"
                type="search"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <div aria-hidden className="hidden lg:block" />
            {canManage ? (
              <Button size="icon" aria-label="Create role" onClick={startNew}>
                <Plus />
              </Button>
            ) : null}
          </div>

          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Role — {visible.length}</TableHead>
                  <TableHead className="w-32">Position</TableHead>
                  <TableHead className="w-32">Permissions</TableHead>
                  <TableHead className="w-32">Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((role) => (
                  <TableRow
                    key={role.id}
                    className="cursor-pointer"
                    onClick={() => open(role)}
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <RoleDot color={role.color} />
                        <span className="truncate font-medium">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.position}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 tabular-nums">
                        <KeyRound className="size-4 text-muted-foreground" />
                        {role.permissionKeys.length}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 tabular-nums">
                        <Users className="size-4 text-muted-foreground" />
                        {role.memberCount}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                <PanelEmptyRow
                  colSpan={4}
                  when={visible.length === 0}
                  icon={ShieldCheck}
                  title={query.isPending ? "Loading roles…" : "No roles found"}
                  description={
                    query.isError
                      ? "Roles could not be loaded."
                      : "Create a role to start granting staff permissions."
                  }
                />
              </TableBody>
            </Table>
          </Frame>
        </PanelSection>
      </div>
    )
  }

  // ── Editor view ──────────────────────────────────────────────────────────
  const staffList = staff.data?.items ?? []
  const assignedMembers = isCreate
    ? []
    : staffList.filter((member) => member.roleIds.includes(editing.id))
  const candidates = isCreate
    ? []
    : staffList.filter((member) => !member.roleIds.includes(editing.id))
  const memberCount = assignedMembers.length

  return (
    <>
      <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden border-t bg-background">
        {/* Rail: the other roles, so switching between them is one click. */}
        <div
          className={cn(
            "flex shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear max-md:hidden",
            railOpen ? "w-72" : "w-[3.25rem]"
          )}
        >
          <div
            className={cn(
              "flex h-12 shrink-0 items-center border-b",
              railOpen ? "justify-between p-3" : "justify-center p-1"
            )}
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Back to roles"
              onClick={() => setEditing(null)}
            >
              <ArrowLeft />
            </Button>
            {railOpen && canManage ? (
              <Button size="icon-sm" aria-label="Create role" onClick={startNew}>
                <Plus />
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {railOpen ? (
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground select-none">
                Roles
              </p>
            ) : null}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {isCreate ? (
                <li>
                  <span
                    title="New role"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg bg-sidebar-accent px-2 py-1.5 text-sm font-medium text-sidebar-accent-foreground",
                      !railOpen && "justify-center"
                    )}
                  >
                    <RoleDot color={draft.color} />
                    {railOpen ? <span className="truncate">New role</span> : null}
                  </span>
                </li>
              ) : null}
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    title={role.name}
                    onClick={() => open(role)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      !railOpen && "justify-center",
                      selectedId === role.id
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <RoleDot color={role.color} />
                    {railOpen ? (
                      <span className="truncate">{role.name}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Editor */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b p-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label={railOpen ? "Collapse list" : "Expand list"}
                className="max-md:hidden"
                onClick={() => setRailOpen((value) => !value)}
              >
                <PanelLeft />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Back to roles"
                className="md:hidden"
                onClick={() => setEditing(null)}
              >
                <ArrowLeft />
              </Button>
              <div className="truncate text-sm font-semibold">
                {isCreate ? "Create role" : editing.name}
              </div>
            </div>
            {canManage ? (
              <Button
                size="icon-sm"
                aria-label="Save role"
                loading={save.isPending}
                disabled={draft.name.trim().length < 2}
                onClick={() => save.mutate()}
              >
                <Save />
              </Button>
            ) : null}
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as EditorTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 p-2">
              <TabsList className="w-full">
                <TabsTab value="display">Display</TabsTab>
                <TabsTab value="permissions">Permissions</TabsTab>
                <TabsTab value="members">Members ({memberCount})</TabsTab>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsPanel value="display">
                <Form
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault()
                    save.mutate()
                  }}
                  className="grid gap-5 p-4"
                >
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>Role name</FieldLabel>
                        <Input
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          required
                          minLength={2}
                          maxLength={80}
                          disabled={!canManage}
                          placeholder="e.g. Moderator"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Position</FieldLabel>
                        <Input
                          type="number"
                          value={draft.position}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              position: event.target.value,
                            }))
                          }
                          required
                          min={0}
                          max={999}
                          disabled={!canManage}
                        />
                        <FieldDescription>
                          Higher positions can manage lower positions.
                        </FieldDescription>
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>Colour</FieldLabel>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={draft.color}
                          disabled={!canManage}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              color: event.target.value,
                            }))
                          }
                          aria-label="Role colour"
                          className="h-8.5 w-16 cursor-pointer rounded-lg border border-input bg-background p-1 sm:h-7.5"
                        />
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {draft.color}
                        </span>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel>Description</FieldLabel>
                      <Textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        maxLength={500}
                        disabled={!canManage}
                        placeholder="What can staff with this role do?"
                      />
                    </Field>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-3">
                      <Button type="submit" loading={save.isPending}>
                        {isCreate ? "Create role" : "Save changes"}
                      </Button>
                      {!isCreate ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/8"
                          disabled={!editing.manageable || editing.memberCount > 0}
                          onClick={() => setDeleting(editing)}
                        >
                          Delete role
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </Form>
              </TabsPanel>

              <TabsPanel value="permissions">
                <div className="grid gap-4 p-4">
                  {isCreate ? (
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Save the role first, then assign permissions.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          {draft.permissionKeys.length} of {allKeys.length}{" "}
                          selected
                        </p>
                        {canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                permissionKeys:
                                  current.permissionKeys.length ===
                                  allKeys.length
                                    ? []
                                    : allKeys,
                              }))
                            }
                          >
                            {draft.permissionKeys.length === allKeys.length
                              ? "Clear all"
                              : "Select all"}
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid gap-5">
                        {query.data?.permissionGroups.map((group) => (
                          <section key={group.group} className="grid gap-2">
                            <h3 className="text-base font-semibold">
                              {group.group}
                            </h3>
                            <div className="divide-y border-b">
                              {group.permissions.map((permission) => (
                                <div
                                  key={permission.id}
                                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">
                                      {permission.label}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      <code className="text-xs">
                                        {permission.key}
                                      </code>
                                    </p>
                                  </div>
                                  <Switch
                                    checked={draft.permissionKeys.includes(
                                      permission.key
                                    )}
                                    disabled={!canManage}
                                    onCheckedChange={(checked) =>
                                      togglePermission(permission.key, checked)
                                    }
                                    aria-label={`Toggle ${permission.label}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </TabsPanel>

              <TabsPanel value="members">
                <div className="grid gap-4 p-4">
                  {isCreate ? (
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Save the role first, then assign staff to it.
                    </div>
                  ) : (
                    <>
                      {canAssign ? (
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <Field>
                            <FieldLabel>Add staff to this role</FieldLabel>
                            <Select
                              items={candidates.map((member) => ({
                                value: member.id,
                                label: member.name,
                              }))}
                              value={memberToAdd}
                              onValueChange={(value) =>
                                setMemberToAdd(String(value))
                              }
                            >
                              <SelectTrigger aria-label="Choose a staff member">
                                <SelectValue placeholder="Choose a staff member" />
                              </SelectTrigger>
                              <SelectPopup>
                                {candidates.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.name} — {member.email}
                                  </SelectItem>
                                ))}
                              </SelectPopup>
                            </Select>
                          </Field>
                          <Button
                            disabled={!memberToAdd}
                            loading={assignMember.isPending}
                            onClick={() => {
                              assignMember.mutate({
                                userId: memberToAdd,
                                roleId: editing.id,
                              })
                              setMemberToAdd("")
                            }}
                          >
                            Add to role
                          </Button>
                        </div>
                      ) : null}

                      <Frame>
                        <Table variant="card">
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                Member — {assignedMembers.length}
                              </TableHead>
                              <TableHead className="w-64">Email</TableHead>
                              <TableHead className="w-32">Status</TableHead>
                              {canAssign ? (
                                <TableHead className="w-28 text-right" />
                              ) : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {assignedMembers.map((member) => (
                              <TableRow key={member.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold uppercase select-none">
                                      {(member.name || "?").slice(0, 2)}
                                    </span>
                                    <span className="font-medium">
                                      {member.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {member.email}
                                </TableCell>
                                <TableCell>
                                  <Badge size="sm" variant="secondary">
                                    {member.membershipStatus ??
                                      member.lifecycleStatus}
                                  </Badge>
                                </TableCell>
                                {canAssign ? (
                                  <TableCell className="text-right">
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Remove ${member.name}`}
                                      onClick={() =>
                                        unassignMember.mutate({
                                          userId: member.id,
                                          roleId: editing.id,
                                        })
                                      }
                                    >
                                      <X />
                                    </Button>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            ))}
                            <PanelEmptyRow
                              colSpan={canAssign ? 4 : 3}
                              when={assignedMembers.length === 0}
                              icon={UsersRound}
                              title="No staff assigned"
                              description="Add a staff member above to grant them this role."
                            />
                          </TableBody>
                        </Table>
                      </Frame>
                    </>
                  )}
                </div>
              </TabsPanel>
            </div>
          </Tabs>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the custom role permanently. Roles assigned to staff
              cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Delete role
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  )
}
