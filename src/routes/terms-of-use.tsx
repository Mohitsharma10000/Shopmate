import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms-of-use")({
  head: () => ({
    meta: [
      { title: "Terms of Use — ShopOS" },
      { name: "description", content: "Terms of Use for ShopOS (ShopMate Pro) management platform." },
    ],
  }),
  component: TermsOfUsePage,
});

function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-background rounded-xl border border-border/60 shadow-soft p-6 sm:p-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-6 mb-8 gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary grid place-items-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-lg text-foreground">ShopOS</span>
          </div>
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link to="/auth" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Sign up
            </Link>
          </Button>
        </div>

        {/* Content */}
        <article className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Terms of Use</h1>
            <p className="text-sm">Last updated: July 2, 2026</p>
          </div>

          <p>
            Welcome to ShopOS (also referred to as "ShopMate Pro", "the platform", "our services").
            By accessing or using our application, websites, and APIs, you agree to comply with and be bound by these Terms of Use.
            Please read them carefully before creating an account.
          </p>

          <hr className="border-border/60 my-6" />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Account Registration and Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate, current, and complete registration information, including your full name, email address, and a valid phone number.</li>
              <li>You are solely responsible for maintaining the confidentiality of your account credentials (email and password) and for restricting unauthorized access to your devices.</li>
              <li>You agree to accept responsibility for all activities, sales transactions, and database entries created under your account profile.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Authorized Use of the Platform</h2>
            <p>You agree to use ShopOS strictly for lawful commercial and retail purposes. You must not:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the billing registry, khata ledger, or inventory database for fraudulent transactions or illegal/regulated sales that violate local laws.</li>
              <li>Reverse engineer, compile, copy, modify, or distribute any part of the application code, assets, or databases.</li>
              <li>Inject malicious code, viruses, or scripts, or attempt to compromise app security and access control endpoints.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Subscription, Payments, and Cancellations</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Billing Plans:</strong> Access to full features requires an active subscription plan (paid monthly/annually). Subscriptions are billed automatically in advance.
              </li>
              <li>
                <strong className="text-foreground">Cancellations:</strong> You can cancel your subscription at any time. Cancelled subscriptions will remain active until the end of the current billing period, and no partial refunds will be processed.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Platform Operations and Limitations</h2>
            <p>
              We strive to offer highly reliable cloud hosting and fast local caching. However, our services are provided on an "as-is" and "as-available" basis:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not guarantee that the services will be completely uninterrupted, timely, secure, or free from minor software bugs.</li>
              <li>We are not liable for business revenue losses, receipt formatting changes, offline browser storage clearance data loss, or printer hardware compatibility issues.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Intellectual Property Rights</h2>
            <p>
              All materials, layout designs, interfaces, branding graphics, and codebase structures are the property of ShopOS and are protected by copyright and intellectual property laws. 
              Your subscription grants you a personal, non-exclusive, non-transferable, and revocable license to access the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Termination of Services</h2>
            <p>
              We reserve the right to suspend or terminate your account access immediately, without prior notice, if you violate these Terms of Use, commit payment fraud, or engage in activities that disrupt operations for other users.
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">7. Contact Us</h2>
            <p>If you have any questions or feedback regarding these terms, please contact us:</p>
            <p className="text-foreground font-medium">Email: support@shopos.com</p>
          </section>
        </article>

        {/* Footer */}
        <div className="border-t mt-10 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ShopOS. All rights reserved.
        </div>

      </div>
    </div>
  );
}
