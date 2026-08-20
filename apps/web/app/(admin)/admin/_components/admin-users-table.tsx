"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  EllipsisVertical,
  Eye,
  Search,
  UserCheck,
  UserCog,
  UserRound,
  UsersRound,
  UserX,
} from "lucide-react"
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
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
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
import { Frame } from "@/components/ui/frame"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { TablePagination } from "@/components/ui/table-pagination"
import { Textarea } from "@/components/ui/textarea"
import { PanelEmptyRow } from "./panel-layout"
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
  const router = useRouter()
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
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)_13rem_13rem]">
        <InputGroup>
          <InputGroupInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search name or email"
            aria-label="Search users"
            type="search"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>

        <div aria-hidden className="hidden lg:block" />
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
      </div>

      <Frame>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Users - {query.data?.total ?? 0}</TableHead>
              <TableHead className="w-44">Account type</TableHead>
              <TableHead className="w-44">Security</TableHead>
              <TableHead className="w-24">Listings</TableHead>
              <TableHead className="w-32">Lifecycle</TableHead>
              <TableHead className="w-32">Joined</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {query.data?.items.map((user) => (
            <TableRow
              key={user.id}
              className="cursor-pointer align-top"
              onClick={() => router.push(`/admin/users/${user.id}`)}
            >
              <TableCell>
                <p className="font-semibold">{user.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user.email}
                </p>
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
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
              <TableCell className="text-xs leading-5">
                {user.emailVerified ? "Email verified" : "Email unverified"}
                <br />
                {user.twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
              </TableCell>
              <TableCell>{user.listings}</TableCell>
              <TableCell>
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
              <TableCell className="text-xs text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
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
                          aria-label={`Actions for ${user.email}`}
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <EllipsisVertical />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuGroup>
                        <MenuGroupLabel>Account</MenuGroupLabel>
                        <MenuLinkItem
                          render={<Link href={`/admin/users/${user.id}`} />}
                        >
                          <Eye />
                          View details
                        </MenuLinkItem>
                      </MenuGroup>

                      {canManageType &&
                      (user.accountType === "USER" ||
                        user.accountType === "AGENT") ? (
                        <>
                          <MenuSeparator />
                          <MenuGroup>
                            <MenuGroupLabel>Account type</MenuGroupLabel>
                            {accountTypes.map((item) => (
                              <MenuItem
                                key={item}
                                closeOnClick
                                disabled={user.accountType === item}
                                onClick={() =>
                                  action.mutate({
                                    id: user.id,
                                    kind: "accountType",
                                    accountType: item,
                                  })
                                }
                              >
                                {item === "AGENT" ? <UserCog /> : <UserRound />}
                                {item === "AGENT" ? "Make agent" : "Make customer"}
                              </MenuItem>
                            ))}
                          </MenuGroup>
                        </>
                      ) : null}

                      {canManageStatus ? (
                        <>
                          <MenuSeparator />
                          <MenuGroup>
                            <MenuGroupLabel>Access</MenuGroupLabel>
                            {user.banned ? (
                              <MenuItem
                                closeOnClick
                                onClick={() =>
                                  action.mutate({ id: user.id, kind: "unban" })
                                }
                              >
                                <UserCheck />
                                Restore access
                              </MenuItem>
                            ) : (
                              <MenuItem
                                closeOnClick
                                variant="destructive"
                                onClick={() =>
                                  setSuspending({
                                    id: user.id,
                                    email: user.email,
                                  })
                                }
                              >
                                <UserX />
                                Suspend account
                              </MenuItem>
                            )}
                          </MenuGroup>
                        </>
                      ) : null}
                    </MenuPopup>
                  </Menu>
                </div>
              </TableCell>
            </TableRow>
          ))}
            <PanelEmptyRow
              colSpan={7}
              when={(query.data?.items.length ?? 0) === 0}
              icon={UsersRound}
              title={query.isLoading ? "Loading users…" : "No users found"}
              description={
                query.isError
                  ? "Users could not be loaded."
                  : "Try a different account type, status, or search."
              }
            />
          </TableBody>
        </Table>
      </Frame>

      <TablePagination
        currentPage={query.data?.page ?? page}
        totalPages={query.data?.pageCount ?? 1}
        totalItems={query.data?.total}
        pageSize={query.data?.pageSize}
        onPageChange={setPage}
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
    </div>
  )
}
