"use client";

import React from "react";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";

export type EmojiPickerProps = {
  onSelect: (native: string) => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
};

type EmojiMartPickerProps = {
  data: any;
  onEmojiSelect: (emoji: any) => void;
  theme?: "light" | "dark" | "auto";
  previewPosition?: string;
  navPosition?: string;
  searchPosition?: string;
};

const Picker: any = dynamic(
  () => import("@emoji-mart/react").then((m) => (m as any).default),
  { ssr: false }
);

export function EmojiPicker({ onSelect, theme = "auto", className }: EmojiPickerProps) {
  return (
    <div className={className}>
      <Picker
        data={data}
        theme={theme}
        onEmojiSelect={(emoji: any) => onSelect(emoji?.native || "")}
        previewPosition="none"
        navPosition="bottom"
        searchPosition="none"
      />
    </div>
  );
}

export default EmojiPicker;
