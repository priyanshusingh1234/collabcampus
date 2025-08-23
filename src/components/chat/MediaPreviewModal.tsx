"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";

export type MediaPreviewModalProps = {
  open: boolean;
  url: string | null;
  filename?: string | null;
  mimeType?: string | null;
  caption: string;
  setCaption: (v: string) => void;
  onCancel: () => void;
  onSend: () => void;
};

export default function MediaPreviewModal({ open, url, filename, mimeType, caption, setCaption, onCancel, onSend }: MediaPreviewModalProps) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onCancel]);

  if (!open || !url) return null;

  const mt = mimeType || "";
  const isVideo = mt.startsWith("video/");
  const isImage = mt.startsWith("image/") || (!!url && /(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/i.test(url));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-3 text-white">
        <div className="truncate max-w-[70%] text-sm opacity-80">{filename || "Attachment"}</div>
        <button className="p-2" onClick={onCancel} aria-label="Close">
          <Icons.X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        {isVideo ? (
          <video src={url} controls className="max-h-[70vh] max-w-full rounded" />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="preview" className="max-h-[70vh] max-w-full object-contain rounded" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <div className="w-16 h-16 rounded bg-white/10 flex items-center justify-center">📎</div>
            <div className="text-sm">{filename || "Attachment"}</div>
          </div>
        )}
      </div>
      <div className="p-3 flex items-center gap-2 bg-black/60">
        <input
          className="flex-1 bg-white/10 text-white placeholder:text-white/60 rounded px-3 py-2 outline-none"
          placeholder="Add a caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <Button onClick={onSend} variant="secondary">Send</Button>
      </div>
    </div>
  );
}
