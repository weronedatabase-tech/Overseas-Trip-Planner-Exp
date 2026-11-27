/**
 * Hybrid Real-Time Sync Engine (WebSocket Push + BroadcastChannel + GAS Fallback)
 * 1. Persistent Node.js WebSocket Server (wss://): <50ms cross-device delta push & live "+ N Live" presence.
 * 2. BroadcastChannel / localStorage: 0ms same-browser cross-tab sync.
 * 3. Automatic GAS Fallback (getSyncState): engages seamlessly whenever WS server is unset or offline.
 */
(function () {
  if (window.LiveSync) return;

  const CHANNEL_NAME = "ot_live_sync_v1";
  const STORAGE_EVENT_KEY = "ot_live_sync_event";
  const STORAGE_KEY_CLIENT_ID = "ot_live_client_id";
  const WIN_NAME_PREFIX = "ot_tab:";

  const ACTIVE_FALLBACK_MS = 1500;
  const IDLE_FALLBACK_MS = 3000;
  const IDLE_THRESHOLD_MS = 90000;
  const MAX_BACKOFF_MS = 8000;

  let storedClientId = "";
  try {
    storedClientId = sessionStorage.getItem(STORAGE_KEY_CLIENT_ID) || "";
    if (!storedClientId && typeof window.name === "string" && window.name.startsWith(WIN_NAME_PREFIX)) {
      storedClientId = window.name.slice(WIN_NAME_PREFIX.length);
    }
    if (!storedClientId) {
      storedClientId =
        "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    }
    sessionStorage.setItem(STORAGE_KEY_CLIENT_ID, storedClientId);
    if (!window.name || window.name.startsWith(WIN_NAME_PREFIX)) {
      window.name = WIN_NAME_PREFIX + storedClientId;
    }
  } catch (e) {
    storedClientId =
      "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // Keep window.CLIENT_ID aligned with LiveSync clientId so server echo suppression is exact
  window.CLIENT_ID = storedClientId;

  const listeners = new Map();
  let channel = null;

  // WebSocket state
  let ws = null;
  let wsConnected = false;
  let wsHasConnectedOnce = false;
  let wsReconnectDelay = 1000;
  let wsReconnectTimer = null;
  let wsPingInterval = null;
  let wsIntentionalClose = false;
  let wsHasSentLeave = false;
  let wsPendingQueue = [];
  let currentView = detectCurrentView();
  let presenceState = {
    connected: false,
    mode: "idle", // 'ws' | 'fallback' | 'idle'
    totalOnline: 0,
    staffOnline: 0,
    adminOnline: 0,
    icOnline: 0,
    participantOnline: 0,
    viewOnline: 0,
    users: [],
  };

  // Fallback GAS polling state (used ONLY when WebSocket is unavailable/disconnected)
  let syncTimer = null;
  let syncInFlight = false;
  let lastSeq = 0;
  let lastDomains = {};
  let hasBaseline = false;
  let consecutiveErrors = 0;
  let lastUserActivityAt = Date.now();
  let lastSyncOkAt = 0;

  function detectCurrentView() {
    const p = String((window.location && window.location.pathname) || "").toLowerCase();
    if (p.includes("attendance")) return "attendance";
    if (p.includes("logistics")) return "logistics";
    if (p.includes("finance")) return "finance";
    if (p.includes("minutes")) return "minutes";
    if (p.includes("files")) return "files";
    if (p.includes("settings")) return "settings";
    if (p.includes("roster") || p.includes("diet") || p.includes("medical") || p.includes("expired") || p.includes("other")) {
      return "roster";
    }
    if (p.includes("dashboard")) return "dashboard";
    return "index";
  }

  function markActivity() {
    const wasIdle = Date.now() - lastUserActivityAt > IDLE_THRESHOLD_MS;
    lastUserActivityAt = Date.now();
    if (wasIdle && !document.hidden && !wsConnected) {
      scheduleFallbackPoll(300);
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

  function isArchiveModeActive() {
    return typeof window.isArchiveReadOnly === "function" && window.isArchiveReadOnly();
  }

  // =========================================================
  // LIVE PRESENCE HEADER PILL ("● 2 Live")
  // =========================================================
  function updateLivePresenceBadge() {
    if (typeof document === "undefined") return;
    const isLoggedIn = Boolean(getAuthTokenSafe());
    const inArchive = isArchiveModeActive();
    const shouldShow = isLoggedIn && !inArchive && (wsConnected || presenceState.mode === "ws");

    const badgeIds = ["livePresencePill", "livePresencePillDesktop", "livePresencePillMobile"];
    if (!shouldShow) {
      badgeIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden-force");
      });
      return;
    }

    const staffCount = presenceState.staffOnline || 0;
    const labelText =
      staffCount > 0 ? `${staffCount} Live` : wsConnected ? "Live" : "Syncing";
    const tooltip =
      presenceState.users && presenceState.users.length > 0
        ? "Online now: " +
          presenceState.users
            .map((u) => `${u.name}${u.role === "group_ic" && u.group ? ` (Grp ${u.group} IC)` : ""}`)
            .join(", ")
        : wsConnected
          ? "Real-time sync connected"
          : "Reconnecting to real-time server...";

    const pillId = "livePresencePill";
    let pill = document.getElementById(pillId);
    if (!pill) {
      const refreshBtn = document.querySelector(
        'header button[onclick*="updateApp"], header button[onclick*="refreshApp"]',
      );
      if (!refreshBtn || !refreshBtn.parentElement) return;
      pill = document.createElement("span");
      pill.id = pillId;
      refreshBtn.parentElement.insertBefore(pill, refreshBtn);
    }

    pill.classList.remove("hidden-force");
    pill.title = tooltip;
    if (wsConnected) {
      pill.className =
        "inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-black tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 transition-colors select-none whitespace-nowrap shrink-0";
      pill.innerHTML = `<span class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span><span>${labelText}</span>`;
    } else {
      pill.className =
        "inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-black tracking-wide border bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 transition-colors select-none whitespace-nowrap shrink-0";
      pill.innerHTML = `<span class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-500 shrink-0"></span><span>Sync</span>`;
    }
  }

  // =========================================================
  // INCOMING MESSAGE HANDLER (WS + BROADCASTCHANNEL)
  // =========================================================
  function handleIncoming(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.senderId && isOwnClient(msg.senderId) && !msg.forceApply) return;
    if (msg.clientId && isOwnClient(msg.clientId) && !msg.forceApply) return;

    if (typeof msg.syncSeq === "number" && msg.syncSeq > lastSeq) {
      lastSeq = msg.syncSeq;
    }
    if (isArchiveModeActive()) return;

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

  // Same-browser BroadcastChannel + storage event (0ms cross-tab)
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

  // =========================================================
  // PERSISTENT WEBSOCKET TRANSPORT (SUB-50ms CROSS-DEVICE PUSH)
  // =========================================================
  function clearWsTimers() {
    if (wsReconnectTimer) {
      clearTimeout(wsReconnectTimer);
      wsReconnectTimer = null;
    }
    if (wsPingInterval) {
      clearInterval(wsPingInterval);
      wsPingInterval = null;
    }
  }

  function scheduleWsReconnect() {
    if (wsIntentionalClose || document.hidden || isArchiveModeActive() || !getAuthTokenSafe()) return;
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    const delay = wsReconnectDelay;
    wsReconnectDelay = Math.min(Math.round(delay * 1.5), MAX_BACKOFF_MS);
    wsReconnectTimer = setTimeout(() => {
      wsReconnectTimer = null;
      connectWebSocket();
    }, delay);
  }

  function connectWebSocket() {
    if (wsIntentionalClose || isArchiveModeActive()) return false;
    const token = getAuthTokenSafe();
    if (!token) return false;
    const wsUrl = typeof window.getRealtimeWsUrl === "function" ? window.getRealtimeWsUrl() : "";
    if (!wsUrl || typeof WebSocket === "undefined") {
      // No Node WebSocket server configured -> run GAS fallback polling
      presenceState.mode = "fallback";
      scheduleFallbackPoll(300);
      return false;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return true;
    }

    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws = null;
    }

    let sock;
    try {
      sock = new WebSocket(wsUrl);
    } catch (e) {
      presenceState.mode = "fallback";
      scheduleFallbackPoll(500);
      scheduleWsReconnect();
      return false;
    }

    ws = sock;
    currentView = detectCurrentView();

    sock.onopen = () => {
      if (wsIntentionalClose || ws !== sock) {
        try {
          sock.close(1000, "stale");
        } catch (e) {}
        return;
      }

      const wasReconnect = wsHasConnectedOnce;
      wsConnected = true;
      wsHasConnectedOnce = true;
      wsHasSentLeave = false;
      wsReconnectDelay = 1000;
      presenceState.connected = true;
      presenceState.mode = "ws";

      // Stop fallback GAS polling while WebSocket is live!
      clearFallbackTimer();

      try {
        sock.send(
          JSON.stringify({
            type: "presence:join",
            clientId: storedClientId,
            authToken: getAuthTokenSafe(),
            view: currentView,
          }),
        );
      } catch (e) {}

      while (wsPendingQueue.length > 0) {
        const raw = wsPendingQueue.shift();
        try {
          sock.send(raw);
        } catch (e) {}
      }

      updateLivePresenceBadge();
      LiveSync.emit("connection:state", { connected: true, mode: "ws", reconnected: wasReconnect });

      if (wasReconnect && typeof window.dispatchRealtimeUpdate === "function") {
        window.dispatchRealtimeUpdate({
          type: "sync:reconnected",
          domain: "all",
          domains: ["all"],
          ts: Date.now(),
        });
      }

      if (wsPingInterval) clearInterval(wsPingInterval);
      wsPingInterval = setInterval(() => {
        if (sock.readyState === WebSocket.OPEN) {
          try {
            sock.send(JSON.stringify({ type: "ping" }));
          } catch (e) {}
        }
      }, 15000);
    };

    sock.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (!msg || !msg.type) return;

      if (msg.type === "pong") return;
      if (msg.type === "auth:error") {
        wsIntentionalClose = true;
        return;
      }
      if (msg.type === "presence:ack") {
        if (typeof msg.syncSeq === "number" && msg.syncSeq > lastSeq) {
          lastSeq = msg.syncSeq;
          hasBaseline = true;
        }
        return;
      }
      if (msg.type === "presence:state") {
        presenceState = {
          ...presenceState,
          connected: true,
          mode: "ws",
          totalOnline: msg.totalOnline || 0,
          staffOnline: msg.staffOnline || 0,
          adminOnline: msg.adminOnline || 0,
          icOnline: msg.icOnline || 0,
          participantOnline: msg.participantOnline || 0,
          viewOnline: msg.viewOnline || 0,
          users: Array.isArray(msg.users) ? msg.users : [],
        };
        updateLivePresenceBadge();
        LiveSync.emit("presence:state", presenceState);
        return;
      }

      handleIncoming(msg);
    };

    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      wsConnected = false;
      presenceState.connected = false;
      if (wsPingInterval) {
        clearInterval(wsPingInterval);
        wsPingInterval = null;
      }
      updateLivePresenceBadge();
      if (wsIntentionalClose) return;

      LiveSync.emit("connection:state", { connected: false, mode: "fallback", reconnected: false });
      // Engage automatic GAS fallback polling while WebSocket reconnects
      scheduleFallbackPoll(1200);
      scheduleWsReconnect();
    };

    sock.onerror = () => {
      try {
        sock.close();
      } catch (e) {}
    };

    return true;
  }

  function disconnectWebSocket(reason = "unload") {
    wsIntentionalClose = true;
    clearWsTimers();
    const sock = ws;
    ws = null;
    wsConnected = false;
    presenceState.connected = false;

    if (sock) {
      sock.onopen = null;
      sock.onmessage = null;
      sock.onclose = null;
      sock.onerror = null;
      if (sock.readyState === WebSocket.OPEN) {
        try {
          sock.send(JSON.stringify({ type: "presence:leave", clientId: storedClientId, reason }));
        } catch (e) {}
      }
      try {
        if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
          sock.close(1000, reason);
        }
      } catch (e) {}
    }

    const base = typeof window.getRealtimeServerBaseUrl === "function" ? window.getRealtimeServerBaseUrl() : "";
    if (base && !wsHasSentLeave && storedClientId) {
      wsHasSentLeave = true;
      try {
        const body = JSON.stringify({ clientId: storedClientId, reason });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${base}/api/presence/leave`, new Blob([body], { type: "text/plain;charset=utf-8" }));
        }
      } catch (e) {}
    }
    updateLivePresenceBadge();
  }

  // =========================================================
  // FALLBACK GAS SYNC POLLER (ONLY WHEN WS IS UNAVAILABLE)
  // =========================================================
  function clearFallbackTimer() {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  }

  function getFallbackDelayMs() {
    if (consecutiveErrors > 0) {
      return Math.min(2000 * Math.pow(2, consecutiveErrors - 1), MAX_BACKOFF_MS);
    }
    const isIdle = Date.now() - lastUserActivityAt > IDLE_THRESHOLD_MS;
    return isIdle ? IDLE_FALLBACK_MS : ACTIVE_FALLBACK_MS;
  }

  function scheduleFallbackPoll(overrideMs) {
    clearFallbackTimer();
    if (wsConnected || document.hidden || isArchiveModeActive() || !getAuthTokenSafe()) return;
    const delay = typeof overrideMs === "number" ? overrideMs : getFallbackDelayMs();
    syncTimer = setTimeout(() => {
      syncTimer = null;
      pollRemoteSyncState();
    }, delay);
  }

  async function pollRemoteSyncState() {
    if (wsConnected || syncInFlight || document.hidden || isArchiveModeActive()) return;
    if (!getAuthTokenSafe() || typeof apiCall !== "function") return;

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
            handleIncoming(msg);
          }
        }
      }
    } catch (err) {
      consecutiveErrors = Math.min(consecutiveErrors + 1, 5);
    } finally {
      syncInFlight = false;
      if (!wsConnected) scheduleFallbackPoll();
    }
  }

  // Lifecycle listeners
  window.addEventListener("pagehide", () => disconnectWebSocket("pagehide"));
  window.addEventListener("beforeunload", () => disconnectWebSocket("beforeunload"));

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      wsIntentionalClose = false;
      wsHasSentLeave = false;
      if (getAuthTokenSafe()) connectWebSocket();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearFallbackTimer();
    } else {
      lastUserActivityAt = Date.now();
      consecutiveErrors = 0;
      wsIntentionalClose = false;
      if (!getAuthTokenSafe()) return;
      if (!wsConnected) {
        if (!connectWebSocket()) pollRemoteSyncState();
      } else {
        LiveSync.setView(detectCurrentView());
      }
    }
  });

  window.addEventListener("online", () => {
    consecutiveErrors = 0;
    wsIntentionalClose = false;
    if (!document.hidden && getAuthTokenSafe()) {
      if (!connectWebSocket()) pollRemoteSyncState();
    }
  });

  window.addEventListener("focus", () => {
    lastUserActivityAt = Date.now();
    if (!document.hidden && getAuthTokenSafe()) {
      if (!wsConnected && Date.now() - lastSyncOkAt > 1200) {
        if (!connectWebSocket()) pollRemoteSyncState();
      }
    }
  });

  const LiveSync = {
    clientId: storedClientId,
    get isConnected() {
      return wsConnected || Boolean(channel) || hasBaseline;
    },
    get isWebSocketConnected() {
      return wsConnected;
    },
    get presence() {
      return presenceState;
    },
    getStatus() {
      return {
        clientId: storedClientId,
        mode: wsConnected ? "ws" : presenceState.mode,
        wsConnected,
        hasBaseline,
        lastSeq,
        lastSyncOkAt,
        consecutiveErrors,
        inFlight: syncInFlight,
        presence: presenceState,
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
    setView(view) {
      currentView = view || detectCurrentView();
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: "presence:update",
              clientId: storedClientId,
              view: currentView,
            }),
          );
        } catch (e) {}
      }
      updateLivePresenceBadge();
    },
    /**
     * Send an instant 0ms optimistic delta over WebSocket (and BroadcastChannel for sibling tabs)
     * BEFORE the debounced HTTP persistence write completes.
     */
    sendLive(type, payload = {}) {
      if (isArchiveModeActive()) return false;
      const msg = {
        ...payload,
        type,
        senderId: storedClientId,
        clientId: storedClientId,
        ts: Date.now(),
      };
      const raw = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(raw);
        } catch (e) {}
      } else if (type && type.startsWith("live:") && typeof window.getRealtimeWsUrl === "function" && window.getRealtimeWsUrl()) {
        wsPendingQueue.push(raw);
        if (wsPendingQueue.length > 50) wsPendingQueue.shift();
      }

      // Also push the corresponding delta:* to same-browser sibling tabs in 0ms
      const deltaType = type.startsWith("live:") ? "delta:" + type.slice(5) : type;
      this.broadcast({ ...msg, type: deltaType });
      return true;
    },
    startRemoteSync() {
      wsIntentionalClose = false;
      wsHasSentLeave = false;
      if (!document.hidden && getAuthTokenSafe()) {
        const startedWs = connectWebSocket();
        if (!startedWs) {
          scheduleFallbackPoll(250);
        }
      }
    },
    stopRemoteSync() {
      clearFallbackTimer();
      disconnectWebSocket("stop");
    },
    resetRemoteSync() {
      clearFallbackTimer();
      disconnectWebSocket("reset");
      hasBaseline = false;
      lastSeq = 0;
      lastDomains = {};
      consecutiveErrors = 0;
      wsHasConnectedOnce = false;
      presenceState.totalOnline = 0;
      presenceState.staffOnline = 0;
      presenceState.users = [];
      updateLivePresenceBadge();
    },
    checkNow() {
      clearFallbackTimer();
      return pollRemoteSyncState();
    },
    broadcast(msg) {
      const payload = {
        ...msg,
        senderId: msg.senderId || storedClientId,
        clientId: msg.clientId || storedClientId,
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
    sendAction(type, payload) {
      return this.sendLive(type, payload);
    },
    connect() {
      this.startRemoteSync();
      return true;
    },
    refreshPresenceBadge: updateLivePresenceBadge,
  };

  window.LiveSync = LiveSync;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => LiveSync.startRemoteSync());
  } else {
    LiveSync.startRemoteSync();
  }
})();
