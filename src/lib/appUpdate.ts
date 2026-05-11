import { hasSavedDrafts, onActiveDraftStateChange } from './draftState';

let hasActiveEditorDraft = false;
let pendingWorker: ServiceWorker | null = null;
let reloadingForUpdate = false;

function canReloadForUpdate(): boolean {
  return !hasActiveEditorDraft && !hasSavedDrafts();
}

function activatePendingUpdate(): void {
  if (!pendingWorker || !canReloadForUpdate()) return;

  pendingWorker.postMessage({ type: 'SKIP_WAITING' });
  pendingWorker = null;
}

export function watchAppUpdates(registration: ServiceWorkerRegistration): void {
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
    activatePendingUpdate();
  }
}
