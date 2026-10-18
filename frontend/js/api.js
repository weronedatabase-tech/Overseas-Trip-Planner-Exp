/** * API Caller Wrapper * Uses API_URL globally defined in backend/config.js */
window.CLIENT_ID =
  window.CLIENT_ID ||
  "client_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

async function apiCall(action, payload = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      // Use proxy on the server to prevent concurrent execution limits and handle caching
      const response = await fetch("/api", {
        method: "POST",
        body: JSON.stringify({
          action: action,
          payload: payload,
          clientId: window.CLIENT_ID,
          API_URL: typeof API_URL !== "undefined" ? API_URL : "",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.warn(`API Parse Error on attempt ${i + 1}:`, text);
        throw new Error("SERVER_PARSE_ERROR");
      }

      if (data && data.status === "error") {
        throw new Error(data.message);
      }
      return data;
    } catch (err) {
      // If it's a known backend application error, do not retry
      if (
        err.message &&
        err.message !== "SERVER_PARSE_ERROR" &&
        !err.message.includes("fetch") &&
        !err.message.includes("Network")
      ) {
        throw err;
      }

      console.warn(`API attempt ${i + 1} failed:`, err.message);
      if (i === retries) {
        if (err.message === "SERVER_PARSE_ERROR")
          throw new Error(
            "Server Error: Invalid Response from Google. Please try again.",
          );
        throw err;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, i)));
    }
  }
}

// ==========================================
// REAL-TIME WEBSOCKET SYNCHRONIZATION CLIENT
// ==========================================
(function initRealtimeSync() {
  if (typeof window === "undefined" || window.__realtimeWsInitialized) return;
  window.__realtimeWsInitialized = true;

  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let pingInterval = null;
  let hasConnectedOnce = false;

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      ws = new WebSocket(wsUrl);
      window.__realtimeWs = ws;

      ws.onopen = () => {
        const isReconnect = hasConnectedOnce;
        hasConnectedOnce = true;
        reconnectAttempts = 0;

        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "ping" }));
            } catch (e) {}
          }
        }, 25000);

        if (isReconnect) {
          dispatchRealtimeUpdate({
            type: "sync:update",
            domain: "all",
            action: "reconnect",
            clientId: null,
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.type === "sync:update") {
            if (msg.clientId && msg.clientId === window.CLIENT_ID) {
              return;
            }
            dispatchRealtimeUpdate(msg);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (err) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
    reconnectAttempts++;
    reconnectTimer = setTimeout(connect, delay);
  }

  async function dispatchRealtimeUpdate(msg) {
    const domain = msg.domain || "all";

    try {
      // 1. Attendance updates
      if (domain === "attendance" || domain === "settings" || domain === "all") {
        if (typeof window.pollAttendanceNow === "function") {
          window.pollAttendanceNow();
        }
        if (typeof window.pollIcAttendanceNow === "function") {
          window.pollIcAttendanceNow();
        }
      }

      // 2. Logistics: Pairings, Rooms, Assignments
      if (domain === "pairings" || domain === "logistics" || domain === "all") {
        if (typeof window.pollPairingsNow === "function") {
          window.pollPairingsNow();
        }
      }
      if (domain === "rooms" || domain === "logistics" || domain === "all") {
        if (typeof window.pollRoomsNow === "function") {
          window.pollRoomsNow();
        }
      }
      if (domain === "logistics" || domain === "roster" || domain === "all") {
        if (typeof window.pollLogisticsAssignmentsNow === "function") {
          window.pollLogisticsAssignmentsNow();
        }
      }

      // 3. Finance & Receipts
      if (domain === "finance" || domain === "receipts" || domain === "all") {
        if (typeof window.pollFinanceNow === "function") {
          window.pollFinanceNow();
        }
      }

      // 4. Minutes
      if (domain === "minutes" || domain === "all") {
        if (typeof window.pollMinutesNow === "function") {
          window.pollMinutesNow();
        }
      }

      // 5. Outings: Manual Pairing, Grouping, Committee Attendance
      if (domain === "outing" || domain === "pairings" || domain === "all") {
        if (typeof window.pollManualPairingNow === "function") {
          window.pollManualPairingNow();
        }
      }
      if (domain === "outing" || domain === "logistics" || domain === "all") {
        if (typeof window.pollGroupingNow === "function") {
          window.pollGroupingNow();
        }
      }
      if (domain === "outing" || domain === "attendance" || domain === "all") {
        if (typeof window.pollCommAttNow === "function") {
          window.pollCommAttNow();
        }
      }

      // 6. Settings
      if (domain === "settings" || domain === "all") {
        if (typeof window.refreshSettingsRealtime === "function") {
          window.refreshSettingsRealtime();
        }
      }

      // 7. Custom registered listeners
      if (Array.isArray(window.__realtimeListeners)) {
        window.__realtimeListeners.forEach((fn) => {
          try {
            fn(msg);
          } catch (e) {}
        });
      }
    } catch (e) {
      console.warn("Realtime dispatch warning:", e);
    }
  }

  window.registerRealtimeListener = function (fn) {
    if (!Array.isArray(window.__realtimeListeners)) {
      window.__realtimeListeners = [];
    }
    if (typeof fn === "function" && !window.__realtimeListeners.includes(fn)) {
      window.__realtimeListeners.push(fn);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", connect);
  } else {
    connect();
  }
})();

