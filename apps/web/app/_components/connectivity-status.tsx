"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type ConnectivityState = "offline" | "online" | null;

export function ConnectivityStatus() {
  const [state, setState] = useState<ConnectivityState>(null);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearRecoveryTimer = () => {
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    };
    const handleOffline = () => {
      clearRecoveryTimer();
      setState("offline");
    };
    const handleOnline = () => {
      clearRecoveryTimer();
      setState("online");
      recoveryTimer.current = setTimeout(() => setState(null), 3_000);
    };

    if (!navigator.onLine) handleOffline();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearRecoveryTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!state) return null;

  return (
    <Alert
      variant={state === "offline" ? "warning" : "success"}
      className="fixed left-1/2 top-3 z-[90] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 bg-white shadow-lg"
    >
      {state === "offline" ? <WifiOff /> : <Wifi />}
      <AlertTitle>
        {state === "offline" ? "You are offline" : "Back online"}
      </AlertTitle>
      <AlertDescription>
        {state === "offline"
          ? "You can keep browsing loaded content. Posting, messages, and bids will resume after reconnection."
          : "Live data and account actions are available again."}
      </AlertDescription>
    </Alert>
  );
}
