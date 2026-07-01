import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { account, authEvents, databases, APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client";
import { ID, OAuthProvider } from "appwrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — ShopOS" },
      { name: "description", content: "Sign in or create an account to manage your shop." },
    ],
  }),
  beforeLoad: async () => {
    try {
      await account.get();
      throw redirect({ to: "/dashboard" });
    } catch {}
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const userId = ID.unique();
        const displayName = name.trim() || email.split("@")[0];
        
        // 1. Create the Auth user
        await account.create(
          userId,
          email.trim(),
          password,
          displayName
        );
        
        // 2. Create the Session
        await account.createEmailPasswordSession(email.trim(), password);

        // 3. Create the user profile document in the profiles collection
        try {
          await databases.createDocument(
            APPWRITE_DATABASE_ID,
            "profiles",
            userId,
            {
              full_name: displayName,
              avatar_url: null,
              phone: null,
              active_shop_id: null,
            }
          );
        } catch (profileErr) {
          console.error("Failed to create profile document:", profileErr);
          // Don't fail sign up if profile document creation fails, but log it
        }

        toast.success("Account created. You're signed in.");
      } else {
        await account.createEmailPasswordSession(email.trim(), password);
      }
      authEvents.notify();
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true);
    try {
      await account.createOAuth2Session(
        OAuthProvider.Google,
        window.location.origin + "/dashboard", // redirect on success
        window.location.origin + "/auth" // redirect on failure
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleBusy(false);
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
            Run your shop with calm and clarity.
          </h1>
          <p className="text-primary-foreground/70">
            Inventory, billing, customers, and reports — in one fast, modern workspace.
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

          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin"
              ? "Sign in to manage your shops."
              : "Start managing your shop in minutes."}
          </p>

          <Card className="mt-6 border-border/60 shadow-soft">
            <CardContent className="p-6">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>

                <TabsContent value={mode} className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogle}
                    disabled={googleBusy}
                  >
                    {googleBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </Button>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <form onSubmit={handleEmail} className="space-y-3">
                    {mode === "signup" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Your name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jane Doe"
                          autoComplete="name"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {mode === "signin" ? "Sign in" : "Create account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.4h5.4c-.2 1.4-1.6 4-5.4 4-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.8 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-2H12z"
      />
    </svg>
  );
}
