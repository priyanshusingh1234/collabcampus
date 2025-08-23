"use client";

import Link from "next/link";

// Convert @username mentions in plain text to blue links to /user/[username]
// Preserves other text; safe for plain text (not HTML). For HTML sources, pass a cleaned/plain version.
export function MentionText({
  text,
  fallbackHref,
  mentionClassName,
  nonMentionClassName,
}: {
  text: string;
  fallbackHref?: string;
  mentionClassName?: string; // styles for @mentions (defaults to blue)
  nonMentionClassName?: string; // styles for other text/links (e.g., hover underline)
}) {
  if (!text) return null;
  // Split on mentions and keep delimiters
  const regex = /(@[a-zA-Z0-9_.-]{3,32})/g;
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        // Use a non-global test to avoid lastIndex state issues
        const isMention = /^@[a-zA-Z0-9_.-]{3,32}$/.test(part);
        if (isMention) {
          const username = part.slice(1);
          return (
            <Link
              key={i}
              href={`/user/${username}`}
              className={mentionClassName || "text-blue-600 hover:underline dark:text-blue-400"}
            >
              {part}
            </Link>
          );
        }
        if (fallbackHref) {
          return (
            <Link key={i} href={fallbackHref} className={nonMentionClassName}>
              {part}
            </Link>
          );
        }
        return (
          <span key={i} className={nonMentionClassName}>
            {part}
          </span>
        );
      })}
    </>
  );
}
