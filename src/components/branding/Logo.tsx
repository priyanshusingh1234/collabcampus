"use client";

import * as React from "react";

export function Logo({ className }: { className?: string }) {
  // Minimal "CC" monogram mark using two nested C-shaped arcs. Adapts to currentColor.
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M16.5 5.5a8 8 0 1 0 0 12" />
      <path d="M19.5 7.5a6 6 0 1 0 0 9" />
    </svg>
  );
}

export default Logo;
