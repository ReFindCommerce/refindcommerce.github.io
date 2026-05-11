import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandaloneApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getInstallInstructions() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  if (isIos) {
    return {
      title: 'Install on iPhone',
      steps: [
        'Open this page in Safari.',
        'Tap the Share button.',
        'Choose Add to Home Screen, then tap Add.',
      ],
      note: 'iPhone does not use a normal download button for this type of app, and Chrome on iPhone may not show the Add to Home Screen option.',
    };
  }

  if (isAndroid) {
    return {
      title: 'Install on Android',
      steps: [
        'Open this page in Chrome.',
        'Tap the browser menu.',
        'Choose Install app or Add to Home screen.',
      ],
      note: 'If the option is missing, refresh once after deployment and try again.',
    };
  }

  return {
    title: 'Install ReFind Inbox',
    steps: [
      'Open this inbox in Chrome or Edge.',
      'Use the install icon in the address bar, or choose Install app from the browser menu.',
    ],
    note: 'The installed app is the same inbox, just opened in its own app-style window.',
  };
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const instructions = getInstallInstructions();

  useEffect(() => {
    setInstalled(isStandaloneApp());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (installed) return null;

  const installApp = async () => {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome !== 'dismissed') {
      setInstalled(true);
    }
    setInstallPrompt(null);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={installApp}
        className="h-8 w-8"
        title="Install app"
        aria-label="Install app"
      >
        <Download className="w-4 h-4" />
      </Button>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{instructions.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5">
              {instructions.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>{instructions.note}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
