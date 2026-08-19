/**
 * The public URL segment for an agent. A username is stable and readable, so
 * it wins; the user id is the fallback for agents who have not set one, and
 * both resolve on the server.
 */
export function agentHandle(agent: {
  username?: string | null | undefined;
  userId?: string | null | undefined;
  id?: string | null | undefined;
}): string {
  return agent.username || agent.userId || agent.id || "";
}

export function agentHref(agent: {
  username?: string | null | undefined;
  userId?: string | null | undefined;
  id?: string | null | undefined;
}): string {
  return `/agents/${agentHandle(agent)}`;
}
