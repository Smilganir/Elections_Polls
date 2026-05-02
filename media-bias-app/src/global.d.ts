/// <reference types="vite/client" />

declare global {
  interface Window {
    dataLayer?: unknown[]
    /** Google Analytics gtag.js (poll-tracker uses the same Measurement ID). */
    gtag?: (...args: unknown[]) => void
  }
}

export {}
