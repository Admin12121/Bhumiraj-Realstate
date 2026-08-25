"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Subscribes to the server's realtime channel for the signed-in user. The
 * handler is held in a ref by the caller if it closes over changing state, so
 * the socket is opened once rather than on every render.
 */
export function useRealtimeEvents(
  onEvent: (payload: unknown) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const socket: Socket = io("/realtime", {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socket.on("notification:event", onEvent);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
