const VAPID_PUBLIC_KEY = 'BOgNDXzC0mNLDzz-D_IxjYrBh4jEtQ-Mh87iw9IIeJWg3--CS9pU5TJVWjDH35tXNzNm25hwd_mnOmdAIElaySI';
const PUSH_SUBSCRIBE_WEBHOOK = 'https://n8n.srv1354140.hstgr.cloud/webhook/push-subscribe';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function uint8ArraysEqual(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

function subscriptionUsesCurrentKey(subscription: PushSubscription): boolean {
  const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const subscriptionKey = subscription.options.applicationServerKey;

  if (!subscriptionKey) return false;
  return uint8ArraysEqual(new Uint8Array(subscriptionKey), currentKey);
}

export function supportsPushNotifications(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    window.isSecureContext
  );
}

export function isIosBrowser(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function isStandaloneApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function getPushPermissionState(): Promise<NotificationPermission | 'unsupported'> {
  if (!supportsPushNotifications()) return 'unsupported';
  return Notification.permission;
}

export async function enablePushNotifications(): Promise<void> {
  if (!supportsPushNotifications()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  if (isIosBrowser() && !isStandaloneApp()) {
    throw new Error('On iPhone, install the app from Safari first, then open the installed app to enable notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription && !subscriptionUsesCurrentKey(existingSubscription)) {
    await existingSubscription.unsubscribe();
  }

  const currentSubscription = await registration.pushManager.getSubscription();
  const subscription =
    currentSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  try {
    const response = await fetch(PUSH_SUBSCRIBE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        userAgent: window.navigator.userAgent,
        appUrl: window.location.origin,
        enabledAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error();
    }
  } catch {
    throw new Error('Notifications are allowed on this device, but the notification backend is not connected yet.');
  }
}
