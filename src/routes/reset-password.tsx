import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { account } from "@/integrations/appwrite/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Store, Lock } from "lucide-react";

// Validate search query params sent by Appwrite recovery email redirection
const resetSearchSchema = z.object({
  userId: z.string(),
  secret: z.string(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: resetSearchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { userId, secret } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await account.updateRecovery(userId, secret, password);
      toast.success("Password reset successful! You can now sign in.");
      navigate({ to: "/auth" });
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password. Link may be expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative bg-primary text-primary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-accent grid place-items-center">
            <Store className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="font-semibold tracking-tight">ShopOS</span>
        </div>
        <div className="space-y-4 max-w-sm">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Reset Your Password
          </h1>
          <p className="text-primary-foreground/70">
            Securely choose a new password for your ShopOS account to log back in.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} ShopOS
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary grid place-items-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">ShopOS</span>
          </div>

          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                New password
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Set a strong password for your account.
              </p>
            </div>
          </div>

          <Card className="mt-6 border-border/60 shadow-soft">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Reset Password
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Make sure to save your password in a safe place.
          </p>
        </div>
      </div>
    </div>
  );
}
