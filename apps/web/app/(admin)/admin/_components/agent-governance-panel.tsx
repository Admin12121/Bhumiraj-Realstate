"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { adminAgentSchema } from "@real-estate/contracts"
import { Copy, MailPlus, Plus, Settings2, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react"
import { toast } from "sonner"
import {
  createAgent,
  createAgentInvitation,
  getAdminAgents,
  getAgentCandidates,
  getAgentInvitations,
  revokeAgentInvitation,
  setAgentAvailability,
  setAgentStatus,
} from "@/features/admin/api/admin-api"
import { useHasStaffPermission } from "./admin-shell"
import { useStepUp } from "./step-up-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Form } from "@/components/ui/form"
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
import { TablePagination } from "@/components/ui/table-pagination"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import {
  PanelEmptyRow,
  PanelRecords,
  PanelSearch,
  PanelSection,
  PanelToolbar,
  PanelToolbarSpacer,
} from "./panel-layout"
import { errorMessage } from "@/shared/http/error-message";

type Agent = z.infer<typeof adminAgentSchema>
const availabilityItems = [
  { label: "Available", value: "AVAILABLE" as const },
  { label: "Unavailable", value: "UNAVAILABLE" as const },
  { label: "At capacity", value: "AT_CAPACITY" as const },
]

export function AgentGovernancePanel() {
  const { guard } = useStepUp()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState("directory")
  const [candidateSearch, setCandidateSearch] = useState("")
  const [candidateId, setCandidateId] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [statusAgent, setStatusAgent] = useState<Agent | null>(null)
  const [nextStatus, setNextStatus] = useState<
    "ACTIVE" | "SUSPENDED" | "RETIRED"
  >("ACTIVE")
  const [reason, setReason] = useState("")
  const [availabilityAgent, setAvailabilityAgent] = useState<Agent | null>(null)
  const [availability, setAvailability] = useState<
    "AVAILABLE" | "UNAVAILABLE" | "AT_CAPACITY"
  >("UNAVAILABLE")
  const [capacity, setCapacity] = useState(10)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const agents = useQuery({
    queryKey: ["admin", "agents", page, debouncedSearch],
    queryFn: () => getAdminAgents(page, debouncedSearch),
    placeholderData: (previous) => previous,
  })
  const candidates = useQuery({
    queryKey: ["admin", "agent-candidates", candidateSearch.trim()],
    queryFn: () => getAgentCandidates(candidateSearch.trim()),
    enabled: adding && candidateSearch.trim().length >= 2,
  })
  const invitations = useQuery({
    queryKey: ["admin", "agent-invitations"],
    queryFn: () => getAgentInvitations(1),
  })
  const canManage = useHasStaffPermission("admin.agents.manage")
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["admin", "agents"] }),
      client.invalidateQueries({ queryKey: ["admin", "agent-invitations"] }),
    ])
  }
  const add = useMutation({
    mutationFn: () => guard(() => createAgent(candidateId)),
    onSuccess: async () => {
      toast.success("Customer onboarded as a pending agent and signed out.")
      setAdding(false)
      setCandidateId("")
      setCandidateSearch("")
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })
  const invite = useMutation({
    mutationFn: () => guard(() => createAgentInvitation(inviteEmail)),
    onSuccess: async (result) => {
      setInviteLink(result.inviteLink)
      toast.success(
        result.delivery === "SENT"
          ? "Agent invitation sent."
          : "Invitation created; copy its secure link."
      )
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })
  const changeStatus = useMutation({
    mutationFn: () => {
      if (!statusAgent) throw new Error("No agent selected.")
      const agent = statusAgent
      return guard(() => setAgentStatus(agent.id, nextStatus, reason || null))
    },
    onSuccess: async () => {
      toast.success("Agent lifecycle updated.")
      setStatusAgent(null)
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })
  const changeAvailability = useMutation({
    mutationFn: () => {
      if (!availabilityAgent) throw new Error("No agent selected.")
      return setAgentAvailability(availabilityAgent.id, availability, capacity)
    },
    onSuccess: async () => {
      toast.success("Agent availability updated.")
      setAvailabilityAgent(null)
      await refresh()
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })
  const revokeInvite = useMutation({
    mutationFn: (id: string) => guard(() => revokeAgentInvitation(id)),
    onSuccess: refresh,
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const openStatus = (
    agent: Agent,
    status: "ACTIVE" | "SUSPENDED" | "RETIRED"
  ) => {
    setStatusAgent(agent)
    setNextStatus(status)
    setReason("")
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        className="grid gap-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTab value="directory">
            Agents ({agents.data?.total ?? 0})
          </TabsTab>
          <TabsTab value="invitations">
            Invitations ({invitations.data?.items.length ?? 0})
          </TabsTab>
        </TabsList>

        <TabsPanel value="directory">
        <PanelSection>

          <PanelToolbar className="lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)_auto_auto]">
            <PanelSearch
              value={search}
              onValueChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder="Search agents"
              label="Search agents"
            />
            <PanelToolbarSpacer />
            {canManage ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Invite agent"
                  onClick={() => setInviting(true)}
                >
                  <MailPlus />
                </Button>
                <Button
                  size="icon"
                  aria-label="Add existing customer as agent"
                  onClick={() => setAdding(true)}
                >
                  <Plus />
                </Button>
              </>
            ) : null}
          </PanelToolbar>

          <PanelRecords>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Agents - {agents.data?.total ?? 0}</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-36">Availability</TableHead>
                <TableHead className="w-28">Rating</TableHead>
                <TableHead className="w-28">Capacity</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.data?.items.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        agent.status === "ACTIVE"
                          ? "success"
                          : agent.status === "SUSPENDED"
                            ? "error"
                            : "warning"
                      }
                    >
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {agent.availabilityStatus.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    {agent.averageRating.toFixed(1)} ({agent.reviewCount})
                  </TableCell>
                  <TableCell>{agent.maxActiveCases}</TableCell>
                  <TableCell className="px-5">
                    <div className="flex justify-end gap-2">
                      {canManage && agent.status !== "ACTIVE" &&
                        agent.status !== "RETIRED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStatus(agent, "ACTIVE")}
                          >
                            <ShieldCheck /> Approve
                          </Button>
                        )}
                      {canManage && agent.status === "ACTIVE" && (
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Manage availability for ${agent.email}`}
                          onClick={() => {
                            setAvailabilityAgent(agent)
                            setAvailability(agent.availabilityStatus)
                            setCapacity(agent.maxActiveCases)
                          }}
                        >
                          <Settings2 />
                        </Button>
                      )}
                      {canManage && agent.status !== "SUSPENDED" &&
                        agent.status !== "RETIRED" && (
                          <Button
                            size="icon"
                            variant="destructive-outline"
                            aria-label={`Suspend ${agent.email}`}
                            onClick={() => openStatus(agent, "SUSPENDED")}
                          >
                            <UserRoundX />
                          </Button>
                        )}
                      {canManage && agent.status !== "RETIRED" && (
                        <Button
                          size="sm"
                          variant="destructive-outline"
                          onClick={() => openStatus(agent, "RETIRED")}
                        >
                          Retire
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <PanelEmptyRow
                colSpan={6}
                when={(agents.data?.items.length ?? 0) === 0}
                icon={UserRoundCheck}
                title={agents.isPending ? "Loading…" : "No agents yet"}
                description={agents.isError ? "Agents could not be loaded." : "Verified agents appear here once they are approved."}
              />
            </TableBody>
          </Table>
          </PanelRecords>
          <TablePagination
            currentPage={agents.data?.page ?? page}
            totalPages={agents.data?.pageCount ?? 1}
            totalItems={agents.data?.total}
            pageSize={agents.data?.pageSize}
            onPageChange={setPage}
          />
        </PanelSection>
        </TabsPanel>

        <TabsPanel value="invitations">
        <PanelSection>
          <PanelRecords>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-40">Expires</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.data?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "PENDING" ? "warning" : "secondary"
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.expiresAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive-outline"
                      disabled={!canManage || item.status !== "PENDING"}
                      onClick={() => revokeInvite.mutate(item.id)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <PanelEmptyRow
                colSpan={4}
                when={(invitations.data?.items.length ?? 0) === 0}
                icon={MailPlus}
                title={
                  invitations.isPending
                    ? "Loading invitations…"
                    : "No agent invitations"
                }
                description="Invite an agent and their invitation appears here until it is accepted."
              />
            </TableBody>
          </Table>
          </PanelRecords>
        </PanelSection>
        </TabsPanel>
      </Tabs>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Add existing customer</DialogTitle>
            <DialogDescription>
              The agent starts pending and unavailable.
            </DialogDescription>
          </DialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              add.mutate()
            }}
          >
            <DialogPanel className="space-y-4">
              <Field>
                <FieldLabel>Find customer</FieldLabel>
                <Input
                  value={candidateSearch}
                  onChange={(event) => {
                    setCandidateSearch(event.target.value)
                    setCandidateId("")
                  }}
                  minLength={2}
                  placeholder="Name or email"
                />
              </Field>
              {candidateSearch.trim().length >= 2 && (
              <div className="space-y-2 rounded-xl border p-2">
                {candidates.isPending ? (
                  <p className="p-3 text-sm text-muted-foreground">Searching…</p>
                ) : candidates.data?.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No matching customer found.
                  </p>
                ) : (
                candidates.data?.map((candidate) => (
                  <Button
                    key={candidate.id}
                    type="button"
                    variant={
                      candidateId === candidate.id ? "secondary" : "ghost"
                    }
                    className="h-auto w-full justify-start text-left"
                    onClick={() => setCandidateId(candidate.id)}
                  >
                    <span>
                      <span className="block">{candidate.name}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {candidate.email}
                      </span>
                    </span>
                  </Button>
                )))}
              </div>
              )}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                loading={add.isPending}
                disabled={!candidateId}
              >
                Create pending agent
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Invite an agent</DialogTitle>
            <DialogDescription>
              The invitation expires after seven days.
            </DialogDescription>
          </DialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              invite.mutate()
            }}
          >
            <DialogPanel className="space-y-4">
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
              </Field>
              {inviteLink && (
                <Alert variant="success">
                  <MailPlus />
                  <AlertTitle>Invitation ready</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 flex gap-2">
                      <Input value={inviteLink} readOnly />
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
                disabled={!inviteEmail.trim()}
              >
                Create invitation
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(statusAgent)}
        onOpenChange={(open) => !open && setStatusAgent(null)}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {nextStatus === "ACTIVE"
                ? "Approve agent"
                : nextStatus === "SUSPENDED"
                  ? "Suspend agent"
                  : "Retire agent"}
            </DialogTitle>
            <DialogDescription>
              {nextStatus === "RETIRED"
                ? "Retirement is terminal and returns this account to customer status."
                : "Suspension closes every active session."}
            </DialogDescription>
          </DialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              changeStatus.mutate()
            }}
          >
            <DialogPanel>
              {nextStatus !== "ACTIVE" && (
                <Field>
                  <FieldLabel>Reason</FieldLabel>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    minLength={3}
                    maxLength={500}
                    required
                  />
                </Field>
              )}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                variant={nextStatus === "ACTIVE" ? "default" : "destructive"}
                loading={changeStatus.isPending}
                disabled={nextStatus !== "ACTIVE" && reason.trim().length < 3}
              >
                Confirm
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(availabilityAgent)}
        onOpenChange={(open) => !open && setAvailabilityAgent(null)}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Agent availability</DialogTitle>
            <DialogDescription>
              Control whether this active agent can receive new work.
            </DialogDescription>
          </DialogHeader>
          <Form
            className="contents"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              changeAvailability.mutate()
            }}
          >
            <DialogPanel className="space-y-4">
              <Field>
                <FieldLabel>Availability</FieldLabel>
                <Select
                  items={availabilityItems}
                  value={availability}
                  onValueChange={(value) => value && setAvailability(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {availabilityItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Maximum active cases</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  value={capacity}
                  onChange={(event) => setCapacity(Number(event.target.value))}
                />
                <FieldDescription>
                  Assignment enforcement will connect to this limit in Phase 4.
                </FieldDescription>
              </Field>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" loading={changeAvailability.isPending}>
                Save
              </Button>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
