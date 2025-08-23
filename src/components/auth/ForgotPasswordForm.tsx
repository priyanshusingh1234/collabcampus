"use client";

import { z } from "zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { auth, sendPasswordResetEmail } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
});

export default function ForgotPasswordForm() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setBusy(true);
    setErrorMsg("");
    try {
      await sendPasswordResetEmail(auth as any, values.email);
      toast({ title: "Reset link sent", description: "Check your email for a password reset link." });
    } catch (error: any) {
      let message = "Couldn't send reset email.";
      if (error?.code === "auth/user-not-found") message = "No user found with this email.";
      else if (error?.code === "auth/invalid-email") message = "Invalid email address.";
      else if (error?.code === "auth/too-many-requests") message = "Too many attempts. Please try again later.";
      else if (error?.code === "auth/network-request-failed") message = "Network error. Check your connection or allow Firebase requests (disable ad blockers/shields).";
      toast({ variant: "destructive", title: "Request failed", description: message });
      setErrorMsg(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto w-full space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} disabled={busy} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
          </Button>
        </form>
      </Form>
      {errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}
      <div className="text-center text-sm">
        <Link href="/auth/sign-in" className="text-primary hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
