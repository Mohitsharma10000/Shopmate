import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { Route as AuthRoute } from "./route";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  verifySubscription,
  getSubscriptionStatus,
} from "@/lib/subscription.functions";
import {
  Check,
  Crown,
  Loader2,
  Shield,
  Sparkles,
  Zap,
  BarChart3,
  Users,
  Package,
  Receipt,
  Smartphone,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subscribe")({
  head: () => ({
    meta: [{ title: "Subscribe — ShopOS" }],
  }),
  component: SubscribePage,
});

declare global {
  interface Window {
    Razorpay: any;
  }
}

const AMOUNT_INR = 999;
const AMOUNT_PAISE = AMOUNT_INR * 100;

const FEATURES = [
  { icon: Package, label: "Unlimited Inventory Management" },
  { icon: Receipt, label: "POS Billing & Invoicing" },
  { icon: Users, label: "Customer Management & CRM" },
  { icon: BarChart3, label: "Advanced Sales Reports" },
  { icon: Shield, label: "Multi-user Team Access" },
  { icon: Zap, label: "AI-Powered Business Insights" },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function SubscribePage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const verifyFn = useServerFn(verifySubscription);
  const statusFn = useServerFn(getSubscriptionStatus);

  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check if already subscribed
  const subStatus = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => statusFn(),
  });

  useEffect(() => {
    if (subStatus.data?.status === "active") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [subStatus.data, navigate]);

  const verifyMut = useMutation({
    mutationFn: (paymentId: string) =>
      verifyFn({ data: { razorpay_payment_id: paymentId } }),
    onSuccess: () => {
      setSuccess(true);
      toast.success("Payment successful! Welcome to ShopOS Pro 🎉");
      qc.setQueryData(["subscription-status"], {
        status: "active",
        payment_id: "paid",
      });
      // Navigate after a brief celebration
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 2000);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Verification failed. Contact support."
      );
    },
  });

  const handlePay = useCallback(async () => {
    setPaying(true);

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error("Failed to load Razorpay. Check your internet connection.");
      setPaying(false);
      return;
    }

    const keyId =
      (typeof import.meta !== "undefined" &&
        import.meta.env?.VITE_RAZORPAY_KEY_ID) ||
      "";

    if (!keyId) {
      toast.error("Razorpay is not configured. Contact support.");
      setPaying(false);
      return;
    }

    const options = {
      key: keyId,
      amount: AMOUNT_PAISE,
      currency: "INR",
      name: "ShopOS Pro",
      description: "Yearly subscription to ShopOS Pro",
      prefill: {
        email: user?.email || "",
        name: user?.name || "",
        method: "upi", // Prefill UPI payment method
      },
      theme: {
        color: "#6C3CE1",
      },
      handler: function (response: any) {
        if (response.razorpay_payment_id) {
          verifyMut.mutate(response.razorpay_payment_id);
        }
      },
      modal: {
        ondismiss: function () {
          setPaying(false);
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function () {
        toast.error("Payment failed. Please try again.");
        setPaying(false);
      });
      rzp.open();
    } catch {
      toast.error("Unable to open payment gateway.");
      setPaying(false);
    }
  }, [user, verifyMut]);

  if (subStatus.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Success celebration screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center animate-in fade-in zoom-in duration-500 max-w-sm">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950 grid place-items-center mb-6 shadow-md">
            <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Payment Successful!</h1>
          <p className="text-muted-foreground text-lg">
            Welcome to ShopOS Pro! Redirecting to your dashboard...
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-2xl mx-auto w-full">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Activate your account</span>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-2">
            Unlock the full power of ShopOS Pro
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Everything you need to run your shop. Upgrade now for full access.
          </p>
        </div>

        {/* Pricing Card */}
        <Card className="border-border/60 shadow-soft max-w-md mx-auto">
          <CardHeader className="text-center pb-4">
            <div className="flex items-baseline gap-1 justify-center">
              <span className="text-4xl font-bold text-foreground">₹{AMOUNT_INR}</span>
              <span className="text-muted-foreground text-sm font-medium">/ year</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Annual billing · Cancel anytime
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-t border-border/80 my-2" />

            {/* Features */}
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 grid place-items-center flex-shrink-0">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground/80 text-sm">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border/80 my-2" />

            {/* CTA */}
            <div className="space-y-4">
              <Button
                size="lg"
                onClick={handlePay}
                disabled={paying || verifyMut.isPending}
                className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-medium text-sm rounded-lg shadow-sm transition-all duration-200"
              >
                {paying || verifyMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Pay ₹{AMOUNT_INR} & Activate
                  </>
                )}
              </Button>

              {/* UPI & Payment info */}
              <div className="bg-muted/50 rounded-lg p-3 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>UPI Payment (GPay, PhonePe, Paytm) Supported</span>
                </div>
                <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" /> UPI
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" /> Credit/Debit Card
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" /> Netbanking
                  </span>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Secure SSL Checkout</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>Instant Activation</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Powered by */}
        <p className="text-center text-muted-foreground/45 text-[10px] mt-6">
          Payments secured by Razorpay
        </p>
      </div>
    </AppShell>
  );
}
