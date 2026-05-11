import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getPushPermissionState().then(setPermission);
  }, []);

  const enableNotifications = async () => {
    if (permission === 'granted' || permission === 'denied') {
      setDetailsOpen(true);
      return;
    }

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

  const showLocalTest = async () => {
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('ReFind Inbox test', {
      body: 'Local app notifications are allowed on this device.',
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      tag: 'refind-inbox-local-test',
    });
  };

  const disabled = loading;
  const title =
    permission === 'granted'
      ? 'Notifications enabled'
      : permission === 'denied'
        ? 'Notifications blocked'
        : 'Enable notifications';

  return (
    <>
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Notification Status</DialogTitle>
            <DialogDescription>
              {permission === 'granted'
                ? 'This device has allowed local app notifications.'
                : permission === 'denied'
                  ? 'This browser or installed app has blocked notification permission.'
                  : 'Notification permission has not been requested yet.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Device permission: {permission}</p>
            <p>App mode: {isStandaloneApp() ? 'installed app' : 'browser tab'}</p>
            {permission === 'denied' && (
              <p>
                Open the phone or browser notification settings for ReFind Inbox, allow notifications, then return and
                refresh the app.
              </p>
            )}
          </div>

          <DialogFooter>
            {permission === 'granted' && (
              <Button
                type="button"
                onClick={() => {
                  showLocalTest().catch((error) => {
                    console.error('Local notification test failed:', error);
                    toast({
                      title: 'Test failed',
                      description: 'The device allowed notifications, but the local test could not be shown.',
                      variant: 'destructive',
                    });
                  });
                }}
              >
                Test
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
