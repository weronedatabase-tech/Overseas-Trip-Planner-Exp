/**
 * Static-Compatible Low-Latency Real-Time Sync Engine (Cross-Device + Cross-Tab)
 * - Same-browser tabs: 0ms via BroadcastChannel + localStorage storage event.
 * - Cross-device users (Admin, Group IC, Participant): ultra-lightweight CacheService-backed
 *   version-vector polling (`getSyncState`) every 1.5s when active, 3s when idle, paused when hidden,
 *   with immediate wake-up on tab focus / reconnect. Zero Node/WebSocket server required.
 */
(function () {
  if (window.LiveSync) return;

  const CHANNEL_NAME = "ot_live_sync_v1";
  const STORAGE_EVENT_KEY = "ot_live_sync_event";
  const STORAGE_KEY_CLIENT_ID = "ot_live_client_id";

  const ACTIVE_INTERVAL_MS = 1500;
  const IDLE_INTERVAL_MS = 3000;
  const IDLE_THRESHOLD_MS = 90000;
  const MAX_BACKOFF_MS = 8000;

  let storedClientId = "";
  try {
    storedClientId = sessionStorage.getItem(STORAGE_KEY_CLIENT_ID) || "";
    if (!storedClientId) {
      storedClientId =
        "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(STORAGE_KEY_CLIENT_ID, storedClientId);
    }
  } catch (e) {
    storedClientId =
      "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  const listeners = new Map();
  let channel = null;

  // Cross-device sync state
  let syncTimer = null;
  let syncInFlight = false;
  let lastSeq = 0;
  let lastDomains = {};
  let hasBaseline = false;
  let consecutiveErrors = 0;
  let lastUserActivityAt = Date.now();
  let lastSyncOkAt = 0;

  function markActivity() {
    const wasIdle = Date.now() - lastUserActivityAt > IDLE_THRESHOLD_MS;
    lastUserActivityAt = Date.now();
    if (wasIdle && !document.hidden) {
      scheduleNextSync(300);
    }
  }

  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, markActivity, { passive: true, capture: true });
  });

  function getAuthTokenSafe() {
    if (typeof getStoredAuthToken === "function") {
      return getStoredAuthToken();
    }
    try {
      const raw = localStorage.getItem("userSession");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.token) return parsed.token;
      }
    } catch (e) {}
    return "";
  }

  function isOwnClient(clientId) {
    if (!clientId) return false;
    return clientId === storedClientId || clientId === window.CLIENT_ID;
  }

  function handleIncoming(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.clientId && isOwnClient(msg.clientId)) {
      return;
    }
    if (typeof msg.syncSeq === "number" && msg.syncSeq > lastSeq) {
      lastSeq = msg.syncSeq;
    }
    if (typeof window.isArchiveReadOnly === "function" && window.isArchiveReadOnly()) {
      return;
    }
    if (msg.action === "archiveAndReset") {
      if (window.ArchiveMode && typeof window.ArchiveMode.clearAllTripBrowserCaches === "function") {
        window.ArchiveMode.clearAllTripBrowserCaches();
      }
      if (window.ArchiveMode && typeof window.ArchiveMode.refreshArchives === "function") {
        window.ArchiveMode.refreshArchives();
      }
    }
    if (msg.type) {
      LiveSync.emit(msg.type, msg);
    }
    if (typeof window.dispatchRealtimeUpdate === "function") {
      window.dispatchRealtimeUpdate(msg);
    }
  }

  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => handleIncoming(event.data);
    } catch (e) {
      channel = null;
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) return;
    try {
      handleIncoming(JSON.parse(event.newValue));
    } catch (e) {}
  });

  function clearSyncTimer() {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  }

  function getNextDelayMs() {
    if (consecutiveErrors > 0) {
      return Math.min(2000 * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF_MS);
    }
    const isIdle = Date.now() - lastUserActivityAt > IDLE_THRESHOLD_MS;
    return isIdle ? IDLE_INTERVAL_MS : ACTIVE_INTERVAL_MS;
  }

  function scheduleNextSync(overrideMs) {
    clearSyncTimer();
    if (document.hidden) return;
    if (!getAuthTokenSafe()) return;
    if (typeof window.isArchiveReadOnly === "function" && window.isArchiveReadOnly()) return;
    const delay = typeof overrideMs === "number" ? overrideMs : getNextDelayMs();
    syncTimer = setTimeout(() => {
      syncTimer = null;
      pollRemoteSyncState();
    }, delay);
  }

  async function pollRemoteSyncState() {
    if (syncInFlight) return;
    if (document.hidden) return;
    if (typeof window.isArchiveReadOnly === "function" && window.isArchiveReadOnly()) return;
    const token = getAuthTokenSafe();
    if (!token) return;
    if (typeof apiCall !== "function") {
      scheduleNextSync(1000);
      return;
    }

    syncInFlight = true;
    try {
      const res = await apiCall("getSyncState", { sinceSeq: lastSeq }, 0);
      consecutiveErrors = 0;
      lastSyncOkAt = Date.now();

      if (res && res.status === "success") {
        const serverSeq = Number(res.seq) || 0;
        const serverDomains = res.domains && typeof res.domains === "object" ? res.domains : {};

        if (!hasBaseline) {
          hasBaseline = true;
          lastSeq = serverSeq;
          lastDomains = { ...serverDomains };
          LiveSync.emit("sync:connected", { seq: lastSeq });
        } else if (res.changed && serverSeq > lastSeq) {
          const prevSeq = lastSeq;
          const prevDomains = { ...lastDomains };
          lastSeq = serverSeq;
          if (Object.keys(serverDomains).length > 0) {
            lastDomains = { ...lastDomains, ...serverDomains };
          }

          const rawEvents = Array.isArray(res.events) ? res.events : [];
          const remoteEvents = rawEvents.filter((ev) => ev && !isOwnClient(ev.clientId));
          const changedDomainSet = new Set();
          let primaryAction = "";

          if (remoteEvents.length > 0) {
            remoteEvents.forEach((ev) => {
              if (!primaryAction && ev.action) primaryAction = ev.action;
              if (Array.isArray(ev.domains)) {
                ev.domains.forEach((d) => {
                  if (d) changedDomainSet.add(d);
                });
              } else if (ev.domain) {
                changedDomainSet.add(ev.domain);
              }
            });
          } else if (rawEvents.length === 0 || serverSeq - prevSeq > rawEvents.length) {
            // Client was away longer than ring buffer or missed events -> diff domain timestamps
            Object.keys(serverDomains).forEach((d) => {
              if ((serverDomains[d] || 0) > (prevDomains[d] || 0)) {
                changedDomainSet.add(d);
              }
            });
          }

          if (changedDomainSet.size > 0) {
            const domainsArr = Array.from(changedDomainSet);
            const msg = {
              type: "sync:remote",
              action: primaryAction,
              domain: domainsArr[0],
              domains: domainsArr,
              events: remoteEvents,
              syncSeq: serverSeq,
              ts: res.global || Date.now(),
            };

            if (remoteEvents.some((e) => e.action === "archiveAndReset")) {
              if (window.ArchiveMode && typeof window.ArchiveMode.clearAllTripBrowserCaches === "function") {
                window.ArchiveMode.clearAllTripBrowserCaches();
              }
              if (window.ArchiveMode && typeof window.ArchiveMode.refreshArchives === "function") {
                window.ArchiveMode.refreshArchives();
              }
            }

            LiveSync.emit("sync:update", msg);
            if (typeof window.dispatchRealtimeUpdate === "function") {
              window.dispatchRealtimeUpdate(msg);
            }
          }
        }
      }
    } catch (err) {
      consecutiveErrors = Math.min(consecutiveErrors + 1, 5);
    } finally {
      syncInFlight = false;
      scheduleNextSync();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearSyncTimer();
    } else {
      lastUserActivityAt = Date.now();
      consecutiveErrors = 0;
      if (getAuthTokenSafe()) {
        pollRemoteSyncState();
      }
    }
  });

  window.addEventListener("online", () => {
    consecutiveErrors = 0;
    if (!document.hidden && getAuthTokenSafe()) {
      pollRemoteSyncState();
    }
  });

  window.addEventListener("focus", () => {
    lastUserActivityAt = Date.now();
    if (!document.hidden && getAuthTokenSafe() && Date.now() - lastSyncOkAt > 1200) {
      pollRemoteSyncState();
    }
  });

  const LiveSync = {
    clientId: storedClientId,
    get isConnected() {
      return Boolean(channel) || hasBaseline;
    },
    getStatus() {
      return {
        clientId: storedClientId,
        hasBaseline,
        lastSeq,
        lastSyncOkAt,
        consecutiveErrors,
        inFlight: syncInFlight,
      };
    },
    on(eventType, callback) {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, new Set());
      }
      listeners.get(eventType).add(callback);
      return () => {
        const set = listeners.get(eventType);
        if (set) set.delete(callback);
      };
    },
    emit(eventType, data) {
      const set = listeners.get(eventType);
      if (set) {
        set.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error(`Error in LiveSync listener for ${eventType}:`, e);
          }
        });
      }
    },
    noteLocalSeq(seq) {
      const n = Number(seq) || 0;
      if (n > lastSeq && n === lastSeq + 1) {
        lastSeq = n;
      }
    },
    startRemoteSync() {
      if (!document.hidden && getAuthTokenSafe()) {
        scheduleNextSync(250);
      }
    },
    stopRemoteSync() {
      clearSyncTimer();
    },
    resetRemoteSync() {
      clearSyncTimer();
      hasBaseline = false;
      lastSeq = 0;
      lastDomains = {};
      consecutiveErrors = 0;
    },
    checkNow() {
      clearSyncTimer();
      return pollRemoteSyncState();
    },
    broadcast(msg) {
      const payload = {
        ...msg,
        clientId: msg.clientId || window.CLIENT_ID || storedClientId,
        ts: msg.ts || Date.now(),
      };
      if (channel) {
        try {
          channel.postMessage(payload);
        } catch (e) {}
      }
      try {
        localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(payload));
      } catch (e) {}
    },
    sendAction() {
      // Mutations go directly through apiCall() to Google Apps Script
      return false;
    },
    connect() {
      this.startRemoteSync();
      return true;
    },
  };

  window.LiveSync = LiveSync;

  // Auto-start cross-device sync loop once DOM is ready (for any authenticated page)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => LiveSync.startRemoteSync());
  } else {
    LiveSync.startRemoteSync();
  }
})();
