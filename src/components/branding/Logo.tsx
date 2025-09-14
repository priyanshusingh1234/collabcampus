"use client";

import * as React from "react";

interface LogoProps { className?: string; withBg?: boolean; variant?: 'gradient' | 'outline' | 'black'; }

export function Logo({ className, withBg = false, variant = 'gradient' }: LogoProps) {
  const isOutline = variant === 'outline';
  const isBlack = variant === 'black';
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Manthan Logo"
      className={className}
    >
      <defs>
        <linearGradient id="manthan-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {withBg && (
        <rect
          width="64"
          height="64"
          rx="14"
          fill={isOutline ? 'transparent' : (isBlack ? '#ffffff' : '#111827')}
          className={isOutline ? 'stroke-white/20 backdrop-blur-sm' : (isBlack ? 'fill-white dark:fill-white' : 'dark:fill-[#0B1120]')}
        />
      )}
      <path
        d="M16 48 V20 a4 4 0 0 1 4-4 h0 a4 4 0 0 1 3.6 2.4 L32 40 l8.4-21.6A4 4 0 0 1 44 16h0a4 4 0 0 1 4 4v28"
        fill="none"
        stroke={isOutline ? 'white' : (isBlack ? '#111827' : 'url(#manthan-g)')}
        strokeWidth={isOutline ? 4.5 : 5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="32"
        cy="14"
        r={isOutline ? 4 : 5}
        fill={isOutline ? 'none' : (isBlack ? '#111827' : 'url(#manthan-g)')}
        stroke={isOutline ? 'white' : (isBlack ? '#111827' : 'none')}
        strokeWidth={isOutline ? 2 : 0}
      />
      <text
        x="32"
        y="54"
        textAnchor="middle"
        fontSize="14"
        fontFamily="'Space Grotesk', 'Inter', system-ui, sans-serif"
        fill={isOutline ? 'white' : (isBlack ? '#111827' : '#94A3B8')}
        opacity={0.0}
      >M</text>
    </svg>
  );
}

export default Logo;
