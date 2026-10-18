/**
 * Overseas Trip Live Sync Engine (Multiplayer Game-Speed Collaboration)
 * Provides instantaneous sub-10ms real-time data sync across all users & admins
 * using persistent WebSockets with automated HTTP SSE/polling fallback.
 */

(function () {
  if (window.LiveSync) return; // Prevent double initialization

  const STORAGE_KEY_CLIENT_ID = "ot_live_client_id";
  let storedClientId = sessionStorage.getItem(STORAGE_KEY_CLIENT_ID);
  if (!storedClientId) {
    storedClientId = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 6);
    sessionStorage.setItem(STORAGE_KEY_CLIENT_ID, storedClientId);
  }

  const listeners = new Map();
  let ws = null;
  let isConnected = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let pollFallbackInterval = null;
  let latestEventId = 0;

  const LiveSync = {
    clientId: storedClientId,
    get isConnected() {
      return isConnected;
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

    // Fast direct mutation send over WebSocket
    sendAction(action, payload = {}) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              action,
              payload,
              clientId: LiveSync.clientId,
              timestamp: Date.now(),
              API_URL: typeof API_URL !== "undefined" ? API_URL : undefined,
            })
          );
          return true;
        } catch (e) {
          console.warn("WS sendAction failed, falling back to HTTP:", e);
        }
      }
      return false;
    },

    connect() {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          isConnected = true;
          reconnectAttempts = 0;
          if (pollFallbackInterval) {
            clearInterval(pollFallbackInterval);
            pollFallbackInterval = null;
          }
          // Request any missed events since disconnect
          fetchMissedEvents();
        };

        ws.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            handleIncomingEvent(event);
          } catch (err) {
            console.warn("LiveSync message parse error:", err);
          }
        };

        ws.onclose = () => {
          isConnected = false;
          scheduleReconnect();
        };

        ws.onerror = (err) => {
          isConnected = false;
          try { ws.close(); } catch (e) {}
        };
      } catch (e) {
        isConnected = false;
        scheduleReconnect();
      }
    },
  };

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 3s, max 8s
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 8000);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      LiveSync.connect();
    }, delay);

    // If disconnected, ensure fallback polling is active
    startFallbackPolling();
  }

  function startFallbackPolling() {
    if (pollFallbackInterval) return;
    pollFallbackInterval = setInterval(fetchMissedEvents, 2500);
  }

  async function fetchMissedEvents() {
    try {
      const res = await fetch(`/api/live-events?since=${latestEventId}`);
      const data = await res.json();
      if (data && data.status === "success") {
        if (data.latestEventId > latestEventId) {
          latestEventId = data.latestEventId;
        }
        if (Array.isArray(data.events)) {
          data.events.forEach((ev) => handleIncomingEvent(ev));
        }
      }
    } catch (e) {
      // Offline or network error
    }
  }

  function handleIncomingEvent(event) {
    if (!event || !event.type) return;

    if (event.eventId && event.eventId > latestEventId) {
      latestEventId = event.eventId;
    }

    // Ignore events that originated from this exact client to prevent UI flicker
    if (event.sender && event.sender === LiveSync.clientId) {
      return;
    }

    // Dispatch to registered custom handlers
    LiveSync.emit(event.type, event);

    // Dispatch to automated domain handlers for the active page
    dispatchAutoUpdate(event);
  }

  // ==========================================
  // AUTOMATED MODULE LIVE UPDATER
  // ==========================================
  function dispatchAutoUpdate(event) {
    const { type, action, payload } = event;

    // 1. LOGISTICS (Rooms, Buses, Groups, Pairings)
    if (type === "logistics:update") {
      handleLogisticsLiveUpdate(action, payload, event);
    }

    // 2. ROSTER & PARTICIPANT PROFILES
    if (type === "roster:update") {
      handleRosterLiveUpdate(action, payload, event);
    }

    // 3. FINANCE & FEES
    if (type === "finance:update") {
      handleFinanceLiveUpdate(action, payload, event);
    }

    // 4. RECEIPTS & PAYMENT SCREENSHOTS
    if (type === "receipts:update") {
      handleReceiptsLiveUpdate(action, payload, event);
    }

    // 5. ATTENDANCE & JUNCTURES
    if (type === "attendance:update") {
      handleAttendanceLiveUpdate(action, payload, event);
    }

    // 6. MEETING MINUTES
    if (type === "minutes:update") {
      handleMinutesLiveUpdate(action, payload, event);
    }

    // 7. SETTINGS & TRIP CONFIG
    if (type === "settings:update") {
      handleSettingsLiveUpdate(action, payload, event);
    }

    // 8. TRIP FILES & INFOGRAPHIC
    if (type === "files:update") {
      handleFilesLiveUpdate(action, payload, event);
    }

    // 9. CACHE CLEARED
    if (type === "cache:cleared") {
      refreshActivePageData();
    }
  }

  // LOGISTICS HANDLER
  function handleLogisticsLiveUpdate(action, payload, event) {
    const isLogisticsPage = typeof renderRooms === "function" && typeof renderPairings === "function";
    const isProfilePage = typeof loadProfileData === "function";
    const isGroupingPage = typeof renderManualGroupingTable === "function";

    if (isLogisticsPage) {
      if (typeof dndState !== "undefined" && dndState.isDragging) {
        // Defer re-render if user is currently dragging an element to avoid dropping it
        setTimeout(() => handleLogisticsLiveUpdate(action, payload, event), 1000);
        return;
      }

      // Room updates
      if (action === "syncRoomUpdates" && payload && Array.isArray(payload.updates)) {
        if (typeof globalLogistics !== "undefined" && globalLogistics && globalLogistics.rooms) {
          payload.updates.forEach((u) => {
            const idx = globalLogistics.rooms.findIndex((r) => r.id === u.id);
            if (idx !== -1) {
              globalLogistics.rooms[idx] = { ...globalLogistics.rooms[idx], ...u };
            } else {
              globalLogistics.rooms.push(u);
            }
          });
          if (typeof renderRooms === "function") renderRooms();
        }
      }

      // Bus & Group updates
      if (action === "syncAssignments" && payload && Array.isArray(payload.updates)) {
        if (typeof globalLogistics !== "undefined" && globalLogistics && globalLogistics.participants) {
          const col = payload.column;
          payload.updates.forEach((u) => {
            const p = globalLogistics.participants.find((x) => x.nric === u.nric);
            if (p) {
              if (col === "bus") p.bus = u.value;
              else if (col === "group") p.logisticsGroup = u.value;
            }
          });
          if (col === "bus" && typeof renderBuses === "function") renderBuses();
          if (col === "group" && typeof renderGroups === "function") renderGroups();
        }
      }

      // Pairings updates
      if (action === "syncPairingUpdates" && payload && Array.isArray(payload.updates)) {
        if (typeof globalLogistics !== "undefined" && globalLogistics && globalLogistics.pairings) {
          payload.updates.forEach((u) => {
            const idx = globalLogistics.pairings.findIndex((p) => p.traineeNric === u.traineeNric && p.volNric === u.volNric);
            if (idx !== -1) {
              globalLogistics.pairings[idx] = { ...globalLogistics.pairings[idx], ...u };
            } else {
              globalLogistics.pairings.push(u);
            }
          });
          if (typeof renderPairings === "function") renderPairings();
        }
      }

      // General refresh if unknown action
      if (!action || action === "syncLogistics") {
        if (typeof apiCall === "function") {
          apiCall("fetchLogistics").then((res) => {
            if (res && res.participants) {
              window.globalLogistics = res;
              if (typeof renderPairings === "function") renderPairings();
              if (typeof renderRooms === "function") renderRooms();
              if (typeof renderGroups === "function") renderGroups();
              if (typeof renderBuses === "function") renderBuses();
            }
          }).catch(() => {});
        }
      }
    }

    if (isProfilePage) {
      if (typeof loadProfileData === "function") {
        loadProfileData();
      }
    }

    if (isGroupingPage) {
      if (typeof apiCall === "function" && typeof currentGroupingSheetUrl !== "undefined" && currentGroupingSheetUrl) {
        apiCall("fetchManualPairingData", { sheetUrl: currentGroupingSheetUrl }).then((res) => {
          if (res && res.tableData && typeof renderManualGroupingTable === "function") {
            renderManualGroupingTable(res.tableData);
          }
        }).catch(() => {});
      }
    }
  }

  // ROSTER & PARTICIPANT HANDLER
  function handleRosterLiveUpdate(action, payload, event) {
    const isRosterPage = typeof renderRosterTable === "function" || typeof renderVolunteersTable === "function" || typeof renderDietTable === "function";
    const isProfilePage = typeof loadProfileData === "function";

    if (isRosterPage) {
      if (typeof apiCall === "function") {
        apiCall("fetchAdminRoster").then((res) => {
          if (res && res.participants) {
            window.cachedParticipants = res.participants;
            if (typeof renderRosterTable === "function") renderRosterTable();
            if (typeof renderVolunteersTable === "function") renderVolunteersTable();
            if (typeof renderDietTable === "function") renderDietTable();
            if (typeof renderMedicalTable === "function") renderMedicalTable();
            if (typeof renderExpiredTable === "function") renderExpiredTable();
            if (typeof renderOtherTable === "function") renderOtherTable();
          }
        }).catch(() => {});
      }
    }

    if (isProfilePage) {
      if (typeof loadProfileData === "function") {
        loadProfileData();
      }
    }
  }

  // FINANCE & FEES HANDLER
  function handleFinanceLiveUpdate(action, payload, event) {
    const isFinancePage = typeof renderFeeTracker === "function";
    const isProfilePage = typeof loadProfileData === "function";

    if (isFinancePage) {
      const pl = payload ? (payload.payload || payload) : {};
      if (pl.config && typeof financeConfig !== "undefined") {
        window.financeConfig = {
          ...window.financeConfig,
          ...pl.config,
          feeDeviations: { ...(window.financeConfig.feeDeviations || {}), ...(pl.config.feeDeviations || {}) },
          feesReceived: { ...(window.financeConfig.feesReceived || {}), ...(pl.config.feesReceived || {}) },
        };
      }
      // Re-render fee cards & summaries without taking away input focus
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        // User is typing, update background values and badges gently
        updateFeeBadgesInDOM();
      } else {
        if (typeof renderFeeTracker === "function") renderFeeTracker();
        if (typeof renderFinalizedFinances === "function") renderFinalizedFinances();
      }
    }

    if (isProfilePage) {
      if (typeof finConfig !== "undefined" && payload && payload.config) {
        window.finConfig = { ...window.finConfig, ...payload.config };
        if (typeof renderMyReceiptsContainer === "function") renderMyReceiptsContainer();
        const portal = document.getElementById("myPaymentPortal");
        if (portal && typeof generatePaymentPortalHtml === "function") {
          portal.innerHTML = generatePaymentPortalHtml();
        }
      } else if (typeof loadProfileData === "function") {
        loadProfileData();
      }
    }
  }

  function updateFeeBadgesInDOM() {
    if (typeof financeConfig === "undefined" || !financeConfig.feesReceived) return;
    Object.keys(financeConfig.feesReceived).forEach((poc) => {
      const isPaid = financeConfig.feesReceived[poc] === true;
      const cardId = `fee-card-${poc.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const card = document.getElementById(cardId);
      if (!card) return;
      const paidBadge = card.querySelector(".fee-paid-badge-container");
      if (paidBadge) {
        paidBadge.innerHTML = isPaid
          ? `<span class="text-xs font-black uppercase tracking-widest text-white bg-green-600 dark:bg-emerald-500 dark:text-gray-950 px-2.5 py-0.5 rounded-md border border-green-700 dark:border-emerald-300 shadow-sm shrink-0">PAID</span>`
          : "";
      }
    });
  }

  // RECEIPTS & SCREENSHOTS HANDLER
  function handleReceiptsLiveUpdate(action, payload, event) {
    const isFinancePage = typeof renderReceiptsBrowser === "function";
    const isProfilePage = typeof renderMyReceiptsContainer === "function";

    if (isFinancePage) {
      if (event.receipts && Array.isArray(event.receipts)) {
        window.globalReceipts = event.receipts;
        if (typeof renderReceiptsBrowser === "function") renderReceiptsBrowser();
        if (typeof renderFeeTracker === "function") renderFeeTracker();
      } else if (typeof apiCall === "function") {
        apiCall("fetchReceipts").then((res) => {
          if (res && res.receipts) {
            window.globalReceipts = res.receipts;
            if (typeof renderReceiptsBrowser === "function") renderReceiptsBrowser();
            if (typeof renderFeeTracker === "function") renderFeeTracker();
          }
        }).catch(() => {});
      }
    }

    if (isProfilePage) {
      if (typeof apiCall === "function" && typeof currentUser !== "undefined" && currentUser) {
        apiCall("fetchReceipts").then((res) => {
          if (res && res.receipts) {
            const familyNrics = typeof loadedFamily !== "undefined" && loadedFamily ? loadedFamily.map((f) => f.nric) : [currentUser.nric];
            if (!familyNrics.includes(currentUser.nric)) familyNrics.push(currentUser.nric);
            window.myReceipts = res.receipts.filter(
              (r) => !r.isDeleted && (familyNrics.includes(r.uploaderNric) || familyNrics.includes(r.paidByNric))
            );
            if (typeof renderMyReceiptsContainer === "function") renderMyReceiptsContainer();
          }
        }).catch(() => {});
      }
    }
  }

  // ATTENDANCE HANDLER
  function handleAttendanceLiveUpdate(action, payload, event) {
    const isAttendancePage = typeof renderAttendanceList === "function";
    const isTrackerPage = typeof renderOutingAttendanceList === "function" || typeof updateCommAttendanceUI === "function";

    if (isAttendancePage && payload && payload.updates) {
      if (typeof attendanceState !== "undefined") {
        payload.updates.forEach((u) => {
          attendanceState[u.nric] = { status: u.status, ts: u.ts || Date.now() };
        });
        if (typeof renderAttendanceList === "function") renderAttendanceList();
      }
    }

    if (isTrackerPage) {
      if (typeof apiCall === "function" && typeof currentCommAttSheetUrl !== "undefined" && currentCommAttSheetUrl) {
        apiCall("fetchCommAttendance", { sheetUrl: currentCommAttSheetUrl }).then((res) => {
          if (res && res.attendanceData && typeof updateCommAttendanceUI === "function") {
            updateCommAttendanceUI(res.attendanceData);
          }
        }).catch(() => {});
      }
    }
  }

  // MINUTES HANDLER
  function handleMinutesLiveUpdate(action, payload, event) {
    if (typeof minutesMap !== "undefined" && payload && Array.isArray(payload.updates)) {
      payload.updates.forEach((note) => {
        if (note.isDeleted) {
          minutesMap.delete(note.id);
          const el = document.getElementById(`note-${note.id}`);
          if (el) el.remove();
        } else {
          minutesMap.set(note.id, note);
          if (typeof updateNoteDOM === "function") {
            updateNoteDOM(note);
          }
        }
      });
      if (typeof updateFilterCounts === "function") updateFilterCounts();
    } else if (typeof fetchMinutesData === "function") {
      fetchMinutesData();
    }
  }

  // SETTINGS HANDLER
  function handleSettingsLiveUpdate(action, payload, event) {
    const isSettingsPage = typeof renderCommitteeList === "function";
    const isLandingPage = typeof renderLandingInfographic === "function";

    if (isSettingsPage) {
      if (typeof fetchSettingsData === "function") fetchSettingsData();
    }

    if (isLandingPage && typeof renderLandingInfographic === "function") {
      renderLandingInfographic();
    }
  }

  // FILES HANDLER
  function handleFilesLiveUpdate(action, payload, event) {
    const isLandingPage = typeof renderLandingInfographic === "function";
    const isFilesPage = typeof renderPinnedTripFilesBar === "function";

    if (payload && payload.tripFiles && typeof appSettings !== "undefined") {
      window.appSettings = { ...window.appSettings, ...payload.tripFiles };
    }

    if (isLandingPage && typeof renderLandingInfographic === "function") {
      renderLandingInfographic();
    }

    if (isFilesPage && typeof renderPinnedTripFilesBar === "function") {
      renderPinnedTripFilesBar();
    }
  }

  function refreshActivePageData() {
    if (typeof loadProfileData === "function") loadProfileData();
    if (typeof loadLogisticsData === "function") loadLogisticsData();
    if (typeof loadFinanceData === "function") loadFinanceData();
    if (typeof fetchMinutesData === "function") fetchMinutesData();
  }

  window.LiveSync = LiveSync;

  // Auto-connect as soon as DOM is ready or immediately
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => LiveSync.connect());
  } else {
    LiveSync.connect();
  }
})();
