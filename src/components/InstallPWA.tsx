import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "vrcf.pwa.dismiss";

export function InstallPWA() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || !evt) return null;

  return (
    <div className="fixed left-3 right-3 bottom-[4.5rem] z-50 md:left-auto md:right-4 md:bottom-4 md:w-80 rounded-lg border border-border bg-card p-3 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm">
          <p className="font-medium">Instalar a VRCF</p>
          <p className="text-muted-foreground text-xs">Abre em ecrã inteiro, como uma app.</p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
          className="text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Button
        className="mt-2 w-full"
        onClick={async () => {
          await evt.prompt();
          setHidden(true);
        }}
      >
        <Download className="h-4 w-4 mr-1" /> Instalar
      </Button>
    </div>
  );
}
