"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Request = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

/**
 * Replacement for `confirm()`: a real dialog that matches the rest of the UI,
 * can be styled and is reachable by keyboard. `ask` opens it, so a caller reads
 * much like the browser primitive it replaces.
 */
export function useConfirm(): {
  ask: (request: Request) => void;
  dialog: ReactNode;
} {
  const [request, setRequest] = useState<Request | null>(null);

  const ask = useCallback((next: Request) => setRequest(next), []);

  const dialog = (
    <AlertDialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) setRequest(null);
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline">{request?.cancelLabel ?? "Cancel"}</Button>}
          />
          <Button
            variant={request?.destructive ? "destructive" : "default"}
            onClick={() => {
              request?.onConfirm();
              setRequest(null);
            }}
          >
            {request?.confirmLabel ?? "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );

  return { ask, dialog };
}
