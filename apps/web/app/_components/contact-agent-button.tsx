"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { useSession } from "@real-estate/auth/client";

import { createConversation } from "@/features/messaging/api/messaging-api";
import { queryKeys } from "@/shared/query/query-keys";
import { errorMessage } from "@/shared/http/error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/**
 * Opens a conversation with the listing's agent. The API needs an opening
 * message, so the buyer writes one here rather than landing in an empty thread.
 */
export function ContactAgentButton({
  agentUserId,
  agentName,
  listingId,
  listingTitle,
  className,
  children,
  variant = "default",
  size,
}: {
  agentUserId: string;
  agentName: string;
  listingId?: string | undefined;
  listingTitle?: string | undefined;
  className?: string;
  children?: ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
}) {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const start = useMutation({
    mutationFn: (message: string) =>
      createConversation({
        participantId: agentUserId,
        ...(listingId ? { listingId } : {}),
        message,
      }),
    onSuccess: (conversation) => {
      setOpen(false);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      router.push(`/account/messages?conversation=${conversation.id}`);
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  function begin() {
    if (!session.data) {
      router.push(
        `/sign-in?callbackURL=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    if (session.data.user.id === agentUserId) return;
    setDraft(
      listingTitle
        ? `Hello, I am interested in "${listingTitle}". Is it still available?`
        : "Hello, I would like to discuss one of your properties.",
    );
    setOpen(true);
  }

  return (
    <>
      <Button
        className={className}
        onClick={begin}
        {...(size ? { size } : {})}
        variant={variant}
      >
        {children ?? (
          <>
            <Phone className="size-4" strokeWidth={1.8} />
            Contact Agent
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Message {agentName}</DialogTitle>
            <DialogDescription>
              This starts a conversation you can continue from your account.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Your message</FieldLabel>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Introduce yourself and say what you would like to know"
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={!draft.trim()}
              loading={start.isPending}
              onClick={() => start.mutate(draft.trim())}
            >
              Send message
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
