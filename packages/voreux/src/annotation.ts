import type { Page } from "@browserbasehq/stagehand";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function annotatePoint(
  page: Page,
  opts: { x: number; y: number; label?: string; durationMs?: number },
  hooks?: { onShown?: () => Promise<void> | void },
): Promise<void> {
  const durationMs = opts.durationMs ?? 700;
  await page.evaluate(
    (point: { x: number; y: number; label?: string; durationMs: number }) => {
      const marker = document.createElement("div");
      marker.setAttribute("data-voreux-click-marker", "true");
      marker.style.position = "fixed";
      marker.style.left = `${point.x - 14}px`;
      marker.style.top = `${point.y - 14}px`;
      marker.style.width = "28px";
      marker.style.height = "28px";
      marker.style.borderRadius = "9999px";
      marker.style.background = "rgba(239, 68, 68, 0.95)";
      marker.style.border = "3px solid white";
      marker.style.boxShadow = "0 0 0 6px rgba(239, 68, 68, 0.28)";
      marker.style.zIndex = "2147483647";
      marker.style.pointerEvents = "none";

      document.body.appendChild(marker);

      let pill: HTMLDivElement | null = null;
      if (point.label) {
        pill = document.createElement("div");
        pill.setAttribute("data-voreux-click-marker-label", "true");
        pill.textContent = point.label;
        pill.style.position = "fixed";
        pill.style.left = "50%";
        pill.style.bottom = "32px";
        pill.style.transform = "translateX(-50%)";
        pill.style.padding = "10px 14px";
        pill.style.borderRadius = "9999px";
        pill.style.background = "rgba(239, 68, 68, 0.95)";
        pill.style.color = "white";
        pill.style.fontSize = "18px";
        pill.style.fontWeight = "800";
        pill.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
        pill.style.zIndex = "2147483647";
        pill.style.pointerEvents = "none";
        pill.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.25)";
        document.body.appendChild(pill);
      }

      setTimeout(() => {
        marker.remove();
        pill?.remove();
      }, point.durationMs);
    },
    { ...opts, durationMs },
  );
  await hooks?.onShown?.();
  await sleep(durationMs);
}

export async function annotateKey(
  page: Page,
  key: string,
  durationMs = 1000,
  hooks?: { onShown?: () => Promise<void> | void },
): Promise<void> {
  await page.evaluate(
    (payload: { key: string; durationMs: number }) => {
      const backdrop = document.createElement("div");
      backdrop.setAttribute("data-voreux-key-marker-backdrop", "true");
      backdrop.style.position = "fixed";
      backdrop.style.inset = "0";
      backdrop.style.background = "rgba(0, 0, 0, 0.22)";
      backdrop.style.zIndex = "2147483646";
      backdrop.style.pointerEvents = "none";

      const marker = document.createElement("div");
      marker.setAttribute("data-voreux-key-marker", "true");
      marker.textContent = `⌨ ${payload.key}`;
      marker.style.position = "fixed";
      marker.style.left = "50%";
      marker.style.top = "50%";
      marker.style.transform = "translate(-50%, -50%)";
      marker.style.padding = "20px 28px";
      marker.style.borderRadius = "16px";
      marker.style.background = "rgba(17, 24, 39, 0.96)";
      marker.style.color = "white";
      marker.style.fontSize = "32px";
      marker.style.fontWeight = "800";
      marker.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
      marker.style.letterSpacing = "0.02em";
      marker.style.zIndex = "2147483647";
      marker.style.pointerEvents = "none";
      marker.style.boxShadow = "0 16px 40px rgba(0, 0, 0, 0.35)";

      document.body.appendChild(backdrop);
      document.body.appendChild(marker);
      setTimeout(() => {
        backdrop.remove();
        marker.remove();
      }, payload.durationMs);
    },
    { key, durationMs },
  );
  await hooks?.onShown?.();
  await sleep(durationMs);
}
