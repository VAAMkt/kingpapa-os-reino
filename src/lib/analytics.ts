declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fire-and-forget analytics tracker.
 * - SSR-safe (no-op si no hay window)
 * - En dev: console.log
 * - En prod: window.gtag('event', ...) si está disponible
 * - Nunca lanza: cualquier error se silencia para no romper UX
 * - No enviar PII (nombre, teléfono, dirección, etc.)
 */
export function track(event: string, payload?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    if (import.meta.env.DEV) {
      console.log("[KP Analytics]", event, payload ?? {});
      return;
    }
    window.gtag?.("event", event, payload ?? {});
  } catch {
    /* never break UX por analytics */
  }
}

export {};
