"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { SettingsPanel } from "./settings-panel";
import { ListingFeePanel } from "./listing-fee-panel";
import { OwnerGovernancePanel } from "./owner-governance-panel";
import { RequireStaffPermission } from "../../_components/admin-shell";

/** Platform defaults and ownership are both "what the platform is", so both live here. */
export function AdminSettingsTabs() {
  const [tab, setTab] = useState("platform");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="grid gap-4">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTab value="platform">Platform</TabsTab>
        <TabsTab value="payments">Payments</TabsTab>
        <TabsTab value="ownership">Ownership</TabsTab>
      </TabsList>

      <TabsPanel value="platform">
        <SettingsPanel />
      </TabsPanel>

      <TabsPanel value="payments">
        <ListingFeePanel />
      </TabsPanel>

      <TabsPanel value="ownership">
        <RequireStaffPermission
          permission="admin.staff.manage"
          fallback={
            <p className="rounded-xl border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
              Ownership transfer is restricted to the platform owner.
            </p>
          }
        >
          <OwnerGovernancePanel />
        </RequireStaffPermission>
      </TabsPanel>
    </Tabs>
  );
}
