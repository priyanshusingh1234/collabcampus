"use client";

import React from "react";

// A compact, high-contrast verified badge inspired by the provided image
export function VerifiedTick({ size = 14, title = "Verified" }: { size?: number; title?: string }) {
  const inner = Math.max(6, size - 6);
  const strokeW = Math.max(1.5, size / 10);
  return (
    <span title={title} aria-label={title} className="inline-flex items-center align-middle">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-label={title}
        className="drop-shadow-sm"
      >
        {/* Background circle with blue gradient */}
        <defs>
          <linearGradient id="vtick-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1da1f2" />
            <stop offset="100%" stopColor="#138ae6" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#vtick-grad)" />
        {/* Optional subtle ring */}
        <circle cx="12" cy="12" r="11" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
        {/* Checkmark */}
        <path
          d="M7.2 12.4l3.0 3.3 6.6-7.0"
          fill="none"
          stroke="#fff"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
