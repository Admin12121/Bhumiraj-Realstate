"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, CreditCard, UsersRound } from "lucide-react";

import { getAdminUserDetail } from "@/features/admin/api/admin-api";
import { formatMinorAmount } from "@/shared/utilities/money";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelEmptyRow } from "../../_components/panel-layout";

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell className="align-middle text-sm font-medium">
        {label}
      </TableCell>
      <TableCell className="align-middle text-sm">{children}</TableCell>
    </TableRow>
  );
}

/**
 * One account, read the way the reference console reads a record: a details
 * table you can scan top to bottom, with what the account owns beside it.
 */
export function AdminUserDetail({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => getAdminUserDetail(userId),
  });

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Loading account…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          This account could not be loaded.
        </p>
        <Button
          variant="outline"
          className="w-fit"
          render={<Link href="/dashboard/users" />}
        >
          <ChevronLeft />
          Back to users
        </Button>
      </div>
    );
  }

  const user = query.data;
  const suspended = user.banned || user.lifecycleStatus !== "ACTIVE";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Back to users"
            render={<Link href="/dashboard/users" />}
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">{user.name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="sm" variant="secondary">
            {user.accountType}
          </Badge>
          <Badge size="sm" variant={suspended ? "error" : "success"}>
            {user.banned ? "Suspended" : user.lifecycleStatus}
          </Badge>
          <Badge size="sm" variant={user.emailVerified ? "success" : "outline"}>
            {user.emailVerified ? "Verified" : "Unverified"}
          </Badge>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Frame>
            <div className="flex items-center gap-4 p-4">
              <Avatar className="size-14 rounded-xl">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="rounded-xl text-base font-semibold">
                  {initials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {user.username ? `@${user.username}` : "No username set"}
                </p>
              </div>
            </div>
          </Frame>

          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">User details</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DetailRow label="User ID">
                  <code className="text-xs">{user.id}</code>
                </DetailRow>
                <DetailRow label="Name">{user.name}</DetailRow>
                <DetailRow label="Email">
                  <span className="inline-flex items-center gap-2">
                    {user.email}
                    {user.emailVerified ? (
                      <Badge size="sm" variant="success">
                        Verified
                      </Badge>
                    ) : null}
                  </span>
                </DetailRow>
                <DetailRow label="Phone">
                  {user.phone ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
                <DetailRow label="Account type">{user.accountType}</DetailRow>
                <DetailRow label="Status">
                  <Badge size="sm" variant={suspended ? "error" : "success"}>
                    {user.banned ? "Suspended" : user.lifecycleStatus}
                  </Badge>
                </DetailRow>
                {user.banReason ? (
                  <DetailRow label="Suspension reason">
                    <span className="text-destructive">{user.banReason}</span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Two-factor">
                  <Badge
                    size="sm"
                    variant={user.twoFactorEnabled ? "success" : "secondary"}
                  >
                    {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </DetailRow>
                <DetailRow label="Sign-in methods">
                  {user.providers.length ? (
                    <span className="flex flex-wrap gap-1">
                      {user.providers.map((provider) => (
                        <Badge key={provider} size="sm" variant="outline">
                          {provider}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
                <DetailRow label="Created">
                  {new Date(user.createdAt).toLocaleString()}
                </DetailRow>
                <DetailRow label="Last seen">
                  {user.lastSeenAt
                    ? new Date(user.lastSeenAt).toLocaleString()
                    : "Never"}
                </DetailRow>
              </TableBody>
            </Table>
          </Frame>
        </div>

        <div className="grid content-start gap-4">
          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Properties — {user.counts.listings}</TableHead>
                  <TableHead className="w-28 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.listings.slice(0, 8).map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="max-w-0">
                      <Link
                        href={`/properties/${listing.slug}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {listing.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {listing.priceMinor
                          ? formatMinorAmount(
                              listing.priceMinor,
                              listing.currency,
                            )
                          : "Auction"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge size="sm" variant="secondary">
                        {listing.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <PanelEmptyRow
                  colSpan={2}
                  when={user.listings.length === 0}
                  icon={Building2}
                  title="No properties"
                  description="This account has not listed a property."
                  compact
                />
              </TableBody>
            </Table>
          </Frame>

          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Agents — {user.agents.length}</TableHead>
                  <TableHead className="w-32 text-right">Via</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.agents.slice(0, 8).map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="max-w-0">
                      <Link
                        href={`/admin/users/${agent.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {agent.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {agent.email}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        size="sm"
                        variant={
                          agent.via === "ASSIGNMENT" ? "success" : "secondary"
                        }
                      >
                        {agent.via === "ASSIGNMENT" ? "Represents" : "Messaged"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <PanelEmptyRow
                  colSpan={2}
                  when={user.agents.length === 0}
                  icon={UsersRound}
                  title="No agent contact"
                  description="No agent has messaged or represented this account."
                  compact
                />
              </TableBody>
            </Table>
          </Frame>
        </div>
      </div>

      <Frame>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Payments — {user.counts.payments}</TableHead>
              <TableHead className="w-36">Method</TableHead>
              <TableHead className="w-40">Amount</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-32 text-right">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {user.payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="max-w-0">
                  <p className="truncate font-medium">{payment.listingTitle}</p>
                  {payment.reference ? (
                    <p className="truncate text-xs text-muted-foreground">
                      Ref {payment.reference}
                    </p>
                  ) : null}
                  {payment.rejectionReason ? (
                    <p className="truncate text-xs text-destructive">
                      {payment.rejectionReason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>{payment.method}</TableCell>
                <TableCell className="tabular-nums">
                  {formatMinorAmount(payment.amountMinor, payment.currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    size="sm"
                    variant={
                      payment.status === "APPROVED"
                        ? "success"
                        : payment.status === "REJECTED"
                          ? "error"
                          : "warning"
                    }
                  >
                    {payment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(payment.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            <PanelEmptyRow
              colSpan={5}
              when={user.payments.length === 0}
              icon={CreditCard}
              title="No payments"
              description="This account has not submitted a listing-fee payment."
            />
          </TableBody>
        </Table>
      </Frame>
    </div>
  );
}
