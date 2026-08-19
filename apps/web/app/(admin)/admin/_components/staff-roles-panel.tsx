"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { staffRoleSummarySchema } from "@real-estate/contracts"
import { KeyRound, Plus, Shield, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import {
  createStaffRole,
  deleteStaffRole,
  getStaffRbacCatalog,
  setStaffRolePermissions,
  updateStaffRole,
} from "@/features/admin/api/admin-api"
import { PanelHeading, PanelSection } from "./panel-layout"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NestedSidebar,
  NestedSidebarAction,
  NestedSidebarItem,
} from "@/components/ui/nested-sidebar"
import { Textarea } from "@/components/ui/textarea"

type StaffRole = z.infer<typeof staffRoleSummarySchema>
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

/**
 * Roles are edited in place beside their list rather than in a modal: choosing
 * a role and seeing what it grants is the whole job here, and a dialog hid the
 * list every time you wanted to compare two roles.
 */
export function StaffRolesPanel() {
  const { guard } = useStepUp()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ["admin", "rbac", "catalog"],
    queryFn: getStaffRbacCatalog,
  })
  const [editing, setEditing] = useState<StaffRole | "new" | null>(null)
  const [deleting, setDeleting] = useState<StaffRole | null>(null)
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft)
  const canManage = useHasStaffPermission("admin.roles.manage")

  const roles = query.data?.roles ?? []
  const selectedId = editing === "new" ? "new" : (editing?.id ?? null)

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
      if (editing === "new")
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
      toast.success(
        editing === "new" ? "Staff role created." : "Staff role updated."
      )
      setEditing(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => guard(() => deleteStaffRole(id)),
    onSuccess: async () => {
      toast.success("Staff role deleted.")
      setDeleting(null)
      setEditing(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
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

  const startNew = () => {
    setDraft(emptyDraft)
    setEditing("new")
  }

  return (
    <PanelSection>
      <PanelHeading
        title="Custom staff roles"
        description="Permissions combine when a staff member has multiple roles. Position controls hierarchy: staff manage only roles below their own."
      />

      <NestedSidebar
        width="20rem"
        actions={
          canManage ? (
            <NestedSidebarAction
              icon={<Plus />}
              label="Create role"
              onClick={startNew}
            />
          ) : null
        }
        items={(open) =>
          roles.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {query.isPending
                ? "Loading roles…"
                : query.isError
                  ? "Roles could not be loaded."
                  : open
                    ? "No staff roles yet."
                    : "—"}
            </p>
          ) : (
            <>
              {roles.map((role) => (
                <NestedSidebarItem
                  key={role.id}
                  open={open}
                  isActive={selectedId === role.id}
                  label={role.name}
                  onClick={() => {
                    setDraft(draftOf(role))
                    setEditing(role)
                  }}
                  icon={
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                  }
                  trailing={
                    <Badge size="sm" variant="outline">
                      {role.position}
                    </Badge>
                  }
                />
              ))}
              {editing === "new" ? (
                <NestedSidebarItem
                  open={open}
                  isActive
                  label="New role"
                  icon={<Plus className="size-4" />}
                />
              ) : null}
            </>
          )
        }
        header={(toggle) => (
          <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            {toggle}
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
              {editing === "new"
                ? "New role"
                : (editing?.name ?? "Select a role")}
            </h3>
            {editing && editing !== "new" ? (
              <>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                  <KeyRound className="size-3.5" />
                  {editing.permissionKeys.length}
                </span>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                  <Users className="size-3.5" />
                  {editing.memberCount}
                </span>
                {canManage ? (
                  <Button
                    size="icon-sm"
                    variant="destructive-outline"
                    aria-label={`Delete ${editing.name}`}
                    disabled={!editing.manageable || editing.memberCount > 0}
                    onClick={() => setDeleting(editing)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      >
        {editing === null ? (
          <div className="grid flex-1 place-items-center p-10 text-center text-sm text-muted-foreground">
            Choose a role to see what it grants
            {canManage ? ", or create a new one." : "."}
          </div>
        ) : (
          <Form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              save.mutate()
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
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
                    placeholder="Listing moderator"
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
                  />
                  <FieldDescription>
                    Higher positions can manage lower positions.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Role colour</FieldLabel>
                  <Input
                    type="color"
                    value={draft.color}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        color: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field className="sm:col-span-2">
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
                    placeholder="What this role is responsible for"
                  />
                </Field>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-medium">Permissions</h4>
                    <p className="text-xs text-muted-foreground">
                      {draft.permissionKeys.length} of {allKeys.length} selected
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        permissionKeys:
                          current.permissionKeys.length === allKeys.length
                            ? []
                            : allKeys,
                      }))
                    }
                  >
                    {draft.permissionKeys.length === allKeys.length
                      ? "Clear all"
                      : "Select all"}
                  </Button>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {query.data?.permissionGroups.map((group) => (
                    <div key={group.group} className="rounded-xl border p-4">
                      <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {group.group}
                      </p>
                      <div className="space-y-3">
                        {group.permissions.map((permission) => {
                          const id = `permission-${permission.id}`
                          return (
                            <div
                              key={permission.id}
                              className="flex items-start gap-3"
                            >
                              <Checkbox
                                id={id}
                                checked={draft.permissionKeys.includes(
                                  permission.key
                                )}
                                onCheckedChange={(checked) =>
                                  togglePermission(permission.key, checked)
                                }
                              />
                              <Label
                                htmlFor={id}
                                className="block cursor-pointer"
                              >
                                <span className="block text-sm">
                                  {permission.label}
                                </span>
                                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                  {permission.description || permission.key}
                                </span>
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t p-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={save.isPending}
                disabled={!canManage || draft.name.trim().length < 2}
              >
                <Shield />
                Save role
              </Button>
            </div>
          </Form>
        )}
      </NestedSidebar>

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
    </PanelSection>
  )
}
