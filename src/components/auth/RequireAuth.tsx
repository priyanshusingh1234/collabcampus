"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">Checking authentication…</div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in required</CardTitle>
          <CardDescription>You need to be signed in to perform this action.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/sign-in">
            <Button>Go to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
