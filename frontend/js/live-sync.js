/**
 * Static-Compatible Cross-Tab Live Sync Engine
 * Uses BroadcastChannel (with localStorage event fallback) so multiple tabs on
 * GitHub Pages or AI Studio stay synchronized with zero Node/WebSocket server dependencies.
 */
(function () {
  if (window.LiveSync) return;

  const CHANNEL_NAME = "ot_live_sync_v1";
  const STORAGE_EVENT_KEY = "ot_live_sync_event";
  const STORAGE_KEY_CLIENT_ID = "ot_live_client_id";

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

  function handleIncoming(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.clientId && (msg.clientId === storedClientId || msg.clientId === window.CLIENT_ID)) {
      return;
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

  const LiveSync = {
    clientId: storedClientId,
    get isConnected() {
      return Boolean(channel);
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
      return Boolean(channel);
    },
  };

  window.LiveSync = LiveSync;
})();
