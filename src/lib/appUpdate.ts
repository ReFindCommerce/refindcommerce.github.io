import { hasSavedDrafts, onActiveDraftStateChange } from './draftState';

const APP_UPDATE_EVENT = 'refind-app-update-available';

let hasActiveEditorDraft = false;
let pendingWorker: ServiceWorker | null = null;
let reloadingForUpdate = false;
let activeRegistration: ServiceWorkerRegistration | null = null;

function notifyUpdateAvailable(): void {
  window.dispatchEvent(new CustomEvent(APP_UPDATE_EVENT, { detail: { available: true } }));
}

function canReloadForUpdate(): boolean {
  return !hasActiveEditorDraft && !hasSavedDrafts();
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

  await activeRegistration.update();
  return Boolean(pendingWorker || activeRegistration.waiting);
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
}
