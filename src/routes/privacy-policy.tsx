import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ShopOS" },
      { name: "description", content: "Privacy Policy for ShopOS (ShopMate Pro) management platform." },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Privacy Policy</h1>
            <p className="text-sm">Last updated: July 2, 2026</p>
          </div>

          <p>
            Welcome to ShopOS (also referred to as "ShopMate Pro", "the platform", "we", "us", or "our"). 
            We respect your privacy and are committed to protecting the personal and business data you share with us. 
            This Privacy Policy explains how your information is collected, used, disclosed, and safeguarded when you use our shop management application.
          </p>

          <hr className="border-border/60 my-6" />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p>We collect information to provide a fast, offline-first, and secure shop management experience:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">Account Credentials:</strong> Full name, email address, phone number, and encrypted password (securely processed via Appwrite authentication services).
              </li>
              <li>
                <strong className="text-foreground">Shop Data:</strong> Store names, categories, product information (names, sales prices, purchase prices, barcode details, stock quantities, and inventory logs).
              </li>
              <li>
                <strong className="text-foreground">Transaction Logs:</strong> Recorded sales invoices, transaction totals, payment methods (Cash, Card, UPI, Credit), amount paid, and invoice details.
              </li>
              <li>
                <strong className="text-foreground">Customer Contacts:</strong> Customer names, phone numbers, and outstanding credit balances (Khata records) you choose to save on the platform.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use the collected information for the following business purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>To initialize and host your retail database so you can manage billing, inventory, and purchases.</li>
              <li>To verify your subscription state and authenticate secure user logins.</li>
              <li>To allow seamless local printing and file rendering (like receipt PDFs).</li>
              <li>To package WhatsApp billing messages when you trigger WhatsApp sharing to customers.</li>
              <li>To monitor app performance and solve database/network errors.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Data Ownership and Security</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Your Data is Yours:</strong> We do not sell, trade, rent, or monetize your product catalogs, purchase logs, sales transactions, or customer lists to any third parties. Your shop database is private to you and your authorized staff.
              </li>
              <li>
                <strong className="text-foreground">Secure Storage:</strong> All account credentials and remote database records are guarded by industry-grade encryption and secure access controls (Appwrite SSL/TLS protocols).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. WhatsApp Sharing & Local Features</h2>
            <p>
              When you use the "Share via WhatsApp" option, our platform packages the text message and opens a standard public WhatsApp web/app link to send the message. 
              We do not read, intercept, or store any of your private WhatsApp conversations or contact chats.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Your Choices & Data Deletion</h2>
            <p>
              You have the right to edit your shop listings, delete customers, and manage billing profiles at any time. 
              If you wish to terminate your account and permanently remove all profile and store databases from our active servers, please contact us at <span className="text-foreground font-medium">support@shopos.com</span>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Changes to this Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">7. Contact Us</h2>
            <p>If you have any questions or feedback about this policy, please reach out to us:</p>
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
