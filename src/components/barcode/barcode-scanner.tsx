"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

type Status = "idle" | "scanning" | "looking" | "unsupported" | "denied";

/**
 * Camera scanner via the native BarcodeDetector API (Chrome/Android, Safari 17+ behind flag).
 * Always offers manual EAN entry – the lookup flow is identical.
 */
export function BarcodeScanner({ query }: { query: string }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (code: string) => {
      setStatus("looking");
      setError(null);
      try {
        const res = await fetch(`/api/foods/barcode/${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error("lookup");
        const data = (await res.json()) as { foodId: string | null };
        const sep = query ? `?${query}` : "";
        router.push(data.foodId ? `/log/food/${data.foodId}${sep}` : `/foods/new?barcode=${code}&from=log`);
      } catch {
        setError("Suche fehlgeschlagen. Bitte erneut versuchen.");
        setStatus("idle");
      }
    },
    [query, router],
  );

  useEffect(() => {
    const Detector = window.BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setStatus("unsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setStatus("scanning");
        const tick = async () => {
          if (stopped || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const code = codes.find((c) => /^\d{8,14}$/.test(c.rawValue))?.rawValue;
          if (code) {
            stopped = true;
            stream?.getTracks().forEach((t) => t.stop());
            void lookup(code);
            return;
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setStatus("denied");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [lookup]);

  return (
    <div className="space-y-5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-muted">
        <video ref={video} className="size-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-primary" />
        {status !== "scanning" && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-body-sm text-muted-foreground">
            {status === "looking"
              ? "Produkt wird gesucht …"
              : status === "denied"
                ? "Kein Kamerazugriff. Gib den Barcode unten ein."
                : status === "unsupported"
                  ? "Dein Browser unterstützt den Kamera-Scan nicht. Gib den Barcode unten ein."
                  : "Kamera wird gestartet …"}
          </p>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.replace(/\D/g, "");
          if (code.length >= 8) void lookup(code);
          else setError("Bitte einen gültigen Barcode (8–14 Ziffern) eingeben.");
        }}
      >
        <Input aria-label="Barcode" inputMode="numeric" placeholder="z. B. 4000417025005" value={manual} onChange={(e) => setManual(e.target.value)} wrapperClassName="flex-1" />
        <Button type="submit" loading={status === "looking"}>Suchen</Button>
      </form>
      {error && <p role="alert" className="text-body-sm text-destructive-strong">{error}</p>}
    </div>
  );
}
