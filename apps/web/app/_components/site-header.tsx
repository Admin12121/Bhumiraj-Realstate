"use client";

import Link from "next/link";
import { Bell, MessageCircle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { BrandLogo } from "@/shared/components/brand-logo";

export function SiteHeader({
  authenticated,
  query,
  onQueryChange,
}: {
  authenticated: boolean;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-2 px-2 lg:gap-2">
        <BrandLogo
          compact
          className="shrink-0 min-[800px]:hidden [&_img]:size-8 [&_img]:rounded-lg"
        />
        <InputGroup className="min-w-0 flex-1">
          <InputGroupInput aria-label="Search" type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search properties, locations, agents..."
          />
             <InputGroupAddon>
               <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end" className="hidden sm:flex">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>
        
        {authenticated ? (
          <>
            <Link
              aria-label="Notifications"
              href="/account/alerts"
              className="hidden rounded-full p-2.5 hover:bg-slate-100 sm:block"
            >
              <Bell className="size-5" />
            </Link>
            <Link
              aria-label="Messages"
              href="/account/messages"
              className="hidden rounded-full p-2.5 hover:bg-slate-100 sm:block"
            >
              <MessageCircle className="size-5" />
            </Link>
          </>
        ) : null}
  
        <Link
          href="/post-property"
          className={cn(
            buttonVariants({ variant: "default" }),
            "hidden min-[800px]:inline-flex",
          )}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Post Property</span>
        </Link>
      </div>
    </header>
  );
}
