"use client";

import React from "react";
import dynamic from "next/dynamic";

const FullTiptap = dynamic(() => import("@/components/ui/tiptap").then(m => m.TiptapEditor), {
  ssr: false,
});
const Simple = dynamic(
  () => import("@/components/ui/templates/simple-editor").then((m) => m.SimpleEditor),
  { ssr: false }
);

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  variant?: "full" | "simple";
};

export default function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Write something...",
  className,
  variant = "simple",
}: RichTextEditorProps) {
  return (
    <div className={className}>
      {variant === "simple" ? (
        <Simple value={value} onChange={onChange} readOnly={readOnly} placeholder={placeholder} />
      ) : (
        <FullTiptap value={value} onChange={onChange} readOnly={readOnly} placeholder={placeholder} />
      )}
    </div>
  );
}
