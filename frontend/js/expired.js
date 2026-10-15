var expiredRosterData = [];
var expiredSearchQuery = "";
var expiredFilterMode = "expiring"; // 'expiring' | 'missing' | 'all'
var traineeShortNames = {};

function getTripExpiryThreshold() {
  let tripEnd =
    typeof appSettings !== "undefined" && appSettings && appSettings.tripEndDate
      ? new Date(appSettings.tripEndDate)
      : null;
  let minExpiry = null;
  if (tripEnd && !isNaN(tripEnd.getTime())) {
    minExpiry = new Date(tripEnd);
    minExpiry.setMonth(minExpiry.getMonth() + 6);
  } else {
    // Fallback: 6 months from today if trip end date is not set
    minExpiry = new Date();
    minExpiry.setMonth(minExpiry.getMonth() + 6);
  }
  return { tripEnd, minExpiry };
}

function parsePassportDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  if (typeof dateStr === "string") {
    const trimmed = dateStr.trim();
    const parts = trimmed.split(/[\/\-\s]+/);
    if (parts.length === 3) {
      const months = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const mLower = parts[1].toLowerCase().substring(0, 3);
      if (months[mLower] !== undefined) {
        const dd = parseInt(parts[0], 10);
        const yyyy = parseInt(parts[2], 10);
        d = new Date(yyyy, months[mLower], dd);
        if (!isNaN(d.getTime())) return d;
      }
      if (parts[2].length === 4) {
        const dd = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10) - 1;
        const yyyy = parseInt(parts[2], 10);
        d = new Date(yyyy, mm, dd);
        if (!isNaN(d.getTime())) return d;
      }
      if (parts[0].length === 4) {
        const yyyy = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10) - 1;
        const dd = parseInt(parts[2], 10);
        d = new Date(yyyy, mm, dd);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
}

function buildExpiredUI() {
  const el_tab_expired = document.getElementById("tab-expired");
  if (!el_tab_expired) return;

  const { tripEnd, minExpiry } = getTripExpiryThreshold();
  const tripEndFormatted =
    tripEnd && !isNaN(tripEnd.getTime())
      ? typeof formatDDMmmYYYY === "function"
        ? formatDDMmmYYYY(tripEnd)
        : tripEnd.toLocaleDateString("en-GB")
      : "Not Set";
  const cutoffFormatted =
    minExpiry && !isNaN(minExpiry.getTime())
      ? typeof formatDDMmmYYYY === "function"
        ? formatDDMmmYYYY(minExpiry)
        : minExpiry.toLocaleDateString("en-GB")
      : "Not Set";

  el_tab_expired.innerHTML = `
<div class="flex flex-col h-full w-full relative bg-white dark:bg-gray-900 rounded-xl shadow-md border-2 border-gray-200 dark:border-gray-800 overflow-hidden">
   <!-- Header Bar -->
   <div class="py-1.5 px-2 md:px-3 border-b-2 border-gray-200 dark:border-gray-800 flex flex-wrap justify-between items-center gap-2 shrink-0">
       <div class="flex items-center gap-2">
           <h3 class="font-black text-gray-900 dark:text-white text-base md:text-lg flex items-center gap-2">
               <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
               Expired Passports
           </h3>
           <span id="expiredCutoffTag" class="hidden sm:inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800" title="Passports must be valid for 6 months after trip end date">
               Cutoff: ${cutoffFormatted}
           </span>
       </div>
       <div class="flex items-center gap-2">
           <select onchange="if(this.value) navigateTo(this.value)" class="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs md:text-xs font-bold px-2.5 py-1.5 rounded-md hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-primary shadow-md cursor-pointer shrink-0 max-w-full">
               <option value="" disabled>Views</option>
               <option value="medical.html">Medical</option>
               <option value="diet.html">Dietary</option>
               <option value="expired.html" selected>Expired Passports</option>
               <option value="other.html">Other Notes</option>
           </select>
           <button onclick="loadExpiredData()" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition focus:outline-none shadow-md" title="Refresh">
               <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
           </button>
       </div>
   </div>

   <!-- Subheader & Rule Banner -->
   <div class="py-1.5 px-2 md:px-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 flex flex-wrap items-center justify-between gap-1.5 text-xs text-amber-900 dark:text-amber-200 shrink-0">
       <div class="flex items-center gap-1.5 flex-wrap">
           <span class="font-bold">Trip End Date:</span>
           <span class="font-semibold underline">${tripEndFormatted}</span>
           <span class="mx-1 opacity-50">•</span>
           <span>Requirement: Minimum <strong>6 months</strong> validity beyond trip (<span class="font-bold text-red-600 dark:text-red-400">${cutoffFormatted}</span>)</span>
       </div>
       <div id="expiredPillsContainer" class="flex items-center gap-1">
           <!-- Rendered dynamically -->
       </div>
   </div>
   
   <!-- Search Bar -->
   <div class="py-1 px-2 md:px-3 bg-gray-50 dark:bg-gray-950 border-b-2 border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-2">
       <div class="relative w-full flex-1">
           <input type="text" id="expiredSearch" oninput="handleExpiredSearch()" placeholder="Search by name, passport number, or nationality..." class="w-full p-2 pl-9 pr-8 border-2 border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-md transition">
           <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
           <button onclick="clearSearch('expiredSearch', 'handleExpiredSearch')" class="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
       </div>
   </div>
   
   <!-- Table Container -->
   <div class="flex-1 min-h-0 overflow-auto custom-scrollbar relative" id="expiredTableContainer">
       <table class="w-full table-fixed text-left border-collapse border-b-2 border-gray-200 dark:border-gray-700">
           <thead id="expiredTableHead" class="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase font-black tracking-wider z-10 shadow-md border-b-2 border-gray-200 dark:border-gray-700">
           </thead>
           <tbody id="expiredTableBody" class="text-sm divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
           </tbody>
       </table>
       
       <div id="expiredLoading" class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col justify-center items-center z-20">
           <div class="loader !w-8 !h-8 border-primary mb-2"></div>
           <span class="text-primary dark:text-green-400 font-bold text-xs tracking-wide shadow-md bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full">Loading Data...</span>
       </div>
   </div>
</div>
`;
  loadExpiredData();
}

async function loadExpiredData() {
  await new Promise((resolve) => setTimeout(resolve, 10)); // Yield to allow browser paint

  const loader = document.getElementById("expiredLoading");

  if (window.adminRosterData && window.adminRosterData.length > 0) {
    expiredRosterData = window.adminRosterData;
    if (typeof applyCaregiverLabels === "function") {
      applyCaregiverLabels(expiredRosterData);
    }
    updateTraineeShortNames();
    renderExpiredTable();
    if (loader) loader.classList.add("hidden-force");
    return;
  }

  if (loader) loader.classList.remove("hidden-force");

  try {
    const res = await apiCall("fetchAdminRoster");
    expiredRosterData = res.roster || [];
    window.adminRosterData = expiredRosterData;
    if (typeof applyCaregiverLabels === "function") {
      applyCaregiverLabels(expiredRosterData);
    }
    updateTraineeShortNames();
    renderExpiredTable();
  } catch (e) {
    if (typeof showToast === "function") {
      showToast("Failed to load passport data.", true);
    }
  } finally {
    if (loader) loader.classList.add("hidden-force");
  }
}

function updateTraineeShortNames() {
  traineeShortNames = {};
  expiredRosterData.forEach((p) => {
    if (p.role === "TRAINEE" && p.fullName) {
      traineeShortNames[
        String(p.fullName || "")
          .trim()
          .toUpperCase()
      ] = String(p.shortName || p.fullName || "")
        .trim()
        .toUpperCase();
    }
  });
}

function setExpiredFilter(mode) {
  expiredFilterMode = mode;
  renderExpiredTable();
}

function handleExpiredSearch() {
  const input = document.getElementById("expiredSearch");
  expiredSearchQuery = input ? input.value.toLowerCase().trim() : "";
  renderExpiredTable();
}

function renderExpiredTable() {
  const { minExpiry } = getTripExpiryThreshold();
  const now = new Date();

  // Compute counts across all records
  let expiringCount = 0;
  let missingCount = 0;
  const totalCount = expiredRosterData.length;

  expiredRosterData.forEach((p) => {
    const expD = parsePassportDate(p.passportExpiry);
    const hasPassportNo = Boolean(
      p.passportNo &&
        String(p.passportNo).trim() &&
        String(p.passportNo).trim() !== "-"
    );
    const isMissing = !p.passportExpiry || !expD || !hasPassportNo;

    if (isMissing) {
      missingCount++;
    } else if (minExpiry && expD < minExpiry) {
      expiringCount++;
    }
  });

  // Render filter pills
  const pillsCont = document.getElementById("expiredPillsContainer");
  if (pillsCont) {
    pillsCont.innerHTML = `
      <button onclick="setExpiredFilter('expiring')" class="px-2 py-0.5 rounded text-[11px] font-bold transition shadow-sm border ${
        expiredFilterMode === "expiring"
          ? "bg-red-600 text-white border-red-700"
          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
      }">
        Expiring (<span class="font-extrabold">${expiringCount}</span>)
      </button>
      <button onclick="setExpiredFilter('missing')" class="px-2 py-0.5 rounded text-[11px] font-bold transition shadow-sm border ${
        expiredFilterMode === "missing"
          ? "bg-amber-600 text-white border-amber-700"
          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
      }">
        Missing Details (<span class="font-extrabold">${missingCount}</span>)
      </button>
      <button onclick="setExpiredFilter('all')" class="px-2 py-0.5 rounded text-[11px] font-bold transition shadow-sm border ${
        expiredFilterMode === "all"
          ? "bg-primary text-white border-green-700"
          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
      }">
        All Passports (<span class="font-extrabold">${totalCount}</span>)
      </button>
    `;
  }

  // Filter based on active filter mode
  let data = expiredRosterData.filter((p) => {
    const expD = parsePassportDate(p.passportExpiry);
    const hasPassportNo = Boolean(
      p.passportNo &&
        String(p.passportNo).trim() &&
        String(p.passportNo).trim() !== "-"
    );
    const isMissing = !p.passportExpiry || !expD || !hasPassportNo;

    if (expiredFilterMode === "expiring") {
      // Must have an expiry date and expire before the 6-month threshold
      return Boolean(expD && minExpiry && expD < minExpiry);
    } else if (expiredFilterMode === "missing") {
      return isMissing;
    } else {
      // 'all'
      return true;
    }
  });

  // Apply search query
  if (expiredSearchQuery) {
    data = data.filter((p) => {
      const q = expiredSearchQuery;
      return (
        (p.fullName && p.fullName.toLowerCase().includes(q)) ||
        (p.shortName && p.shortName.toLowerCase().includes(q)) ||
        (p.passportNo && p.passportNo.toLowerCase().includes(q)) ||
        (p.nationality && p.nationality.toLowerCase().includes(q)) ||
        (p.nric && p.nric.toLowerCase().includes(q))
      );
    });
  }

  // Sort by expiry date ascending for 'expiring', or full name ascending
  data.sort((a, b) => {
    if (expiredFilterMode === "expiring") {
      const dateA = parsePassportDate(a.passportExpiry) || new Date(9999, 0, 1);
      const dateB = parsePassportDate(b.passportExpiry) || new Date(9999, 0, 1);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
    }
    const valA = (a.fullName || "").toString().toLowerCase();
    const valB = (b.fullName || "").toString().toLowerCase();
    if (valA < valB) return -1;
    if (valA > valB) return 1;
    return 0;
  });

  const thead = document.getElementById("expiredTableHead");
  if (thead) {
    thead.innerHTML = `<tr>
      <th class="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 align-top sticky top-0 left-0 z-20 border-r-2 border-gray-200 dark:border-gray-700 shadow-md w-[35%] text-left">
          <div class="font-bold text-gray-700 dark:text-gray-300">Participant</div>
      </th>
      <th class="py-1.5 px-2 bg-gray-100 dark:bg-gray-800 align-top sticky top-0 z-10 w-[65%] text-left">
          <div class="font-bold text-gray-700 dark:text-gray-300">Passport Details</div>
      </th>
    </tr>`;
  }

  const tbody = document.getElementById("expiredTableBody");
  if (!tbody) return;

  if (data.length === 0) {
    let emptyMessage = "";
    if (expiredSearchQuery) {
      emptyMessage = `<div class="p-8 text-center text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No records found matching "${expiredSearchQuery}".</div>`;
    } else if (expiredFilterMode === "expiring") {
      const cutoffStr =
        minExpiry && typeof formatDDMmmYYYY === "function"
          ? formatDDMmmYYYY(minExpiry)
          : "the 6-month cutoff";
      emptyMessage = `
        <div class="flex flex-col items-center justify-center py-10 px-4 text-center">
          <div class="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/60 border-2 border-green-300 dark:border-green-800 text-green-600 dark:text-green-400 flex items-center justify-center mb-3 text-2xl shadow-md">✓</div>
          <h4 class="font-black text-gray-900 dark:text-white text-base md:text-lg mb-1">All Passports Valid!</h4>
          <p class="text-xs md:text-sm text-gray-600 dark:text-gray-400 max-w-md mb-4 leading-relaxed">
            No participants have passports expiring within 6 months of the trip end date (<span class="font-bold text-gray-800 dark:text-gray-200">${cutoffStr}</span>).
          </p>
          <div class="flex gap-2">
            <button onclick="setExpiredFilter('all')" class="px-3.5 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-green-600 transition shadow-md">
              View All ${totalCount} Passports
            </button>
            ${
              missingCount > 0
                ? `
              <button onclick="setExpiredFilter('missing')" class="px-3.5 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition shadow-md">
                View ${missingCount} Missing Details
              </button>
            `
                : ""
            }
          </div>
        </div>
      `;
    } else if (expiredFilterMode === "missing") {
      emptyMessage = `
        <div class="flex flex-col items-center justify-center py-10 px-4 text-center">
          <div class="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/60 border-2 border-green-300 dark:border-green-800 text-green-600 dark:text-green-400 flex items-center justify-center mb-3 text-2xl shadow-md">✓</div>
          <h4 class="font-black text-gray-900 dark:text-white text-base md:text-lg mb-1">No Missing Details</h4>
          <p class="text-xs md:text-sm text-gray-600 dark:text-gray-400 max-w-md mb-4 leading-relaxed">
            All participants have their passport number and valid expiry date recorded.
          </p>
          <button onclick="setExpiredFilter('all')" class="px-3.5 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-green-600 transition shadow-md">
            View All Passports
          </button>
        </div>
      `;
    } else {
      emptyMessage = `<div class="p-8 text-center text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold">No participant records found.</div>`;
    }

    tbody.innerHTML = `<tr><td colspan="2" class="p-0">${emptyMessage}</td></tr>`;
    return;
  }

  let html = "";
  data.forEach((p) => {
    const role = p.role || "UNKNOWN";
    const roleStr = role.substring(0, 3).toUpperCase();
    const roleColor =
      role === "TRAINEE"
        ? "text-green-600 dark:text-green-400"
        : role === "CAREGIVER"
          ? "text-purple-600 dark:text-purple-400"
          : "text-orange-600 dark:text-orange-400";
    const fullNameUpper = (p.fullName || "").toUpperCase();
    const shortNameUpper = (p.shortName || "").toUpperCase();
    const nameClass = "font-bold text-gray-900 dark:text-gray-100";

    const expD = parsePassportDate(p.passportExpiry);
    const hasPassportNo = Boolean(
      p.passportNo &&
        String(p.passportNo).trim() &&
        String(p.passportNo).trim() !== "-"
    );

    let isPast = false;
    let isWithin6Months = false;
    let isMissing = !p.passportExpiry || !expD || !hasPassportNo;

    if (expD && !isNaN(expD.getTime())) {
      if (expD < now) {
        isPast = true;
      } else if (minExpiry && expD < minExpiry) {
        isWithin6Months = true;
      }
    }

    const expiryDisplay = expD
      ? typeof formatDDMmmYYYY === "function"
        ? formatDDMmmYYYY(expD)
        : expD.toLocaleDateString("en-GB")
      : p.passportExpiry
        ? String(p.passportExpiry)
        : "Not Provided";

    let statusHtml = "";
    if (isPast) {
      statusHtml = `
        <div class="mt-2 p-2 rounded-lg border bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800">
           <span class="font-bold text-red-700 dark:text-red-400 uppercase text-[11px] block mb-0.5 tracking-wider">Passport Status</span>
           <div class="font-extrabold text-red-800 dark:text-red-300 flex items-center gap-1.5 flex-wrap">
              <span>Expired on ${expiryDisplay}</span>
              <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-black uppercase tracking-wider shadow-sm">Already Expired</span>
           </div>
        </div>`;
    } else if (isWithin6Months) {
      statusHtml = `
        <div class="mt-2 p-2 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800">
           <span class="font-bold text-red-600 dark:text-red-400 uppercase text-[11px] block mb-0.5 tracking-wider">Passport Expiry Date</span>
           <div class="font-extrabold text-red-700 dark:text-red-300 flex items-center gap-1.5 flex-wrap">
              <span>${expiryDisplay}</span>
              <span class="px-2 py-0.5 bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded text-[10px] font-bold uppercase tracking-wider">
                Expires within 6 months of trip
              </span>
           </div>
        </div>`;
    } else if (isMissing) {
      statusHtml = `
        <div class="mt-2 p-2 rounded-lg border bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700">
           <span class="font-bold text-amber-700 dark:text-amber-400 uppercase text-[11px] block mb-0.5 tracking-wider">Passport Status</span>
           <div class="font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 flex-wrap">
              <span>${!hasPassportNo ? "Passport No. Missing" : "Expiry Date Missing"}</span>
              <span class="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black uppercase tracking-wider shadow-sm">Needs Attention</span>
           </div>
        </div>`;
    } else {
      statusHtml = `
        <div class="mt-2 p-2 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/60">
           <span class="font-bold text-green-700 dark:text-green-400 uppercase text-[11px] block mb-0.5 tracking-wider">Passport Expiry Date</span>
           <div class="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 flex-wrap">
              <span>${expiryDisplay}</span>
              <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded text-[10px] font-bold uppercase tracking-wider">Valid (&gt;6 months)</span>
           </div>
        </div>`;
    }

    const groupColor =
      typeof getProjectColor === "function"
        ? getProjectColor(p.group)
        : "bg-gray-100 text-gray-700 border-gray-300";
    const groupAbbr =
      typeof getProjectAbbreviation === "function"
        ? getProjectAbbreviation(p.group || "None")
        : p.group || "None";

    html += `<tr class="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer" data-nric="${p.nric}" onclick="if(typeof showParticipantSummaryModal === 'function') showParticipantSummaryModal('${p.nric}')" title="Click to view participant summary">
       <td class="py-2 px-2.5 align-top sticky left-0 z-10 bg-white dark:bg-gray-900 border-r-2 border-gray-200 dark:border-gray-700 shadow-md w-[35%]">
           <div class="${nameClass} text-xs md:text-sm leading-tight whitespace-normal break-words">${fullNameUpper}</div>
           ${shortNameUpper && shortNameUpper !== fullNameUpper ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium whitespace-normal break-words">${shortNameUpper}</div>` : ""}
           <div class="flex items-center gap-1 mt-1.5 flex-wrap">
               <span class="text-[11px] font-black ${roleColor} bg-gray-50 dark:bg-gray-800 px-1.5 py-[1px] leading-tight rounded-sm border-2 border-gray-200 dark:border-gray-700 uppercase tracking-wide">${roleStr}</span>
               <span class="px-1.5 py-[1px] leading-tight rounded-sm border shadow-md text-[11px] font-bold ${groupColor} whitespace-normal break-words inline-block" title="${(p.group || "None").toUpperCase()}">${groupAbbr}</span>
           </div>
           ${p.caregiverFor ? `<div class="mt-1 font-bold text-purple-600 dark:text-purple-400 text-xs">[${p.caregiverFor.toUpperCase()}]</div>` : ""}
       </td>
       <td class="py-2 px-2.5 align-top w-[65%] text-xs leading-relaxed whitespace-normal break-words border-l-2 border-gray-100 dark:border-gray-700/50">
           <div class="flex flex-col gap-1.5">
               <div class="grid grid-cols-2 gap-3">
                   <div>
                       <span class="font-bold text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wider block mb-0.5">Passport Number</span>
                       <div class="font-mono font-bold text-sm ${hasPassportNo ? "text-gray-900 dark:text-gray-100" : "text-amber-600 dark:text-amber-400 italic"}">
                           ${hasPassportNo ? (p.passportNo || "").toUpperCase() : "Not Provided"}
                       </div>
                   </div>
                   <div>
                       <span class="font-bold text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wider block mb-0.5">Nationality</span>
                       <div class="font-bold text-xs text-gray-800 dark:text-gray-200 uppercase">
                           ${p.nationality ? p.nationality.toUpperCase() : "-"}
                       </div>
                   </div>
               </div>
               ${statusHtml}
           </div>
       </td>
    </tr>`;
  });

  tbody.innerHTML = html;
}

window.buildExpiredUI = buildExpiredUI;
window.loadExpiredData = loadExpiredData;
window.handleExpiredSearch = handleExpiredSearch;
window.setExpiredFilter = setExpiredFilter;
window.renderExpiredTable = renderExpiredTable;
window.getTripExpiryThreshold = getTripExpiryThreshold;
window.parsePassportDate = parsePassportDate;
