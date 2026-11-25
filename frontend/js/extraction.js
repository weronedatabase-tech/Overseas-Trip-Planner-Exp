let extractExcludedNrics = new Set();
let currentExtractType = "";
let extractGlobalRoster = [];

async function showExtractionPopup(type) {
  currentExtractType = type;
  extractExcludedNrics.clear();

  if (typeof showOverlay === "function") showOverlay("Loading participants...");

  if (!extractGlobalRoster || extractGlobalRoster.length === 0) {
    try {
      const [rostRes, logRes] = await Promise.all([
        apiCall("fetchAdminRoster", {}),
        typeof globalLogistics !== "undefined" && globalLogistics
          ? Promise.resolve(globalLogistics)
          : apiCall("fetchLogistics").catch((e) => null),
      ]);

      if (rostRes && rostRes.status === "success") {
        let tempRoster = rostRes.roster || [];
        if (typeof applyCaregiverLabels === "function")
          applyCaregiverLabels(tempRoster);

        const logisticsData = logRes || { rooms: [], pairings: [] };

        const pairingsMap = {};
        if (logisticsData.pairings) {
          logisticsData.pairings
            .filter((p) => p.status === "ACTIVE")
            .forEach((pair) => {
              if (!pairingsMap[pair.traineeNric])
                pairingsMap[pair.traineeNric] = [];
              if (!pairingsMap[pair.volNric]) pairingsMap[pair.volNric] = [];

              const v = tempRoster.find((x) => x.nric === pair.volNric);
              const t = tempRoster.find((x) => x.nric === pair.traineeNric);

              if (v)
                pairingsMap[pair.traineeNric].push(
                  (v.shortName || v.fullName || "").toUpperCase(),
                );
              if (t)
                pairingsMap[pair.volNric].push(
                  (t.shortName || t.fullName || "").toUpperCase(),
                );
            });
        }

        const roomsMap = {};
        if (logisticsData.rooms) {
          logisticsData.rooms
            .filter((r) => !r.isDeleted)
            .forEach((r) => {
              r.occupants.forEach((n) => (roomsMap[n] = r.name.toUpperCase()));
            });
        }

        tempRoster.forEach((p) => {
          p.room = roomsMap[p.nric] || "UNASSIGNED";
          let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
          if (p.role === "CAREGIVER" && p.relatedTrainee) {
            const rNames = p.relatedTrainee
              .split("|")
              .map((n) => n.trim().toLowerCase());
            const relatedList = tempRoster.filter(
              (x) =>
                rNames.includes((x.fullName || "").toLowerCase()) &&
                x.role === "TRAINEE",
            );
            relatedList.forEach((related) => {
              if (related && pairingsMap[related.nric]) {
                myPairings.push(...pairingsMap[related.nric]);
              }
            });
          }
          p.pairings =
            myPairings.length > 0
              ? Array.from(new Set(myPairings)).join(", ")
              : "NONE";
        });

        extractGlobalRoster = tempRoster;
      }
    } catch (e) {
      console.error("Error fetching roster for extraction", e);
    }
  }

  if (typeof hideOverlay === "function") hideOverlay();

  let modal = document.getElementById("extractionModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "extractionModal";
    modal.className =
      "fixed inset-0 bg-black/60 z-[120] flex justify-center items-center p-4 backdrop-blur-sm hidden-force";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border-2 border-gray-200 dark:border-gray-800 flex flex-col h-[80vh] md:h-auto max-h-[90vh] overflow-hidden my-auto animate-slide-up relative">
            <button type="button" onclick="document.getElementById('extractionModal').classList.add('hidden-force')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div class="p-5 md:p-6 border-b-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
                <h2 id="extractionTitle" class="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight">Data Extraction</h2>
                <p class="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Select participants to exclude &middot; MS Excel (.xlsx)</p>
            </div>
            <div class="p-5 md:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                <div class="relative">
                    <input type="text" id="extractSearchInput" oninput="handleExtractSearch()" placeholder="Search participants to exclude..." class="w-full py-2.5 pl-9 pr-3 border-2 border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-md transition">
                    <svg class="w-4 h-4 absolute left-3 top-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                
                <div id="extractSearchResults" class="flex flex-col gap-2 empty:hidden"></div>
                
                <div class="pt-2">
                    <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 border-b-2 border-gray-100 dark:border-gray-800 pb-1">Excluded Participants</h3>
                    <div id="extractExcludedList" class="flex flex-wrap gap-2 min-h-[50px] p-2 bg-gray-50 dark:bg-gray-950/50 rounded-lg border-2 border-gray-100 dark:border-gray-800"></div>
                </div>
            </div>
            <div class="p-4 md:p-5 border-t-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0 flex justify-end gap-3">
                <button type="button" onclick="document.getElementById('extractionModal').classList.add('hidden-force')" class="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition">Cancel</button>
                <button type="button" onclick="performExtraction()" class="px-5 py-2.5 rounded-xl font-black text-sm text-white shadow-md transition flex items-center gap-2 bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Extract Excel (.xlsx)
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden-force");
    });
  }

  document.getElementById("extractionTitle").textContent =
    type === "insurance" ? "Insurance Extraction" : "Bus for ICA Extraction";
  document.getElementById("extractSearchInput").value = "";
  renderExtractSearchResults();
  renderExtractExcluded();
  modal.classList.remove("hidden-force");
  setTimeout(() => document.getElementById("extractSearchInput").focus(), 100);
}

function handleExtractSearch() {
  renderExtractSearchResults();
}

function renderExtractSearchResults() {
  const searchInput = document.getElementById("extractSearchInput");
  const cont = document.getElementById("extractSearchResults");
  if (!cont) return;

  const query = (searchInput ? searchInput.value || "" : "")
    .toLowerCase()
    .trim();

  if (!query) {
    cont.innerHTML = "";
    return;
  }

  if (!extractGlobalRoster) return;

  // Fuzzy search identical to roster
  let matches = extractGlobalRoster.filter((p) => {
    if (extractExcludedNrics.has(p.nric)) return false;

    return Object.values(p).some(
      (val) => val && val.toString().toLowerCase().includes(query),
    );
  });

  if (window.sortBySearchRelevance) {
    window.sortBySearchRelevance(matches, query, (p) => ({
      primary: [p.shortName, p.fullName, p.nric],
      secondary: [
        p.passportNo,
        p.role,
        p.group,
        p.logisticsGroup,
        p.bus,
        p.room,
        p.relatedTrainee,
        p.contact,
        p.email,
      ],
    }));
  } else {
    matches.sort((a, b) => {
      if (a.pocNric < b.pocNric) return -1;
      if (a.pocNric > b.pocNric) return 1;

      let roleA = a.role === "TRAINEE" ? 1 : a.role === "CAREGIVER" ? 2 : 3;
      let roleB = b.role === "TRAINEE" ? 1 : b.role === "CAREGIVER" ? 2 : 3;
      return roleA - roleB;
    });
  }

  matches = matches.slice(0, 15); // Limit to top 5 results for clarity

  if (matches.length === 0) {
    cont.innerHTML = `<div class="text-xs text-center text-gray-400 py-2">No matching participants found.</div>`;
    return;
  }

  cont.innerHTML = matches
    .map((p) => {
      const roleColor =
        p.role === "TRAINEE"
          ? "text-green-600 dark:text-green-400"
          : p.role === "CAREGIVER"
            ? "text-purple-600 dark:text-purple-400"
            : "text-orange-600 dark:text-orange-400";
      const roleStr = String(p.role || "").substring(0, 3);
      const fullNameUpper = (p.fullName || "").toUpperCase();
      const shortNameUpper = (p.shortName || "").toUpperCase();

      let projColor =
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
      if (typeof getProjectColor === "function")
        projColor = getProjectColor(p.group);
      let projAbbr = (p.group || "None").toUpperCase();
      if (typeof getProjectAbbreviation === "function")
        projAbbr = getProjectAbbreviation(p.group || "None");

      return `
        <div onclick="addExtractExcluded('${p.nric}')" class="flex items-center justify-between p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition shadow-md">
            <div class="flex flex-col min-w-0 pr-2">
                <div class="font-bold text-xs md:text-sm text-gray-900 dark:text-gray-100 leading-tight whitespace-normal break-words">${fullNameUpper}</div>
                ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words">${shortNameUpper}</div>` : ""}
                <div class="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-900/50 px-1.5 py-[1.5px] leading-tight rounded border-2 border-gray-200 dark:border-gray-700 uppercase tracking-widest">${roleStr}</span>
                    <span class="px-1.5 py-[1.5px] leading-tight rounded border shadow-md text-[11px] font-bold ${projColor} whitespace-normal break-words inline-block" title="${(p.group || "None").toUpperCase()}">${projAbbr}</span>
                </div>
                ${p.relatedTrainee && p.role === "CAREGIVER" ? `<div class="mt-1.5 font-bold text-purple-600 dark:text-purple-400 text-xs tracking-tight">[${p.relatedTrainee.toUpperCase()}]</div>` : ""}
            </div>
            <button class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-red-500 transition focus:outline-none bg-gray-100 dark:bg-gray-900/50 border-2 border-gray-200 dark:border-gray-700">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
        </div>`;
    })
    .join("");
}

function renderExtractExcluded() {
  const cont = document.getElementById("extractExcludedList");
  if (!cont) return;

  if (extractExcludedNrics.size === 0) {
    cont.innerHTML = `<span class="text-xs text-gray-400 font-medium italic p-2">None selected.</span>`;
    return;
  }

  let html = "";
  extractExcludedNrics.forEach((nric) => {
    const p = extractGlobalRoster.find((x) => x.nric === nric);
    if (!p) return;

    const roleColor =
      p.role === "TRAINEE"
        ? "text-green-600 dark:text-green-400"
        : p.role === "CAREGIVER"
          ? "text-purple-600 dark:text-purple-400"
          : "text-orange-600 dark:text-orange-400";
    const roleStr = String(p.role || "").substring(0, 3);
    const fullNameUpper = (p.fullName || "").toUpperCase();
    const shortNameUpper = (p.shortName || "").toUpperCase();

    let projColor =
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
    if (typeof getProjectColor === "function")
      projColor = getProjectColor(p.group);
    let projAbbr = (p.group || "None").toUpperCase();
    if (typeof getProjectAbbreviation === "function")
      projAbbr = getProjectAbbreviation(p.group || "None");

    html += `
        <div onclick="removeExtractExcluded('${p.nric}')" class="flex items-center justify-between p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer transition shadow-md w-full">
            <div class="flex flex-col min-w-0 pr-2">
                <div class="font-bold text-xs md:text-sm text-gray-900 dark:text-gray-100 leading-tight whitespace-normal break-words line-through opacity-70">${fullNameUpper}</div>
                ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words line-through opacity-70">${shortNameUpper}</div>` : ""}
                <div class="flex items-center gap-1 mt-1.5 flex-wrap opacity-80">
                    <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-900/50 px-1.5 py-[1.5px] leading-tight rounded border-2 border-gray-200 dark:border-gray-700 uppercase tracking-widest">${roleStr}</span>
                    <span class="px-1.5 py-[1.5px] leading-tight rounded border shadow-md text-[11px] font-bold ${projColor} whitespace-normal break-words inline-block" title="${(p.group || "None").toUpperCase()}">${projAbbr}</span>
                </div>
                ${p.relatedTrainee && p.role === "CAREGIVER" ? `<div class="mt-1.5 font-bold text-purple-600 dark:text-purple-400 text-xs tracking-tight opacity-70">[${p.relatedTrainee.toUpperCase()}]</div>` : ""}
            </div>
            <button class="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition focus:outline-none bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800/50">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>`;
  });
  cont.innerHTML = `<div class="flex flex-col gap-2 w-full">${html}</div>`;
}

function addExtractExcluded(nric) {
  extractExcludedNrics.add(nric);
  document.getElementById("extractSearchInput").value = "";
  renderExtractSearchResults();
  renderExtractExcluded();
}

function removeExtractExcluded(nric) {
  extractExcludedNrics.delete(nric);
  renderExtractSearchResults();
  renderExtractExcluded();
}

function getCurrentExtractFolderId() {
  if (
    typeof currentDrivePath !== "undefined" &&
    Array.isArray(currentDrivePath) &&
    currentDrivePath.length > 0
  ) {
    return currentDrivePath[currentDrivePath.length - 1].id || "root";
  }
  return "root";
}

function getOrCreateExtractOverlay() {
  let overlay = document.getElementById("extractOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "extractOverlay";
    overlay.className =
      "fixed inset-0 bg-white/80 dark:bg-black/80 z-[200] flex flex-col justify-center items-center backdrop-blur-sm hidden-force text-gray-800 dark:text-white";
    overlay.innerHTML =
      '<div class="loader !w-10 !h-10 border-primary mb-4"></div><div class="font-bold tracking-widest uppercase text-sm">Generating MS Excel (.xlsx)...</div>';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function handleExtractionSuccess(res) {
  showToast("MS Excel (.xlsx) extraction successful!");
  if (
    Array.isArray(res.folders) &&
    Array.isArray(res.files) &&
    typeof renderDriveContents === "function"
  ) {
    renderDriveContents(res.folders, res.files);
  } else if (typeof refreshCurrentDriveFolder === "function") {
    refreshCurrentDriveFolder(null);
  }
  showExtractionResultPopup(res);
}

function performExtraction() {
  if (!extractGlobalRoster) {
    showToast("Roster data not loaded yet.");
    return;
  }

  document.getElementById("extractionModal").classList.add("hidden-force");

  const overlay = getOrCreateExtractOverlay();
  overlay.classList.remove("hidden-force");

  const excluded = Array.from(extractExcludedNrics);
  const folderId = getCurrentExtractFolderId();

  apiCall("extractData", {
    extractType: currentExtractType,
    excludedNrics: excluded,
    folderId: folderId,
  })
    .then((res) => {
      overlay.classList.add("hidden-force");
      if (res.status === "success") {
        handleExtractionSuccess(res);
      } else {
        showToast("Extraction failed: " + res.message, "error");
      }
    })
    .catch((err) => {
      overlay.classList.add("hidden-force");
      showToast("Error extracting data: " + (err.message || "Unknown error"), "error");
    });
}
let customSelectedColumns = ["fullName", "nric"];
const customAvailableColumns = [
  { id: "fullName", label: "Full Name" },
  { id: "shortName", label: "Short Name" },
  { id: "nric", label: "NRIC / FIN" },
  { id: "email", label: "Email Address" },
  { id: "role", label: "Role" },
  { id: "gender", label: "Gender" },
  { id: "contact", label: "Contact Number" },
  { id: "address", label: "Home Address" },
  { id: "nationality", label: "Nationality" },
  { id: "passportNo", label: "Passport No." },
  { id: "passportExpiry", label: "Passport Expiry Date" },
  { id: "dob", label: "Date of Birth" },
  { id: "diet", label: "Dietary Restrictions" },
  { id: "emergencyName", label: "Emergency Contact Name" },
  { id: "emergencyContact", label: "Emergency Contact Number" },
  { id: "emergencyRelation", label: "Emergency Contact Relationship" },
  { id: "sleeping", label: "Sleeping Arrangement" },
  { id: "otherPoints", label: "Other Points to Note" },
  { id: "medical", label: "Medical Conditions" },
  { id: "bus", label: "Bus" },
  { id: "logisticsGroup", label: "Logistics Group" },
  { id: "group", label: "Project Group" },
  { id: "relatedTrainee", label: "Related Trainee(s)" },
  { id: "relationship", label: "Relationship to Trainee" },
  { id: "room", label: "Room Assignment" },
  { id: "pairings", label: "Pairings" },
];

async function showCustomExtractionPopup() {
  if (typeof showOverlay === "function") showOverlay("Loading participants...");

  if (!extractGlobalRoster || extractGlobalRoster.length === 0) {
    try {
      const [rostRes, logRes] = await Promise.all([
        apiCall("fetchAdminRoster", {}),
        typeof globalLogistics !== "undefined" && globalLogistics
          ? Promise.resolve(globalLogistics)
          : apiCall("fetchLogistics").catch((e) => null),
      ]);

      if (rostRes && rostRes.status === "success") {
        let tempRoster = rostRes.roster || [];
        if (typeof applyCaregiverLabels === "function")
          applyCaregiverLabels(tempRoster);

        const logisticsData = logRes || { rooms: [], pairings: [] };
        const pairingsMap = {};
        if (logisticsData.pairings) {
          logisticsData.pairings
            .filter((p) => p.status === "ACTIVE")
            .forEach((pair) => {
              if (!pairingsMap[pair.traineeNric])
                pairingsMap[pair.traineeNric] = [];
              if (!pairingsMap[pair.volNric]) pairingsMap[pair.volNric] = [];

              const v = tempRoster.find((x) => x.nric === pair.volNric);
              const t = tempRoster.find((x) => x.nric === pair.traineeNric);

              if (v)
                pairingsMap[pair.traineeNric].push(
                  (v.shortName || v.fullName || "").toUpperCase(),
                );
              if (t)
                pairingsMap[pair.volNric].push(
                  (t.shortName || t.fullName || "").toUpperCase(),
                );
            });
        }

        const roomsMap = {};
        if (logisticsData.rooms) {
          logisticsData.rooms
            .filter((r) => !r.isDeleted)
            .forEach((r) => {
              r.occupants.forEach((n) => (roomsMap[n] = r.name.toUpperCase()));
            });
        }

        tempRoster.forEach((p) => {
          p.room = roomsMap[p.nric] || "UNASSIGNED";
          let myPairings = pairingsMap[p.nric] ? [...pairingsMap[p.nric]] : [];
          if (p.role === "CAREGIVER" && p.relatedTrainee) {
            const rNames = p.relatedTrainee
              .split("|")
              .map((n) => n.trim().toLowerCase());
            const relatedList = tempRoster.filter(
              (x) =>
                rNames.includes((x.fullName || "").toLowerCase()) &&
                x.role === "TRAINEE",
            );
            relatedList.forEach((related) => {
              if (related && pairingsMap[related.nric]) {
                myPairings.push(...pairingsMap[related.nric]);
              }
            });
          }
          p.pairings =
            myPairings.length > 0
              ? Array.from(new Set(myPairings)).join(", ")
              : "NONE";
        });
        extractGlobalRoster = tempRoster;
      }
    } catch (e) {
      console.error("Error fetching roster for custom extraction", e);
    }
  }

  if (typeof hideOverlay === "function") hideOverlay();

  let modal = document.getElementById("customExtractionModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "customExtractionModal";
    modal.className =
      "fixed inset-0 bg-black/60 z-[120] flex justify-center items-center p-4 backdrop-blur-sm hidden-force";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl border-2 border-gray-200 dark:border-gray-800 flex flex-col h-[85vh] md:h-[90vh] overflow-hidden my-auto animate-slide-up relative">
            <button type="button" onclick="document.getElementById('customExtractionModal').classList.add('hidden-force')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div class="p-5 md:p-6 border-b-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
                <h2 class="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight">Custom Extraction</h2>
                <p class="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Configure your MS Excel (.xlsx) File</p>
            </div>
            <div class="p-5 md:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                <div>
                    <label class="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Excel File Name (.xlsx)</label>
                    <input type="text" id="customSheetName" placeholder="e.g. Flight Details" class="w-full py-2.5 px-3 border-2 border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition">
                </div>
                
                <div class="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
                    <div class="flex-1 flex flex-col min-h-0">
                        <label class="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Available Columns</label>
                        <div class="relative mb-2 shrink-0">
                            <input type="text" id="customAvailSearch" oninput="renderCustomColumns()" placeholder="Search..." class="w-full py-1.5 pl-8 pr-8 border-2 border-gray-300 dark:border-gray-700 rounded-md text-xs font-semibold bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary transition">
                            <svg class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <button onclick="document.getElementById('customAvailSearch').value=''; renderCustomColumns(); document.getElementById('customAvailSearch').focus()" class="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none" title="Clear search">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div id="customAvailList" class="flex-1 overflow-y-auto custom-scrollbar border-2 border-gray-200 dark:border-gray-800 rounded-lg p-2 bg-gray-50 dark:bg-gray-950/50 flex flex-col gap-1 min-h-[150px]"></div>
                    </div>
                    <div class="flex flex-col shrink-0 justify-center items-center md:px-2 hidden md:flex">
                        <svg class="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </div>
                    <div class="flex-1 flex flex-col min-h-0">
                        <label class="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">Selected Columns (Order)</label>
                        <div id="customSelectedList" class="flex-1 overflow-y-auto custom-scrollbar border-2 border-primary/30 rounded-lg p-2 bg-green-50/30 dark:bg-green-900/10 flex flex-col gap-1 min-h-[150px]"></div>
                    </div>
                </div>
            </div>
            <div class="p-4 md:p-5 border-t-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0 flex justify-end gap-3">
                <button type="button" onclick="document.getElementById('customExtractionModal').classList.add('hidden-force')" class="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition">Cancel</button>
                <button type="button" onclick="performCustomExtraction()" class="px-5 py-2.5 rounded-xl font-black text-sm text-white shadow-md transition flex items-center gap-2 bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Extract Excel (.xlsx)
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden-force");
    });
  }

  document.getElementById("customSheetName").value = "Custom Extraction";
  document.getElementById("customAvailSearch").value = "";

  // Reset selection defaults
  customSelectedColumns = ["fullName", "nric"];
  renderCustomColumns();

  modal.classList.remove("hidden-force");
}

function renderCustomColumns() {
  const searchInput = document.getElementById("customAvailSearch");
  const query = (searchInput ? searchInput.value || "" : "")
    .toLowerCase()
    .trim();
  const availList = document.getElementById("customAvailList");
  const selectedList = document.getElementById("customSelectedList");

  // Available
  if (availList) {
    let availHtml = "";
    let availCols = customAvailableColumns.filter((col) => {
      if (customSelectedColumns.includes(col.id)) return false;
      if (query && !col.label.toLowerCase().includes(query)) return false;
      return true;
    });
    if (query && window.sortBySearchRelevance) {
      window.sortBySearchRelevance(availCols, query, (col) => ({
        primary: [col.label, col.id],
      }));
    }
    availCols.forEach((col) => {
      availHtml += `
          <div class="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary transition group cursor-pointer shadow-sm" onclick="addCustomColumn('${col.id}')">
              <span class="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-primary transition-colors truncate pr-2">${col.label}</span>
              <button class="shrink-0 text-gray-400 group-hover:text-primary transition focus:outline-none">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
          </div>`;
    });
    if (!availHtml)
      availHtml = `<div class="text-[10px] text-center text-gray-400 py-4 font-bold uppercase tracking-widest">No matching columns</div>`;
    availList.innerHTML = availHtml;
  }

  // Selected
  if (selectedList) {
    let selHtml = "";
    customSelectedColumns.forEach((colId, index) => {
      const col = customAvailableColumns.find((c) => c.id === colId);
      if (!col) return;
      selHtml += `
          <div class="flex items-center justify-between p-2 rounded border-2 border-primary/50 bg-white dark:bg-gray-800 shadow-sm transition-colors" draggable="true" ondragstart="handleCustomColDragStart(event, ${index})" ondragover="handleCustomColDragOver(event)" ondrop="handleCustomColDrop(event, ${index})" ondragenter="handleCustomColDragEnter(event)" ondragleave="handleCustomColDragLeave(event)" ondragend="handleCustomColDragEnd(event)">
              <div class="flex items-center gap-2 overflow-hidden flex-1">
                  <div class="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </div>
                  <span class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate flex-1">${index + 1}. ${col.label}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                  <button onclick="removeCustomColumn('${col.id}')" class="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition focus:outline-none">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
          </div>`;
    });
    if (!selHtml)
      selHtml = `<div class="text-[10px] text-center text-gray-400 py-4 font-bold uppercase tracking-widest">No columns selected</div>`;
    selectedList.innerHTML = selHtml;
  }
}

function addCustomColumn(id) {
  if (!customSelectedColumns.includes(id)) {
    customSelectedColumns.push(id);
    renderCustomColumns();
  }
}

function removeCustomColumn(id) {
  customSelectedColumns = customSelectedColumns.filter((c) => c !== id);
  renderCustomColumns();
}

let customColDragIndex = null;

function handleCustomColDragStart(e, index) {
  customColDragIndex = index;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", index);
  setTimeout(() => {
    const item = e.target.closest(".rounded");
    if (item) item.classList.add("opacity-50");
  }, 0);
}

function handleCustomColDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleCustomColDragEnter(e) {
  e.preventDefault();
  const item = e.target.closest(".rounded");
  if (item) item.classList.add("border-dashed", "border-primary");
}

function handleCustomColDragLeave(e) {
  const item = e.target.closest(".rounded");
  if (item && !item.contains(e.relatedTarget)) {
    item.classList.remove("border-dashed", "border-primary");
  }
}

function handleCustomColDragEnd(e) {
  const item = e.target.closest(".rounded");
  if (item)
    item.classList.remove("opacity-50", "border-dashed", "border-primary");
}

function handleCustomColDrop(e, dropIndex) {
  e.preventDefault();
  const item = e.target.closest(".rounded");
  if (item)
    item.classList.remove("border-dashed", "border-primary", "opacity-50");

  if (customColDragIndex !== null && customColDragIndex !== dropIndex) {
    const movedItem = customSelectedColumns.splice(customColDragIndex, 1)[0];
    customSelectedColumns.splice(dropIndex, 0, movedItem);
    renderCustomColumns();
  }
  customColDragIndex = null;
}

function performCustomExtraction() {
  if (!extractGlobalRoster) {
    showToast("Roster data not loaded yet.");
    return;
  }

  if (customSelectedColumns.length === 0) {
    showToast("Please select at least one column.", "error");
    return;
  }

  const sheetName =
    document.getElementById("customSheetName").value.trim() ||
    "Custom Extraction";

  document
    .getElementById("customExtractionModal")
    .classList.add("hidden-force");

  const overlay = getOrCreateExtractOverlay();
  overlay.classList.remove("hidden-force");

  const config = {
    sheetName: sheetName,
    columns: customSelectedColumns,
  };
  const folderId = getCurrentExtractFolderId();

  apiCall("extractData", {
    extractType: "custom",
    excludedNrics: [],
    customConfig: config,
    folderId: folderId,
  })
    .then((res) => {
      overlay.classList.add("hidden-force");
      if (res.status === "success") {
        handleExtractionSuccess(res);
      } else {
        showToast("Extraction failed: " + res.message, "error");
      }
    })
    .catch((err) => {
      overlay.classList.add("hidden-force");
      showToast("Error extracting data: " + (err.message || "Unknown error"), "error");
    });
}

// ==========================================
// POST-EXTRACTION RESULT POPUP (LINK, DOWNLOAD & SHARE)
// ==========================================
let lastExtractedFile = null;
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function base64ToExcelBlob(base64Data, mimeType = EXCEL_MIME_TYPE) {
  const binaryStr = atob(base64Data);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || EXCEL_MIME_TYPE });
}

function getOrCreateExtractionResultModal() {
  let modal = document.getElementById("extractionResultModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "extractionResultModal";
    modal.className =
      "fixed inset-0 bg-black/60 z-[150] flex justify-center items-center p-4 backdrop-blur-sm hidden-force";
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border-2 border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden my-auto animate-slide-up relative">
        <button type="button" onclick="closeExtractionResultPopup()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 transition" aria-label="Close">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div class="p-5 border-b-2 border-gray-200 dark:border-gray-800 bg-green-50/70 dark:bg-green-950/20 flex items-center gap-3.5 pr-14">
          <div class="w-11 h-11 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h2 class="text-base md:text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight">Extraction Complete</h2>
            <p class="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-widest mt-0.5">MS Excel (.xlsx) Ready</p>
          </div>
        </div>

        <div class="p-5 flex flex-col gap-4">
          <div class="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border-2 border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">File Name</div>
              <button type="button" id="btnCopyExtractLink" onclick="copyExtractedFileLink()" class="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline focus:outline-none">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <span id="lblCopyExtractLink">Copy Link</span>
              </button>
            </div>
            <a id="extractResultLink" href="#" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2.5 group focus:outline-none">
              <div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-file-excel text-base"></i>
              </div>
              <span id="extractResultFileName" class="text-xs md:text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 underline decoration-blue-400/70 group-hover:decoration-blue-500 break-all leading-snug flex-1"></span>
              <svg class="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>

          <div class="grid grid-cols-2 gap-3 pt-1">
            <button type="button" id="btnDownloadExtracted" onclick="downloadExtractedFile()" class="w-full py-3 px-4 rounded-xl font-black text-sm text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] shadow-md transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>Download</span>
            </button>
            <button type="button" id="btnShareExtracted" onclick="shareExtractedFile()" class="w-full py-3 px-4 rounded-xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-md transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <i class="fa-solid fa-share-nodes text-sm"></i>
              <span>Share</span>
            </button>
          </div>
        </div>

        <div class="px-5 py-3.5 border-t-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 flex justify-end">
          <button type="button" onclick="closeExtractionResultPopup()" class="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Done</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeExtractionResultPopup();
    });
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !modal.classList.contains("hidden-force")
      ) {
        closeExtractionResultPopup();
      }
    });
  }
  return modal;
}

function closeExtractionResultPopup() {
  const modal = document.getElementById("extractionResultModal");
  if (modal) modal.classList.add("hidden-force");
}

function showExtractionResultPopup(res) {
  const fileName =
    res && res.fileName
      ? String(res.fileName)
      : "Extraction.xlsx";
  const downloadUrl = res && res.downloadUrl ? String(res.downloadUrl) : "";
  const absoluteDownloadUrl = downloadUrl
    ? new URL(downloadUrl, window.location.origin).href
    : "";
  const fileId = res && res.fileId ? String(res.fileId) : "";
  const fileUrl =
    (res && res.fileUrl ? String(res.fileUrl) : "") ||
    (fileId ? `https://drive.google.com/file/d/${fileId}/view` : "") ||
    absoluteDownloadUrl;

  lastExtractedFile = {
    fileName,
    fileUrl,
    fileId,
    downloadUrl,
    absoluteDownloadUrl,
    fileData: res && res.fileData ? res.fileData : "",
    mimeType: (res && res.mimeType) || EXCEL_MIME_TYPE,
  };

  const modal = getOrCreateExtractionResultModal();
  const nameEl = document.getElementById("extractResultFileName");
  const linkEl = document.getElementById("extractResultLink");
  const copyLbl = document.getElementById("lblCopyExtractLink");

  if (nameEl) nameEl.textContent = fileName;
  if (linkEl) linkEl.href = fileUrl || "#";
  if (copyLbl) copyLbl.textContent = "Copy Link";

  modal.classList.remove("hidden-force");
}

async function copyTextFallback(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

async function copyExtractedFileLink() {
  if (!lastExtractedFile || !lastExtractedFile.fileUrl) {
    showToast("No file link available to copy.", true);
    return;
  }
  try {
    await copyTextFallback(lastExtractedFile.fileUrl);
    const copyLbl = document.getElementById("lblCopyExtractLink");
    if (copyLbl) {
      copyLbl.textContent = "Copied!";
      setTimeout(() => {
        if (copyLbl) copyLbl.textContent = "Copy Link";
      }, 2000);
    }
    showToast("File link copied to clipboard!");
  } catch (e) {
    showToast("Could not copy link.", true);
  }
}

function downloadExtractedFile() {
  if (!lastExtractedFile) {
    showToast("No extracted file available.", true);
    return;
  }

  const { fileName, downloadUrl, fileData, fileId, mimeType } =
    lastExtractedFile;

  // Prefer server attachment endpoint for reliable download across iOS Safari, Android Chrome, and desktop
  if (downloadUrl) {
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Downloading Excel file...");
    return;
  }

  if (fileData) {
    try {
      const blob = base64ToExcelBlob(fileData, mimeType);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      showToast("Downloading Excel file...");
      return;
    } catch (e) {
      console.error("Blob download failed:", e);
    }
  }

  if (fileId) {
    const a = document.createElement("a");
    a.href = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Downloading Excel file...");
    return;
  }

  showToast("Download unavailable for this file.", true);
}

async function shareExtractedFile() {
  if (!lastExtractedFile) {
    showToast("No extracted file available to share.", true);
    return;
  }

  const { fileName, fileUrl, downloadUrl, absoluteDownloadUrl, fileData, mimeType } =
    lastExtractedFile;
  const shareLink = fileUrl || absoluteDownloadUrl;

  if (navigator.share) {
    // 1. Try sharing the actual MS Excel (.xlsx) file via native phone apps
    try {
      let blob = null;
      if (fileData) {
        blob = base64ToExcelBlob(fileData, mimeType);
      } else if (downloadUrl) {
        const resp = await fetch(downloadUrl);
        if (resp.ok) blob = await resp.blob();
      }

      if (blob) {
        const excelFile = new File([blob], fileName, {
          type: mimeType || EXCEL_MIME_TYPE,
        });
        if (
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [excelFile] })
        ) {
          await navigator.share({
            title: fileName,
            files: [excelFile],
          });
          return;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        return; // User closed the share sheet
      }
      // Fall through to link sharing if the OS/browser restricts .xlsx binary file sharing
      console.warn("File share fallback to link share:", err);
    }

    // 2. Fallback: Share the file link via native phone apps
    try {
      await navigator.share({
        title: fileName,
        text: fileName,
        url: shareLink,
      });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") {
        return;
      }
      console.warn("Link share failed:", err);
    }
  }

  // 3. Desktop/unsupported browser fallback: copy link
  if (shareLink) {
    try {
      await copyTextFallback(shareLink);
      showToast("Link copied! Open on mobile to share directly via phone apps.");
    } catch (e) {
      showToast("Sharing is not supported on this browser.", true);
    }
  } else {
    showToast("Sharing is not supported on this browser.", true);
  }
}
