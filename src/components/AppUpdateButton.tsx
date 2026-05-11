import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  applyPendingAppUpdate,
  checkForAppUpdate,
  hasPendingAppUpdate,
  onAppUpdateAvailable,
  refreshAppShell,
} from '@/lib/appUpdate';
import { useToast } from '@/hooks/use-toast';

export function AppUpdateButton() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setUpdateAvailable(hasPendingAppUpdate());
    return onAppUpdateAvailable(() => setUpdateAvailable(true));
  }, []);

  const updateNow = () => {
    if (!applyPendingAppUpdate()) {
      window.location.reload();
    }
  };

  const checkNow = async () => {
    setChecking(true);

    try {
      const foundUpdate = await checkForAppUpdate();
      setUpdateAvailable(foundUpdate || hasPendingAppUpdate());

      if (!foundUpdate && !hasPendingAppUpdate()) {
        toast({
          title: 'Refreshing app',
          description: 'Clearing the local app cache and loading the latest live version.',
        });
        await refreshAppShell();
      }
    } catch (error) {
      console.error('Failed to check for app update:', error);
      toast({
        title: 'Refreshing app',
        description: 'The update check failed, so the app will reload from the live site.',
        variant: 'destructive',
      });
      await refreshAppShell();
    } finally {
      setChecking(false);
    }
  };

  return (
    <Button
      variant={updateAvailable ? 'default' : 'ghost'}
      size="icon"
      onClick={updateAvailable ? updateNow : checkNow}
      className="h-8 w-8"
      title={updateAvailable ? 'Update app now' : 'Refresh app'}
      aria-label={updateAvailable ? 'Update app now' : 'Refresh app'}
      disabled={checking}
    >
      <RotateCcw className={checking ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
    </Button>
  );
}
