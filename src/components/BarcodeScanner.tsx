import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, AlertCircle, Keyboard } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
}

export function BarcodeScanner({
  open,
  onScan,
  onClose,
  title = "Scan Barcode",
}: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setManualCode("");
      setCameraError("");
      setPermissionDenied(false);
      hasScanned.current = false;
      return;
    }

    hasScanned.current = false;

    const startScanner = async () => {
      // Step 1: Explicitly request camera permission FIRST
      // This is what triggers the browser permission dialog
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        // Stop the stream immediately — html5-qrcode will start its own
        stream.getTracks().forEach((t) => t.stop());
      } catch (err: any) {
        console.error("Camera permission request failed:", err);
        const errName = err?.name || "";
        if (
          errName === "NotAllowedError" ||
          errName === "PermissionDeniedError"
        ) {
          setPermissionDenied(true);
        } else {
          setCameraError(
            err?.message || "Camera not available on this device."
          );
        }
        return;
      }

      // Step 2: Wait for the DOM element to render
      await new Promise((r) => setTimeout(r, 400));

      const elementId = "barcode-scanner-container";
      const element = document.getElementById(elementId);
      if (!element) return;

      try {
        const html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (!hasScanned.current) {
              hasScanned.current = true;
              onScan(decodedText);
            }
          },
          () => {
            // ignore per-frame errors
          }
        );
      } catch (err: any) {
        console.error("Html5Qrcode start error:", err);
        setCameraError(String(err?.message || err));
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open, onScan, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (clean) {
      onScan(clean);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Position the barcode within the central box to scan automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 my-2">
          {/* Scanner view */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border flex flex-col items-center justify-center">
            {open && !cameraError && !permissionDenied && (
              <div
                id="barcode-scanner-container"
                className="absolute inset-0 w-full h-full"
              />
            )}

            {/* Scanning area green overlay box */}
            {open && !cameraError && !permissionDenied && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[250px] h-[150px] border-2 border-emerald-500 rounded-md bg-emerald-500/5 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)] absolute top-1/2 -translate-y-1/2 animate-pulse" />
                </div>
              </div>
            )}

            {/* Error States */}
            {permissionDenied && (
              <div className="text-center p-4 max-w-[85%] z-10">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-white">
                  Camera permission denied
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Please allow camera access in your browser settings or enter
                  the code manually below.
                </p>
              </div>
            )}

            {cameraError && !permissionDenied && (
              <div className="text-center p-4 max-w-[85%] z-10">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-white">
                  Camera access failed
                </p>
                <p className="text-xs text-zinc-400 mt-1">{cameraError}</p>
              </div>
            )}
          </div>

          <div className="text-center text-[10px] text-muted-foreground">
            {!cameraError && !permissionDenied
              ? "Scanning live video stream..."
              : "Camera disabled"}
          </div>

          {/* Manual Entry Fallback */}
          <div className="border-t pt-4">
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                Or enter barcode manually
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Barcode number (e.g. 8901063...)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" className="h-9">
                  Confirm
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Inline Scanner (for full-page use) ----------
interface InlineScannerProps {
  onScan: (barcode: string) => void;
  active: boolean;
}

export function InlineScanner({ onScan, active }: InlineScannerProps) {
  const [cameraError, setCameraError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const scanCooldown = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping inline scanner:", err);
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stopScanner();
      setCameraError("");
      setPermissionDenied(false);
      return;
    }

    hasScanned.current = false;
    scanCooldown.current = false;

    const startScanner = async () => {
      // Step 1: Explicitly request camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err: any) {
        const errName = err?.name || "";
        if (
          errName === "NotAllowedError" ||
          errName === "PermissionDeniedError"
        ) {
          setPermissionDenied(true);
        } else {
          setCameraError(err?.message || "Camera not available.");
        }
        return;
      }

      // Step 2: Wait for DOM
      await new Promise((r) => setTimeout(r, 500));

      const elementId = "inline-scanner-view";
      const element = document.getElementById(elementId);
      if (!element) return;

      try {
        const html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          (decodedText) => {
            if (!scanCooldown.current) {
              scanCooldown.current = true;
              onScan(decodedText);
              // Allow rescanning after 2 seconds (for continuous scanning)
              setTimeout(() => {
                scanCooldown.current = false;
              }, 2000);
            }
          },
          () => {}
        );
      } catch (err: any) {
        console.error("Inline scanner start error:", err);
        setCameraError(String(err?.message || err));
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [active, onScan, stopScanner]);

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center rounded-lg border bg-muted/20">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="text-sm font-medium">Camera permission denied</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Please allow camera access in your browser/app settings to use the
          scanner. You can also enter barcodes manually in the input field below.
        </p>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center rounded-lg border bg-muted/20">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-medium">Camera error</p>
        <p className="text-xs text-muted-foreground max-w-xs">{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border">
      <div id="inline-scanner-view" className="absolute inset-0 w-full h-full" />
      {/* Scan overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[280px] h-[160px] border-2 border-emerald-500 rounded-md bg-emerald-500/5 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
          <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
          <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)] absolute top-1/2 -translate-y-1/2 animate-pulse" />
        </div>
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-[10px] text-emerald-300 bg-black/60 px-3 py-1 rounded-full">
          Point camera at barcode
        </span>
      </div>
    </div>
  );
}
