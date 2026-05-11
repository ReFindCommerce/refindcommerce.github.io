import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  enablePushNotifications,
  getPushPermissionState,
  isIosBrowser,
  isStandaloneApp,
  supportsPushNotifications,
} from '@/lib/pushNotifications';

export function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getPushPermissionState().then(setPermission);
  }, []);

  const enableNotifications = async () => {
    if (!supportsPushNotifications()) {
      toast({
        title: 'Notifications unavailable',
        description: isIosBrowser()
          ? 'Open this inbox in Safari, add it to your Home Screen, then enable notifications from the installed app.'
          : 'This browser does not support app notifications.',
        variant: 'destructive',
      });
      return;
    }

    if (isIosBrowser() && !isStandaloneApp()) {
      toast({
        title: 'Install first',
        description: 'On iPhone, open in Safari and use Share > Add to Home Screen. Then open the installed app and enable notifications.',
      });
      return;
    }

    setLoading(true);

    try {
      await enablePushNotifications();
      setPermission('granted');
      toast({
        title: 'Notifications enabled',
        description: 'New customer messages can now appear as app notifications on this device.',
      });
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      toast({
        title: 'Notifications not enabled',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setPermission(await getPushPermissionState());
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || permission === 'denied';
  const title =
    permission === 'granted'
      ? 'Notifications enabled'
      : permission === 'denied'
        ? 'Notifications blocked'
        : 'Enable notifications';

  return (
    <Button
      variant={permission === 'granted' ? 'default' : 'ghost'}
      size="icon"
      onClick={enableNotifications}
      className="h-8 w-8"
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : permission === 'denied' ? (
        <BellOff className="w-4 h-4" />
      ) : (
        <Bell className="w-4 h-4" />
      )}
    </Button>
  );
}
