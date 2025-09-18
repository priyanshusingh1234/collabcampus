"use client";

import { type BasicUser } from "@/lib/chat";
import ChatPanel from "@/components/chat/ChatPanel";

export type ChatDialogProps = {
  me: BasicUser & { uid: string };
  other: BasicUser & { uid: string };
  open: boolean;
  onOpenChange?: (v: boolean) => void;
};

export default function ChatDialog({ me, other, open, onOpenChange }: ChatDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 sm:p-4" role="dialog" aria-modal>
      <div className="w-full max-w-2xl bg-background rounded-xl shadow-xl flex flex-col h-[85vh] sm:h-[80vh]">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-base">Chat</div>
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel me={me} other={other} />
        </div>
      </div>
    </div>
  );
}
