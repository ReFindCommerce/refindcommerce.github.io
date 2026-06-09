import { onActiveDraftStateChange } from './draftState';

const APP_UPDATE_EVENT = 'refind-app-update-available';
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

let hasActiveEditorDraft = false;
let pendingWorker: ServiceWorker | null = null;
let reloadingForUpdate = false;
let activeRegistration: ServiceWorkerRegistration | null = null;
let updateCheckInFlight = false;

function notifyUpdateAvailable(): void {
  window.dispatchEvent(new CustomEvent(APP_UPDATE_EVENT, { detail: { available: true } }));
}

function canReloadForUpdate(): boolean {
  return !hasActiveEditorDraft;
}

function activatePendingUpdate(): void {
  if (!pendingWorker || !canReloadForUpdate()) return;

  pendingWorker.postMessage({ type: 'SKIP_WAITING' });
  pendingWorker = null;
}

export function hasPendingAppUpdate(): boolean {
  return Boolean(pendingWorker);
}

export function applyPendingAppUpdate(): boolean {
  if (!pendingWorker) return false;

  pendingWorker.postMessage({ type: 'SKIP_WAITING' });
  pendingWorker = null;
  return true;
}

export async function checkForAppUpdate(): Promise<boolean> {
  if (!activeRegistration) return false;

  await checkRegistrationForUpdate();
  return Boolean(pendingWorker || activeRegistration.waiting);
}

async function checkRegistrationForUpdate(): Promise<void> {
  if (!activeRegistration || updateCheckInFlight) return;

  updateCheckInFlight = true;

  try {
    await activeRegistration.update();

    if (activeRegistration.waiting) {
      pendingWorker = activeRegistration.waiting;
      notifyUpdateAvailable();
      activatePendingUpdate();
    }
  } catch (error) {
    console.warn('App update check failed:', error);
  } finally {
    updateCheckInFlight = false;
  }
}

export async function refreshAppShell(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if (activeRegistration) {
    await activeRegistration.update();

    if (activeRegistration.waiting) {
      pendingWorker = activeRegistration.waiting;
      applyPendingAppUpdate();
      return;
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set('app-refresh', Date.now().toString());
  window.location.replace(url.toString());
}

export function onAppUpdateAvailable(callback: () => void): () => void {
  window.addEventListener(APP_UPDATE_EVENT, callback);
  return () => window.removeEventListener(APP_UPDATE_EVENT, callback);
}

export function watchAppUpdates(registration: ServiceWorkerRegistration): void {
  activeRegistration = registration;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'ACTIVE_DRAFT_STATE') {
      hasActiveEditorDraft = Boolean(event.data.active);
      activatePendingUpdate();
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  onActiveDraftStateChange((active) => {
    hasActiveEditorDraft = active;
    activatePendingUpdate();
  });

  const handleInstalledWorker = (worker: ServiceWorker) => {
    if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
    pendingWorker = worker;
    notifyUpdateAvailable();
    activatePendingUpdate();
  };

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      handleInstalledWorker(worker);
    });
  });

  if (registration.waiting) {
    pendingWorker = registration.waiting;
    notifyUpdateAvailable();
    activatePendingUpdate();
  }

  window.setTimeout(checkRegistrationForUpdate, 3000);
  window.setInterval(checkRegistrationForUpdate, UPDATE_CHECK_INTERVAL_MS);
  window.addEventListener('online', checkRegistrationForUpdate);
  window.addEventListener('pageshow', checkRegistrationForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkRegistrationForUpdate();
    }
  });
}
