"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { login } = useAuthStore();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState("");

  const verifyMutation = trpc.auth.verifyMagicLink.useMutation({
    onSuccess: (data) => {
      // Store the JWT token
      localStorage.setItem("relay_token", data.token);

      // Update auth store
      login(
        {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || undefined,
          projects: data.user.projects,
        },
        data.token,
      );

      setStatus("success");

      // Redirect based on whether user has projects
      setTimeout(() => {
        if (data.user.projects && data.user.projects.length > 0) {
          router.push("/dashboard/inbox");
        } else {
          router.push("/onboarding");
        }
      }, 1500);
    },
    onError: (err) => {
      setStatus("error");
      setError(err.message || "Failed to verify magic link");
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate({ token });
    } else {
      setStatus("error");
      setError("No verification token provided");
    }
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
          R
        </div>

        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              Verifying your magic link...
            </h2>
            <p className="text-muted-foreground">Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
            <h2 className="text-xl font-semibold">You're signed in!</h2>
            <p className="text-muted-foreground">
              Redirecting to your dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Verification failed</h2>
            <p className="text-muted-foreground">{error}</p>
            <div className="pt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Magic links expire after 15 minutes. Please request a new one.
              </p>
              <Button onClick={() => router.push("/auth/login")}>
                Back to Login
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
