"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@real-estate/auth/client";
import {
  getAgentAssignments,
  getAgentSummary,
  setAgentAvailability,
} from "../api/listing-payments-api";
import { queryKeys } from "@/shared/query/query-keys";

/**
 * Whether the signed-in account is an agent, plus their caseload. Non-agents
 * get `isAgent: false` rather than an error, so the account chrome can ask on
 * every page without painting failures.
 */
export function useAgentSummary() {
  const session = useSession();

  return useQuery({
    queryKey: queryKeys.agent.me,
    queryFn: ({ signal }) => getAgentSummary(signal),
    enabled: Boolean(session.data),
    staleTime: 60_000,
  });
}

export function useAgentAssignments(status: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agent.assignments(status),
    queryFn: ({ signal }) => getAgentAssignments(status, signal),
    enabled,
  });
}

export function useSetAgentAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: "AVAILABLE" | "UNAVAILABLE") =>
      setAgentAvailability(status),
    onSuccess: (summary) => queryClient.setQueryData(queryKeys.agent.me, summary),
  });
}
