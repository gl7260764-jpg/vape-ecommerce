// The browser's install prompt (Chromium only), kept by src/instrumentation-client.ts.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Window {
  __bvsaInstallPrompt?: InstallPromptEvent | null;
}

interface Navigator {
  /** iOS Safari: true inside a home-screen web app. */
  standalone?: boolean;
}
