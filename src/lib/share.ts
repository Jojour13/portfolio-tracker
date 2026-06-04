"use client";

import { domToPng } from "modern-screenshot";

/** Render a DOM node to a PNG data URL at high resolution. */
export async function captureNode(node: HTMLElement): Promise<string> {
  return domToPng(node, {
    scale: 3,
    backgroundColor: "#09090b",
    style: { transform: "none" },
  });
}

/**
 * Share the image via the Web Share API (great on mobile -> WhatsApp/IG/X),
 * falling back to a file download on desktop. Returns what happened.
 */
export async function shareOrDownload(
  dataUrl: string,
  filename = "folio.png",
): Promise<"shared" | "downloaded"> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: "My portfolio · Folio" });
      return "shared";
    }
  } catch {
    // fall through to download (user may have cancelled share too)
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
  return "downloaded";
}
