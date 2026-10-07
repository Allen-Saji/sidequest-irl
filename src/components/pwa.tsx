"use client";
import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function InstallContent() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setEvent(
      (window as Window & { sidequestInstall?: InstallEvent })
        .sidequestInstall ?? null,
    );
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return (
    <div className="sheet-content install-content">
      <span className="install-flag">
        <Download size={28} />
      </span>
      <h3>
        A little adventure.
        <br />
        In your pocket.
      </h3>
      <p>Add Sidequest to your home screen for the full app experience.</p>
      {installed ? (
        <p className="notice">You are already using the installed app.</p>
      ) : event ? (
        <button
          className="button primary"
          onClick={async () => {
            await event.prompt();
            const result = await event.userChoice;
            if (result.outcome === "accepted") setInstalled(true);
            setEvent(null);
          }}
        >
          Install Sidequest <Download size={18} />
        </button>
      ) : (
        <div className="install-steps">
          <p>
            <strong>iPhone / iPad</strong>
            <br />
            Open in Safari. Tap <Share2 size={15} /> Share, then Add to Home
            Screen.
          </p>
          <p>
            <strong>Android</strong>
            <br />
            Open in Chrome. Tap the browser menu, then Install app or Add to
            Home screen.
          </p>
          <p className="fine-print">
            Installation requires an HTTPS address. Localhost also works for
            desktop testing.
          </p>
        </div>
      )}
      <p className="fine-print">
        The offline screen is available without a connection. Live quests and
        confirmations need internet.
      </p>
    </div>
  );
}
export function usePwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const handler = (e: Event) => {
      e.preventDefault();
      (
        window as Window & { sidequestInstall?: InstallEvent }
      ).sidequestInstall = e as InstallEvent;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
}
