import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyPendingAppUpdate, checkForAppUpdate, hasPendingAppUpdate, onAppUpdateAvailable } from '@/lib/appUpdate';
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
          title: 'App is up to date',
          description: 'No newer version is waiting on this device.',
        });
      }
    } catch (error) {
      console.error('Failed to check for app update:', error);
      toast({
        title: 'Update check failed',
        description: 'Reload the app and try again.',
        variant: 'destructive',
      });
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
      title={updateAvailable ? 'Update app now' : 'Check for app updates'}
      aria-label={updateAvailable ? 'Update app now' : 'Check for app updates'}
      disabled={checking}
    >
      <RotateCcw className={checking ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
    </Button>
  );
}
