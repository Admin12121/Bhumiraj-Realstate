"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { staffRoleSummarySchema } from "@real-estate/contracts"
import { KeyRound, Pencil, Plus, Shield, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import {
  createStaffRole,
  deleteStaffRole,
  getStaffRbacCatalog,
  setStaffRolePermissions,
  updateStaffRole,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export function StaffRolesPanel() {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ["admin", "rbac", "catalog"],
    queryFn: getStaffRbacCatalog,
  })
  const [editing, setEditing] = useState<StaffRole | "new" | null>(null)
  const [deleting, setDeleting] = useState<StaffRole | null>(null)
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft)
  const canManage = useHasStaffPermission("admin.roles.manage")

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
        return createStaffRole({
          ...base,
          permissionKeys: draft.permissionKeys,
        })
      if (!editing) throw new Error("No role selected.")
      await updateStaffRole(editing.id, base)
      return setStaffRolePermissions(editing.id, draft.permissionKeys)
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
    mutationFn: (id: string) => deleteStaffRole(id),
    onSuccess: async () => {
      toast.success("Staff role deleted.")
      setDeleting(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const selectedPermissionCount = draft.permissionKeys.length
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

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-semibold">Custom staff roles</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Permissions combine when a staff member has multiple roles.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setDraft(emptyDraft)
              setEditing("new")
            }}
          >
            <Plus />
            Create role
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-5">Role</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Members</TableHead>
            <TableHead className="px-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  <div>
                    <p className="font-medium">{role.name}</p>
                    <p className="mt-1 max-w-md text-xs whitespace-normal text-muted-foreground">
                      {role.description || role.slug}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{role.position}</Badge>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-sm">
                  <KeyRound className="size-4 text-muted-foreground" />
                  {role.permissionKeys.length}
                </span>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  {role.memberCount}
                </span>
              </TableCell>
              <TableCell className="px-5 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!role.manageable}
                    aria-label={`Edit ${role.name}`}
                    onClick={() => {
                      setDraft({
                        name: role.name,
                        description: role.description ?? "",
                        color: role.color,
                        position: String(role.position),
                        permissionKeys: role.permissionKeys,
                      })
                      setEditing(role)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive-outline"
                    disabled={!role.manageable || role.memberCount > 0}
                    aria-label={`Delete ${role.name}`}
                    onClick={() => setDeleting(role)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {(query.isPending ||
            query.isError ||
            query.data?.roles.length === 0) && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="p-10 text-center text-muted-foreground"
              >
                {query.isPending
                  ? "Loading roles…"
                  : query.isError
                    ? "Roles could not be loaded."
                    : "No staff roles have been created."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogPopup className="max-w-3xl">
          <Form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              save.mutate()
            }}
            className="contents"
          >
            <DialogHeader>
              <DialogTitle>
                {editing === "new"
                  ? "Create staff role"
                  : `Edit ${editing?.name ?? "role"}`}
              </DialogTitle>
              <DialogDescription>
                Position controls hierarchy. Staff can manage only roles below
                their own highest position.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel className="space-y-6">
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
                  <FieldLabel>Role color</FieldLabel>
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
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Permissions</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedPermissionCount} of {allKeys.length} selected
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
                <div className="grid gap-4 md:grid-cols-2">
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
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                loading={save.isPending}
                disabled={draft.name.trim().length < 2}
              >
                <Shield />
                Save role
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

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
    </section>
  )
}
