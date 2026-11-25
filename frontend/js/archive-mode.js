/**
 * Archive Mode Controller & Admin Profile Archived Trips Library
 * Provides strict read-only viewing of archived trips across all 6 admin pages and subpages.
 */
(function () {
  const STORAGE_KEY = "activeArchiveTrip";

  const READ_ONLY_API_ACTIONS = new Set([
    "getSettings",
    "fetchAdminRoster",
    "fetchLogistics",
    "fetchPairingsOnly",
    "fetchRoomsOnly",
    "fetchAttendanceData",
    "fetchFinance",
    "fetchReceipts",
    "fetchMinutes",
    "getDriveContents",
    "getProfile",
    "getPublicTrainees",
    "getArchivedTripMeta",
    "extractData",
    "listArchivedTrips",
    "login",
  ]);

  let cachedArchivedTrips = null;
  let mutationObserver = null;
  let enforceTimer = null;
  let archiveTargetContainerId = "archivedTripsSettingsSection";
  let archiveSearchQuery = "";
  let archiveYearFilter = "ALL";
  let archiveSortBy = "archived_desc";

  function normalizeArchiveMeta(item) {
    if (!item || typeof item !== "object") return item;
    const archiveId = String(item.archiveId || item.id || "").trim();
    return {
      ...item,
      id: archiveId,
      archiveId,
      tripStartDate: item.tripStartDate || item.startDate || "",
      tripEndDate: item.tripEndDate || item.endDate || "",
      startDate: item.startDate || item.tripStartDate || "",
      endDate: item.endDate || item.tripEndDate || "",
    };
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDisplayDate(isoOrStr) {
    if (!isoOrStr) return "—";
    try {
      const d = new Date(isoOrStr);
      if (isNaN(d.getTime())) return String(isoOrStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return String(isoOrStr);
    }
  }

  function formatSgd(amount) {
    const n = Number(amount);
    if (!isFinite(n)) return "—";
    return (
      "$" +
      n.toLocaleString("en-SG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function getActiveArchive() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.archiveId) return parsed;
    } catch (e) {}
    return null;
  }

  function setActiveArchive(meta) {
    if (!meta || !meta.archiveId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }

  function isReadOnly() {
    return Boolean(getActiveArchive());
  }

  function isActionAllowedInArchive(action) {
    return READ_ONLY_API_ACTIONS.has(String(action || ""));
  }

  function getCurrentPageFile() {
    const p = window.location.pathname.split("/").pop();
    return p || "index.html";
  }

  function resetAllModuleCaches() {
    try {
      window.adminRosterData = [];
      if (typeof adminRosterData !== "undefined") adminRosterData = [];
    } catch (e) {}
    try {
      window.cachedParticipants = [];
    } catch (e) {}
    try {
      window.globalLogistics = null;
      if (typeof globalLogistics !== "undefined") globalLogistics = null;
    } catch (e) {}
    try {
      if (typeof medicalRosterData !== "undefined") medicalRosterData = [];
    } catch (e) {}
    try {
      if (typeof dietRosterData !== "undefined") dietRosterData = [];
    } catch (e) {}
    try {
      if (typeof expiredRosterData !== "undefined") expiredRosterData = [];
    } catch (e) {}
    try {
      if (typeof otherRosterData !== "undefined") otherRosterData = [];
    } catch (e) {}
    try {
      window.financeConfig = {};
      window.financeOptions = [];
      window.globalReceipts = [];
      if (typeof financeConfig !== "undefined") financeConfig = {};
      if (typeof financeOptions !== "undefined") financeOptions = [];
      if (typeof globalReceipts !== "undefined") globalReceipts = [];
    } catch (e) {}
    try {
      if (typeof minutesMap !== "undefined" && minutesMap && typeof minutesMap.clear === "function") {
        minutesMap.clear();
      }
    } catch (e) {}
    try {
      if (typeof attendanceState !== "undefined") attendanceState = {};
      if (typeof savedAttJuncture !== "undefined") savedAttJuncture = "";
      if (typeof savedAttAssignment !== "undefined") savedAttAssignment = "ALL";
      if (typeof currentBusJuncture !== "undefined") currentBusJuncture = "";
      if (typeof busAttendanceState !== "undefined") busAttendanceState = {};
    } catch (e) {}
    try {
      if (typeof currentDrivePath !== "undefined") currentDrivePath = [];
      if (typeof lastLoadedDriveFiles !== "undefined") lastLoadedDriveFiles = [];
      if (typeof selectedDriveItems !== "undefined" && selectedDriveItems && selectedDriveItems.clear) {
        selectedDriveItems.clear();
      }
      if (typeof driveClipboard !== "undefined") driveClipboard = null;
    } catch (e) {}
    try {
      if (typeof loadedFamily !== "undefined") loadedFamily = [];
      if (typeof loadedProfile !== "undefined") loadedProfile = null;
    } catch (e) {}
    try {
      if (typeof stopAttendancePolling === "function") stopAttendancePolling();
    } catch (e) {}
    try {
      if (typeof stopFinancePolling === "function") stopFinancePolling();
    } catch (e) {}
    try {
      if (typeof stopMinutesPolling === "function") stopMinutesPolling();
    } catch (e) {}
  }

  async function fetchArchivedTripsList(force = false) {
    if (!force && Array.isArray(cachedArchivedTrips)) {
      return cachedArchivedTrips;
    }
    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "listArchivedTrips",
        payload: { force },
        clientId: window.CLIENT_ID || "",
        API_URL: typeof API_URL !== "undefined" ? API_URL : "",
      }),
    });
    const data = await res.json();
    if (data && data.status === "success" && Array.isArray(data.archives)) {
      cachedArchivedTrips = data.archives.map(normalizeArchiveMeta);
      return cachedArchivedTrips;
    }
    cachedArchivedTrips = [];
    return [];
  }

  async function bootstrapFromUrl() {
    const page = getCurrentPageFile();
    const params = new URLSearchParams(window.location.search);
    const urlArchiveId = params.get("archive");

    // Landing / Register never stay in archive mode
    if (page === "index.html" || page === "register.html") {
      if (getActiveArchive()) {
        setActiveArchive(null);
      }
      return null;
    }

    if ((page === "settings.html" || page === "dashboard.html") && !urlArchiveId) {
      if (getActiveArchive()) {
        setActiveArchive(null);
        resetAllModuleCaches();
        syncUI();
      }
      return null;
    }

    if (urlArchiveId) {
      const current = getActiveArchive();
      if (!current || current.archiveId !== urlArchiveId) {
        try {
          const list = await fetchArchivedTripsList();
          const found = list.find((a) => a.archiveId === urlArchiveId);
          if (found) {
            setActiveArchive(found);
          } else {
            // Fallback minimal meta so server lookup can still resolve
            setActiveArchive({
              archiveId: urlArchiveId,
              tripTitle: "Archived Trip",
              tripYear: "",
            });
          }
        } catch (e) {
          setActiveArchive({
            archiveId: urlArchiveId,
            tripTitle: "Archived Trip",
            tripYear: "",
          });
        }
      }
      return getActiveArchive();
    }

    return getActiveArchive();
  }

  async function enterArchive(archiveOrId, targetPage = "roster.html") {
    let meta = null;
    if (typeof archiveOrId === "string") {
      const list = await fetchArchivedTripsList();
      meta = list.find((a) => a.archiveId === archiveOrId);
      if (!meta) {
        if (typeof showToast === "function") {
          showToast("Archived trip not found.", true);
        }
        return;
      }
    } else if (archiveOrId && (archiveOrId.archiveId || archiveOrId.id)) {
      meta = normalizeArchiveMeta(archiveOrId);
    } else {
      return;
    }

    resetAllModuleCaches();
    setActiveArchive(meta);

    // Hydrate archived settings into memory ONLY (never overwrite live localStorage)
    try {
      const cfg = await apiCall("getSettings", {});
      if (cfg && cfg.status !== "error") {
        appSettings = cfg;
      }
    } catch (e) {
      console.warn("Archived settings hydration warning:", e);
    }

    const cleanTarget = targetPage.split("?")[0] || "roster.html";
    const destUrl = `${cleanTarget}?archive=${encodeURIComponent(meta.archiveId)}`;

    if (typeof window.navigateTo === "function") {
      // Force reload even if staying on same page when switching archives
      if (window.location.pathname.endsWith(cleanTarget)) {
        history.replaceState(null, "", destUrl);
        if (typeof loadPage === "function") {
          await loadPage(destUrl);
        } else {
          window.location.assign(destUrl);
        }
      } else {
        await window.navigateTo(destUrl);
      }
    } else {
      window.location.assign(destUrl);
    }
  }

  async function switchArchive(archiveId) {
    if (!archiveId) return;
    const current = getActiveArchive();
    if (current && current.archiveId === archiveId) return;
    const currentPage = getCurrentPageFile();
    const safePage =
      currentPage === "settings.html" ||
      currentPage === "dashboard.html" ||
      currentPage === "index.html"
        ? "roster.html"
        : currentPage;
    await enterArchive(archiveId, safePage);
  }

  async function exitArchive(targetPage = "settings.html", scrollToArchives = false) {
    setActiveArchive(null);
    resetAllModuleCaches();

    if (scrollToArchives) {
      window._scrollToArchivedTrips = true;
    }

    // Restore live appSettings from localStorage first, then refresh in background
    try {
      const cachedLive = localStorage.getItem("appSettings");
      if (cachedLive) {
        appSettings = JSON.parse(cachedLive);
      }
    } catch (e) {}

    syncUI();

    const cleanTarget = (targetPage || "settings.html").split("?")[0];
    if (typeof window.navigateTo === "function") {
      if (window.location.pathname.endsWith(cleanTarget)) {
        history.replaceState(null, "", cleanTarget);
        if (typeof loadPage === "function") {
          await loadPage(cleanTarget);
        }
      } else {
        await window.navigateTo(cleanTarget);
      }
    } else {
      window.location.assign(cleanTarget);
    }

    // Revalidate live settings quietly
    if (typeof window.refreshSettingsRealtime === "function") {
      window.refreshSettingsRealtime();
    }
  }

  function renderArchiveBanner() {
    const existing = document.getElementById("archiveReadOnlyBanner");
    const active = getActiveArchive();

    if (!active) {
      if (existing) existing.remove();
      return;
    }

    const header = document.querySelector("#authLayout header");
    if (!header || !header.parentElement) return;

    const titleText =
      [active.tripTitle || appSettings.tripTitle || "Archived Trip", active.tripYear || appSettings.tripYear || ""]
        .filter(Boolean)
        .join(" ")
        .trim();
    const archivedDate = active.archivedAt
      ? `Archived ${formatDisplayDate(active.archivedAt)}`
      : "Read-only archive";

    const switcherHtml =
      Array.isArray(cachedArchivedTrips) && cachedArchivedTrips.length > 1
        ? `<select
            id="archiveQuickSwitcher"
            aria-label="Switch archived trip"
            onchange="ArchiveMode.switchArchive(this.value)"
            data-archive-allow="true"
            class="text-xs font-semibold bg-amber-100/90 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-[180px] truncate cursor-pointer"
          >
            ${cachedArchivedTrips
              .map((a) => {
                const lbl = [a.tripTitle || "Trip", a.tripYear || ""].filter(Boolean).join(" ");
                return `<option value="${escapeHtml(a.archiveId)}" ${a.archiveId === active.archiveId ? "selected" : ""}>${escapeHtml(lbl)}</option>`;
              })
              .join("")}
          </select>`
        : "";

    const bannerHtml = `
      <div
        id="archiveReadOnlyBanner"
        class="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-800/80 px-3 md:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-600 text-white shrink-0">
            <i class="fa-solid fa-box-archive text-[10px]"></i>
            Read-Only Archive
          </span>
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-bold text-xs md:text-sm text-amber-950 dark:text-amber-100 truncate">${escapeHtml(titleText)}</span>
            <span class="hidden sm:inline text-xs text-amber-800/80 dark:text-amber-300/80 truncate">&middot; ${escapeHtml(archivedDate)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${switcherHtml}
          <button
            type="button"
            data-archive-allow="true"
            onclick="ArchiveMode.exitArchive('settings.html', true)"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-900 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer"
          >
            <i class="fa-solid fa-arrow-left text-[10px]"></i>
            <span>All Archives</span>
          </button>
          <button
            type="button"
            data-archive-allow="true"
            onclick="ArchiveMode.exitArchive('roster.html')"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 transition cursor-pointer"
          >
            <span>Exit Archive</span>
          </button>
        </div>
      </div>
    `;

    if (existing) {
      existing.outerHTML = bannerHtml;
    } else {
      header.insertAdjacentHTML("afterend", bannerHtml);
    }

    // Lazily populate quick switcher if list not yet loaded
    if (!cachedArchivedTrips) {
      fetchArchivedTripsList()
        .then((list) => {
          if (list && list.length > 1 && getActiveArchive()) {
            renderArchiveBanner();
          }
        })
        .catch(() => {});
    }
  }

  function isFilterOrSearchElement(el) {
    if (!el) return false;
    if (el.dataset && el.dataset.archiveAllow === "true") return true;
    const id = (el.id || "").toLowerCase();
    const cls = String(el.className || "").toLowerCase();
    const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const onchange = (el.getAttribute("onchange") || "").toLowerCase();
    const oninput = (el.getAttribute("oninput") || "").toLowerCase();

    // Always allow search boxes, view switchers, juncture/bus/group/role/category filter selects
    if (
      id.includes("search") ||
      id.includes("filter") ||
      id.includes("sort") ||
      id.includes("view") ||
      id.includes("juncture") ||
      id.includes("switcher") ||
      id === "attassignmentselect" ||
      id === "attrolefilter" ||
      id === "attgroupfilter" ||
      id === "busfilterselect" ||
      id === "busoptionselect" ||
      id === "recfiltercategory" ||
      id === "recfilterstatus" ||
      id === "recfilteruploader" ||
      id === "feefilterstatus" ||
      id === "minsearch" ||
      id === "minutesfilter" ||
      id === "archivequickswitcher" ||
      placeholder.includes("search") ||
      placeholder.includes("filter") ||
      aria.includes("search") ||
      aria.includes("filter") ||
      onchange.includes("navigateto") ||
      onchange.includes("render") ||
      onchange.includes("filter") ||
      onchange.includes("switch") ||
      onchange.includes("loadattendance") ||
      onchange.includes("loadbusattendance") ||
      oninput.includes("filter") ||
      oninput.includes("render") ||
      oninput.includes("search") ||
      cls.includes("archive-allow")
    ) {
      return true;
    }
    return false;
  }

  function isMutationButton(btn) {
    if (!btn) return false;
    if (btn.dataset && btn.dataset.archiveAllow === "true") return false;
    const onclick = (btn.getAttribute("onclick") || "").toLowerCase();
    const id = (btn.id || "").toLowerCase();

    if (
      btn.classList.contains("archive-hide") ||
      btn.classList.contains("remove-x") ||
      id === "btndriveadd" ||
      id === "btndrivepaste" ||
      id === "btn-sync-attendance" ||
      id === "btn-sync-bus" ||
      id === "btn-sync-finance" ||
      id === "btn-sync-pairings" ||
      id === "btn-sync-rooms" ||
      id === "btn-sync-groups" ||
      id === "btn-sync-buses"
    ) {
      return true;
    }

    const mutationKeywords = [
      "addfinance",
      "duplicatefinance",
      "removefinance",
      "deletefinance",
      "selectfinalfinance",
      "setfinaloption",
      "togglefinreceiptupload",
      "togglereceiptreimbursed",
      "opendeletereceiptmodal",
      "openeditreceiptmodal",
      "deletereceipt",
      "togglefeereceived",
      "addminutenote",
      "deleteminutenote",
      "promptnewjuncture",
      "promptdeletejuncture",
      "promptnewbusjuncture",
      "promptdeletebusjuncture",
      "addbusoption",
      "renamebusoption",
      "removebusoption",
      "autoassign",
      "resetroom",
      "deleteallrooms",
      "deleteroom",
      "autogroup",
      "resetgroup",
      "autobus",
      "resetbus",
      "openmanagerooms",
      "openmanagegroups",
      "openmanagebuses",
      "unpairtrainee",
      "autoassignpairings",
      "clearpairings",
      "toggledriveaddmenu",
      "promptcreatefolder",
      "promptcreategoogledoc",
      "triggerfileupload",
      "promptrenamedriveitem",
      "promptdeletedriveitem",
      "bulkdeleteselected",
      "pastefromdriveclipboard",
      "opentripfilepickermodal",
      "actioncleartripfile",
      "deleteparticipant",
      "submitadminprofileedit",
      "syncpairingsnow",
      "syncroomsnow",
      "syncgroupsnow",
      "syncbusesnow",
      "syncattendancenow",
      "syncbusattendancenow",
      "syncfinancenow",
      "openaddreceiptmodal",
      "openuploadreceiptmodal",
      "uploadreceipt",
      "addexchangerate",
      "removeexchangerate",
      "saveexchangerates",
    ];

    return mutationKeywords.some((kw) => onclick.includes(kw));
  }

  function applyReadOnlyToContainer(root) {
    if (!isReadOnly() || !root) return;

    // 1. Disable mutation inputs/textareas/selects inside content areas
    const inputs = root.querySelectorAll("input, textarea, select");
    inputs.forEach((el) => {
      if (isFilterOrSearchElement(el)) return;
      if (el.closest("#archiveReadOnlyBanner")) return;
      if (el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT") {
        if (!el.disabled) {
          el.disabled = true;
          el.dataset.archiveLocked = "true";
        }
      } else {
        if (!el.readOnly) {
          el.readOnly = true;
          el.dataset.archiveLocked = "true";
        }
        el.classList.add("cursor-default");
      }
    });

    // 2. Hide mutation buttons dynamically rendered by Finance / Logistics / Attendance / Minutes / Files
    const buttons = root.querySelectorAll("button");
    buttons.forEach((btn) => {
      if (btn.closest("#archiveReadOnlyBanner")) return;
      if (isMutationButton(btn)) {
        btn.classList.add("hidden-force");
      }
    });

    // 3. Disable draggable attributes in archive mode
    const draggables = root.querySelectorAll("[draggable='true']");
    draggables.forEach((el) => {
      el.setAttribute("draggable", "false");
    });
  }

  function startObserver() {
    if (mutationObserver) return;
    mutationObserver = new MutationObserver(() => {
      if (!isReadOnly()) return;
      if (enforceTimer) clearTimeout(enforceTimer);
      enforceTimer = setTimeout(() => {
        const container = document.getElementById("tabContainer");
        if (container) applyReadOnlyToContainer(container);
        document
          .querySelectorAll("#exchangeRatesModal, #globalParticipantModal, #busTrackerModal, #financeModal")
          .forEach((m) => applyReadOnlyToContainer(m));
      }, 40);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function syncUI() {
    const active = getActiveArchive();
    const ro = Boolean(active);

    document.body.classList.toggle("archive-readonly-mode", ro);
    renderArchiveBanner();

    // Update sidebar/header trip name
    if (ro) {
      const tripStr = [
        active.tripTitle || appSettings.tripTitle || "Archived Trip",
        active.tripYear || appSettings.tripYear || "",
      ]
        .filter(Boolean)
        .join(" ");
      ["deskTripName", "mobTripName"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = `${tripStr} (Archived)`;
          el.classList.remove("hidden-force");
        }
      });

      // Keep Settings accessible so admins can easily return to All Archives
      const navSettings = document.getElementById("nav-settings");
      if (navSettings && currentUser && currentUser.role === "admin") {
        navSettings.classList.remove("hidden-force");
      }

      startObserver();
      const container = document.getElementById("tabContainer");
      if (container) applyReadOnlyToContainer(container);
    } else {
      const navSettings = document.getElementById("nav-settings");
      if (navSettings && currentUser && currentUser.role === "admin") {
        navSettings.classList.remove("hidden-force");
      }
    }
  }

  // ==========================================
  // ARCHIVED TRIPS SECTION (Settings -> below Danger Zone)
  // ==========================================
  async function renderArchivedTripsSection(
    targetId = "archivedTripsSettingsSection",
    forceRefresh = false,
  ) {
    archiveTargetContainerId = targetId || "archivedTripsSettingsSection";
    const bodyEl = document.getElementById(archiveTargetContainerId);
    if (!bodyEl) return;

    bodyEl.innerHTML = `
      <section class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 class="text-sm font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <i class="fa-solid fa-box-archive text-amber-600 dark:text-amber-400 text-xs"></i>
              <span>Archived Trips</span>
              <span id="archiveCountBadge" class="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">...</span>
            </h3>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
              View any closed trip in read-only mode across Roster, Logistics, Attendance, Finance, Minutes, Files, and subpages.
            </p>
          </div>
          <button
            type="button"
            onclick="ArchiveMode.refreshArchives()"
            class="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            <i class="fa-solid fa-rotate text-[11px]"></i>
            <span>Refresh</span>
          </button>
        </div>

        <div id="archiveFilterBar" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div class="sm:col-span-6 relative">
            <i class="fa-solid fa-magnifying-glass text-xs text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            <input
              id="archiveSearchInput"
              type="text"
              value="${escapeHtml(archiveSearchQuery)}"
              oninput="ArchiveMode.onFilterChange()"
              placeholder="Search archived trips by title, year, or archiver..."
              class="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div class="sm:col-span-3">
            <select
              id="archiveYearFilter"
              onchange="ArchiveMode.onFilterChange()"
              class="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Years</option>
            </select>
          </div>
          <div class="sm:col-span-3">
            <select
              id="archiveSortSelect"
              onchange="ArchiveMode.onFilterChange()"
              class="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="archived_desc" ${archiveSortBy === "archived_desc" ? "selected" : ""}>Recently Archived</option>
              <option value="year_desc" ${archiveSortBy === "year_desc" ? "selected" : ""}>Trip Year (Newest)</option>
              <option value="year_asc" ${archiveSortBy === "year_asc" ? "selected" : ""}>Trip Year (Oldest)</option>
              <option value="title_asc" ${archiveSortBy === "title_asc" ? "selected" : ""}>Trip Name (A–Z)</option>
            </select>
          </div>
        </div>

        <div id="archiveCardsGrid" class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div class="lg:col-span-2 flex items-center justify-center py-10">
            <div class="loader !w-7 !h-7"></div>
          </div>
        </div>
      </section>
    `;

    try {
      const archives = await fetchArchivedTripsList(forceRefresh);
      populateYearFilter(archives);
      renderArchiveCards(archives);
    } catch (err) {
      const grid = document.getElementById("archiveCardsGrid");
      if (grid) {
        grid.innerHTML = `
          <div class="lg:col-span-2 p-6 text-center rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20">
            <p class="text-sm font-bold text-red-700 dark:text-red-400">Could not load archived trips</p>
            <p class="text-xs text-red-600/80 dark:text-red-300/80 mt-1">${escapeHtml(err.message || "Please try refreshing.")}</p>
          </div>
        `;
      }
    }
  }

  function populateYearFilter(archives) {
    const sel = document.getElementById("archiveYearFilter");
    if (!sel) return;
    const years = Array.from(
      new Set(
        (archives || [])
          .map((a) => String(a.tripYear || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => b.localeCompare(a));

    sel.innerHTML =
      `<option value="ALL">All Years</option>` +
      years
        .map(
          (y) =>
            `<option value="${escapeHtml(y)}" ${archiveYearFilter === y ? "selected" : ""}>${escapeHtml(y)}</option>`
        )
        .join("");
  }

  function renderArchiveCards(archives) {
    const grid = document.getElementById("archiveCardsGrid");
    const countBadge = document.getElementById("archiveCountBadge");
    if (!grid) return;

    const list = Array.isArray(archives) ? [...archives] : [];
    const q = archiveSearchQuery.trim().toLowerCase();

    let filtered = list.filter((a) => {
      if (archiveYearFilter !== "ALL" && String(a.tripYear || "") !== archiveYearFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        a.tripTitle,
        a.tripYear,
        a.archivedBy,
        a.archiveId,
        formatDisplayDate(a.archivedAt),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    filtered.sort((a, b) => {
      if (archiveSortBy === "year_desc") {
        return String(b.tripYear || "").localeCompare(String(a.tripYear || ""));
      }
      if (archiveSortBy === "year_asc") {
        return String(a.tripYear || "").localeCompare(String(b.tripYear || ""));
      }
      if (archiveSortBy === "title_asc") {
        return String(a.tripTitle || "").localeCompare(String(b.tripTitle || ""));
      }
      return String(b.archivedAt || "").localeCompare(String(a.archivedAt || ""));
    });

    if (countBadge) {
      countBadge.textContent = String(filtered.length);
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="lg:col-span-2 py-8 px-5 text-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-950/40">
          <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2.5">
            <i class="fa-solid fa-box-archive text-base"></i>
          </div>
          <h4 class="text-sm font-black text-gray-900 dark:text-white">No archived trips yet</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1 leading-relaxed">
            When you close a trip using <span class="font-semibold text-gray-700 dark:text-gray-300">Archive &amp; Reset</span> in the Danger Zone above, a complete read-only snapshot of Roster, Logistics, Attendance, Finance, Minutes, and Files will appear here.
          </p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="lg:col-span-2 py-10 px-6 text-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
          <p class="text-sm font-bold text-gray-700 dark:text-gray-300">No archived trips match your filters.</p>
          <button
            type="button"
            onclick="ArchiveMode.clearFilters()"
            class="mt-2.5 text-xs font-bold text-primary dark:text-green-400 hover:underline cursor-pointer"
          >
            Clear search &amp; filters
          </button>
        </div>
      `;
      return;
    }

    const quickPages = [
      { label: "Roster", page: "roster.html", icon: "fa-users" },
      { label: "Logistics", page: "logistics.html", icon: "fa-bed" },
      { label: "Attendance", page: "attendance.html", icon: "fa-clipboard-check" },
      { label: "Finance", page: "finance.html", icon: "fa-coins" },
      { label: "Minutes", page: "minutes.html", icon: "fa-file-lines" },
      { label: "Files", page: "files.html", icon: "fa-folder-open" },
    ];

    grid.innerHTML = filtered
      .map((a) => {
        const title = a.tripTitle || "Untitled Trip";
        const year = a.tripYear || "";
        const dateRange =
          a.startDate && a.endDate
            ? `${formatDisplayDate(a.startDate)} – ${formatDisplayDate(a.endDate)}`
            : a.startDate
              ? formatDisplayDate(a.startDate)
              : "";
        const archivedLine = [
          a.archivedAt ? `Archived ${formatDisplayDate(a.archivedAt)}` : "Archived",
          a.archivedBy ? `by ${a.archivedBy}` : "",
        ]
          .filter(Boolean)
          .join(" ");

        const s = a.stats || null;
        const statsStripHtml = s
          ? `
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-gray-50 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 rounded-lg p-2.5">
              <div class="min-w-0">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">People</div>
                <div class="text-sm font-black tabular-nums text-gray-900 dark:text-white">${Number(s.participants || 0)}</div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rooms</div>
                <div class="text-sm font-black tabular-nums text-gray-900 dark:text-white">${Number(s.rooms || 0)}</div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Checkpoints</div>
                <div class="text-sm font-black tabular-nums text-gray-900 dark:text-white">${Number(s.junctures || 0) + Number(s.busJunctures || 0)}</div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Spend</div>
                <div class="text-sm font-black tabular-nums text-gray-900 dark:text-white truncate" title="${escapeHtml(formatSgd(s.totalSpendSgd))}">${escapeHtml(formatSgd(s.totalSpendSgd))}</div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Minutes</div>
                <div class="text-sm font-black tabular-nums text-gray-900 dark:text-white">${Number(s.minutes || 0)}</div>
              </div>
              <div class="min-w-0">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Files</div>
                <div class="text-sm font-black tabular-nums text-gray-900 dark:text-white">${Number(s.files || 0)}</div>
              </div>
            </div>
          `
          : `
            <div class="bg-gray-50 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <i class="fa-solid fa-cloud text-gray-400"></i>
              <span>Stored in Google Drive archive &middot; Open any section below to load read-only records.</span>
            </div>
          `;

        const idEsc = escapeHtml(a.archiveId).replace(/'/g, "\\'");

        return `
          <article class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-amber-400 dark:hover:border-amber-600 rounded-xl p-4 flex flex-col justify-between gap-3.5 transition-colors">
            <div class="space-y-2.5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-base font-black text-gray-900 dark:text-white tracking-tight truncate">
                      ${escapeHtml(title)}${year ? ` <span class="tabular-nums text-gray-500 dark:text-gray-400 font-bold">${escapeHtml(year)}</span>` : ""}
                    </h3>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    ${dateRange ? `<span><i class="fa-regular fa-calendar mr-1"></i>${escapeHtml(dateRange)}</span>` : ""}
                    <span>${escapeHtml(archivedLine)}</span>
                  </div>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 shrink-0">
                  Read-Only
                </span>
              </div>

              ${statsStripHtml}
            </div>

            <div class="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Jump to page</span>
                <button
                  type="button"
                  onclick="ArchiveMode.enterArchive('${idEsc}', 'roster.html')"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-green-700 transition cursor-pointer"
                >
                  <span>View Archive</span>
                  <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
              </div>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                ${quickPages
                  .map(
                    (qp) => `
                  <button
                    type="button"
                    onclick="ArchiveMode.enterArchive('${idEsc}', '${qp.page}')"
                    class="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950/50 dark:hover:text-amber-200 border border-gray-200/80 dark:border-gray-700/80 transition cursor-pointer"
                    title="Open ${qp.label} (Read-Only)"
                  >
                    <i class="fa-solid ${qp.icon} text-[10px] opacity-75"></i>
                    <span class="truncate">${qp.label}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function onFilterChange() {
    const s = document.getElementById("archiveSearchInput");
    const y = document.getElementById("archiveYearFilter");
    const sort = document.getElementById("archiveSortSelect");
    if (s) archiveSearchQuery = s.value;
    if (y) archiveYearFilter = y.value;
    if (sort) archiveSortBy = sort.value;
    renderArchiveCards(cachedArchivedTrips || []);
  }

  function clearFilters() {
    archiveSearchQuery = "";
    archiveYearFilter = "ALL";
    archiveSortBy = "archived_desc";
    const s = document.getElementById("archiveSearchInput");
    const y = document.getElementById("archiveYearFilter");
    const sort = document.getElementById("archiveSortSelect");
    if (s) s.value = "";
    if (y) y.value = "ALL";
    if (sort) sort.value = "archived_desc";
    renderArchiveCards(cachedArchivedTrips || []);
  }

  async function refreshArchives() {
    cachedArchivedTrips = null;
    await renderArchivedTripsSection(archiveTargetContainerId, true);
  }

  window.ArchiveMode = {
    getActiveArchive,
    isReadOnly,
    isActionAllowedInArchive,
    bootstrapFromUrl,
    enterArchive,
    switchArchive,
    exitArchive,
    resetAllModuleCaches,
    fetchArchivedTripsList,
    syncUI,
    renderArchiveBanner,
    applyReadOnlyToContainer,
    renderArchivedTripsSection,
    onFilterChange,
    clearFilters,
    refreshArchives,
    escapeHtml,
    formatDisplayDate,
  };

  window.isArchiveReadOnly = isReadOnly;
})();
