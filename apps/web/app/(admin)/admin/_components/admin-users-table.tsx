"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { toast } from "sonner"
import {
  banAdminUser,
  getAdminUsers,
  setAdminUserAccountType,
  unbanAdminUser,
} from "@/features/admin/api/admin-api"
import { queryKeys } from "@/shared/query/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { AdminPagination } from "./admin-pagination"
import { useHasStaffPermission } from "./admin-shell"
import { useStepUp } from "./step-up-dialog"

const accountTypes = ["USER", "AGENT"] as const
const accountTypeFilters = ["ALL", "OWNER", "STAFF", "AGENT", "USER"] as const
const statuses = ["ALL", "active", "banned"] as const
const accountTypeItems = accountTypes.map((value) => ({ value, label: value }))
const accountTypeFilterItems = accountTypeFilters.map((value) => ({
  value,
  label: value === "ALL" ? "All account types" : value,
}))
const statusItems = statuses.map((value) => ({
  value,
  label:
    value === "ALL"
      ? "All accounts"
      : value === "active"
        ? "Active"
        : "Suspended",
}))

export function AdminUsersTable() {
  const { guard } = useStepUp()
  const canManageType = useHasStaffPermission("admin.users.type.manage")
  const canManageStatus = useHasStaffPermission("admin.users.status.manage")
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [accountType, setAccountType] =
    useState<(typeof accountTypeFilters)[number]>("ALL")
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL")
  const [suspending, setSuspending] = useState<{
    id: string
    email: string
  } | null>(null)
  const [suspensionReason, setSuspensionReason] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters = { search: debouncedSearch, accountType, status }
  const query = useQuery({
    queryKey: queryKeys.adminUsers(page, filters),
    queryFn: () =>
      getAdminUsers(
        page,
        25,
        debouncedSearch,
        accountType === "ALL" ? "" : accountType,
        status === "ALL" ? "" : status
      ),
    placeholderData: (previous) => previous,
  })

  const action = useMutation({
    mutationFn: async (input: {
      id: string
      kind: "accountType" | "ban" | "unban"
      accountType?: "USER" | "AGENT"
      reason?: string
    }) => {
      if (input.kind === "accountType")
        return guard(() => setAdminUserAccountType(input.id, input.accountType!))
      if (input.kind === "ban")
        return guard(() => banAdminUser(input.id, input.reason!))
      return guard(() => unbanAdminUser(input.id))
    },
    onSuccess: async () => {
      toast.success("User account updated.")
      setSuspending(null)
      setSuspensionReason("")
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_180px_160px_auto] md:items-center">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search name or email"
            aria-label="Search users"
            className="[&_input]:pl-9"
          />
        </div>
        <Select
          items={accountTypeFilterItems}
          value={accountType}
          onValueChange={(value) => {
            setAccountType(value as (typeof accountTypeFilters)[number])
            setPage(1)
          }}
        >
          <SelectTrigger aria-label="Filter by account type">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {accountTypeFilters.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "ALL" ? "All account types" : item}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Select
          items={statusItems}
          value={status}
          onValueChange={(value) => {
            setStatus(value as (typeof statuses)[number])
            setPage(1)
          }}
        >
          <SelectTrigger aria-label="Filter by account status">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {statuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "ALL"
                  ? "All accounts"
                  : item === "active"
                    ? "Active"
                    : "Suspended"}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <span className="text-xs text-muted-foreground">
          {query.data?.total ?? 0} users
        </span>
      </div>

      <Table className="min-w-[1050px]">
        <TableHeader className="bg-muted/50 text-[11px] tracking-wider uppercase">
          <TableRow>
            <TableHead className="px-5">User</TableHead>
            <TableHead className="px-5">Account type</TableHead>
            <TableHead className="px-5">Security</TableHead>
            <TableHead className="px-5">Listings</TableHead>
            <TableHead className="px-5">Lifecycle</TableHead>
            <TableHead className="px-5">Joined</TableHead>
            <TableHead className="px-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.items.map((user) => (
            <TableRow key={user.id} className="align-top">
              <TableCell className="px-5 py-4">
                <p className="font-semibold">{user.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user.email}
                </p>
              </TableCell>
              <TableCell className="px-5 py-4">
                {canManageType &&
                (user.accountType === "USER" ||
                  user.accountType === "AGENT") ? (
                  <Select
                    items={accountTypeItems}
                    value={user.accountType}
                    disabled={action.isPending}
                    onValueChange={(value) =>
                      action.mutate({
                        id: user.id,
                        kind: "accountType",
                        accountType: value as "USER" | "AGENT",
                      })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={`Account type for ${user.email}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {accountTypes.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                ) : (
                  <Badge
                    variant={
                      user.accountType === "OWNER" ? "success" : "secondary"
                    }
                  >
                    {user.accountType}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="px-5 py-4 text-xs leading-5">
                {user.emailVerified ? "Email verified" : "Email unverified"}
                <br />
                {user.twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
              </TableCell>
              <TableCell className="px-5 py-4">{user.listings}</TableCell>
              <TableCell className="px-5 py-4">
                <Badge
                  variant={
                    user.banned || user.lifecycleStatus !== "ACTIVE"
                      ? "error"
                      : "success"
                  }
                >
                  {user.banned ? "SUSPENDED" : user.lifecycleStatus}
                </Badge>
              </TableCell>
              <TableCell className="px-5 py-4 text-xs text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="px-5 py-4 text-right">
                {canManageStatus && (
                  <Button
                    size="sm"
                    variant={user.banned ? "outline" : "destructive-outline"}
                    loading={action.isPending}
                    onClick={() =>
                      user.banned
                        ? action.mutate({ id: user.id, kind: "unban" })
                        : setSuspending({ id: user.id, email: user.email })
                    }
                  >
                    {user.banned ? "Restore" : "Suspend"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {(query.isLoading ||
            query.isError ||
            query.data?.items.length === 0) && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="p-10 text-center text-muted-foreground"
              >
                {query.isLoading
                  ? "Loading users…"
                  : query.isError
                    ? "Users could not be loaded."
                    : "No users match these filters."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <AdminPagination
        page={query.data?.page ?? page}
        pageCount={query.data?.pageCount ?? 1}
        onPage={setPage}
      />

      <Dialog
        open={Boolean(suspending)}
        onOpenChange={(open) => !open && setSuspending(null)}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Suspend account</DialogTitle>
            <DialogDescription>
              This immediately revokes active sessions for {suspending?.email}.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Textarea
                value={suspensionReason}
                onChange={(event) => setSuspensionReason(event.target.value)}
                placeholder="Explain why this account is being suspended"
                required
                minLength={3}
                maxLength={500}
              />
              <FieldDescription>
                Recorded in the audit log and required to continue.
              </FieldDescription>
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              loading={action.isPending}
              disabled={suspensionReason.trim().length < 3}
              onClick={() =>
                suspending &&
                action.mutate({
                  id: suspending.id,
                  kind: "ban",
                  reason: suspensionReason.trim(),
                })
              }
            >
              Suspend account
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
