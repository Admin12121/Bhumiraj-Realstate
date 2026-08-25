"use client";

import { useEffect, useRef, useState } from "react";

type QrCodeStyling = new (config: Record<string, unknown>) => {
  append: (container: HTMLElement) => void;
};

declare global {
  interface Window {
    QRCodeStyling?: QrCodeStyling;
  }
}

const SCRIPT_SRC = "/qr-code-styling.js";

let loader: Promise<boolean> | null = null;

function loadLibrary(): Promise<boolean> {
  if (window.QRCodeStyling) return Promise.resolve(true);

  loader ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener(
      "load",
      () => resolve(Boolean(window.QRCodeStyling)),
      { once: true },
    );
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  }).then((ok) => {
    // A failed load must not be cached, or one transient network error would
    // leave every later attempt showing the fallback.
    if (!ok) loader = null;
    return ok;
  });

  return loader;
}

/**
 * Renders a QR from a value, with the secret still readable underneath when
 * the library cannot load — an authenticator can always be set up by hand.
 */
export function QrCode({ value }: { value: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const target = container.current;
    if (!target || !value) return;

    void loadLibrary().then((ready) => {
      if (cancelled || !target) return;
      if (!ready || !window.QRCodeStyling) {
        setFailed(true);
        return;
      }

      target.replaceChildren();
      try {
        new window.QRCodeStyling({
          width: 200,
          height: 200,
          type: "svg",
          data: value,
          margin: 6,
          qrOptions: { errorCorrectionLevel: "H" },
          dotsOptions: { color: "#111827", type: "rounded" },
          backgroundOptions: { color: "#ffffff", round: 0.08 },
          cornersSquareOptions: { type: "extra-rounded", color: "#111827" },
          cornersDotOptions: { type: "dot", color: "#111827" },
          image: "/Logo.webp",
          imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.16,
            margin: 4,
            crossOrigin: "anonymous",
          },
        }).append(target);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="grid size-56 place-items-center p-2" data-slot="qr-frame">
      <div className="grid size-52 place-items-center overflow-hidden rounded-xl bg-white p-1">
        {failed ? (
          <p className="px-4 text-center text-muted-foreground text-xs">
            QR unavailable — enter the key below by hand.
          </p>
        ) : (
          <div ref={container} />
        )}
      </div>
    </div>
  );
}
