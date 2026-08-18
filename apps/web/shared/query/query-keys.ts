export const queryKeys = {
  listings: {
    all: ["listings"] as const,
    feed: (filters: Record<string, unknown>) => ["listings", "feed", filters] as const,
    detail: (id: string) => ["listings", "detail", id] as const,
  },
  auctions: {
    detail: (id: string) => ["auctions", "detail", id] as const,
    bids: (id: string) => ["auctions", "bids", id] as const,
  },
  account: {
    overview: ["account", "overview"] as const,
    sessions: ["account", "sessions"] as const,
    passkeys: ["account", "passkeys"] as const,
  },
  agent: {
    all: ["agent"] as const,
    me: ["agent", "me"] as const,
    assignments: (status: string) => ["agent", "assignments", status] as const,
  },
  profiles: {
    detail: (id: string) => ["profiles", "detail", id] as const,
    agents: (search: string) => ["profiles", "agents", { search }] as const,
  },
  profile: (id: string) => ["profiles", "detail", id] as const,
  conversations: {
    all: ["conversations"] as const,
    messages: (id: string) => ["conversations", id, "messages"] as const,
  },
  adminUsers: (page: number, filters: Record<string, unknown>) => ["admin", "users", page, filters] as const,
  notifications: ["notifications"] as const,
};
