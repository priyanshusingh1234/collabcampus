"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
};

const COOKIE_NAME = "cc_consent";
const COOKIE_MAX_AGE_DAYS = 180; // 6 months

function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const json = decodeURIComponent(match.split("=")[1] || "");
    const parsed = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed &&
      parsed.necessary === true &&
      typeof parsed.analytics === "boolean" &&
      typeof parsed.marketing === "boolean"
    ) {
      return parsed as Consent;
    }
  } catch {}
  return null;
}

function writeConsent(consent: Consent) {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60; // seconds
  const value = encodeURIComponent(JSON.stringify(consent));
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) setShow(true);
  }, []);

  if (!show) return null;

  const acceptAll = () => {
    writeConsent({ necessary: true, analytics: true, marketing: true, timestamp: Date.now() });
    setShow(false);
  };

  const rejectNonEssential = () => {
    writeConsent({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() });
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <Card className="mx-auto max-w-3xl p-4 shadow-lg border bg-white">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700">
            We use cookies to improve your experience. "Necessary" cookies are required to run the
            site. You can accept all cookies or reject non‑essential ones.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={rejectNonEssential}>Reject non‑essential</Button>
            <Button onClick={acceptAll}>Accept all</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
