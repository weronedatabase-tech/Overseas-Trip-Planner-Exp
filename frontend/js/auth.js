async function attemptLogin(btn) {
  const pass = document.getElementById("loginPass").value.trim();
  const err = document.getElementById("loginError");

  if (!pass) {
    err.textContent = "Please enter Password";
    return err.classList.remove("hidden-force");
  }

  err.classList.add("hidden-force");
  setBtnLoading(btn, true);

  try {
    const res = await apiCall("login", { password: pass });
    currentUser = {
      nric: res.nric,
      role: res.role,
      name: res.name,
      isMainAdmin: Boolean(res.isMainAdmin || res.nric === "ADMIN"),
      token: res.token || "",
    };
    localStorage.setItem("userSession", JSON.stringify(currentUser));
    if (typeof window.clearApiClientCache === "function") {
      window.clearApiClientCache();
    }
    if (currentUser.role === "admin") {
      const targetPage =
        typeof resolveAdminDefaultPage === "function"
          ? await resolveAdminDefaultPage()
          : typeof getAdminDefaultPage === "function"
            ? getAdminDefaultPage()
            : "roster.html";
      await navigateTo(targetPage);
    } else {
      await navigateTo("dashboard.html");
    }
  } catch (error) {
    err.textContent = error.message;
    err.classList.remove("hidden-force");
  } finally {
    setBtnLoading(btn, false);
  }
}

function logout(btn) {
  if (btn) setBtnLoading(btn, true);
  [
    "userSession",
    "cachedAdminRoster",
    "cachedLogistics",
    "appSettings",
    "activeGroupsList",
    "activeBusesList",
  ].forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  });
  ["activeArchiveTrip", "cachedAdminRoster", "cachedLogistics"].forEach((k) => {
    try {
      sessionStorage.removeItem(k);
    } catch (e) {}
  });
  if (typeof window.clearApiClientCache === "function") {
    window.clearApiClientCache();
  }
  if (window.ArchiveMode && typeof window.ArchiveMode.resetAllModuleCaches === "function") {
    window.ArchiveMode.resetAllModuleCaches();
  }
  currentUser = null;
  navigateTo("index.html");
}

function togglePassword(id) {
  const el = document.getElementById(id);
  const eyeOpen = document.getElementById("eyeOpen");
  const eyeClosed = document.getElementById("eyeClosed");
  if (el.type === "password") {
    el.type = "text";
    eyeOpen.classList.add("hidden-force");
    eyeClosed.classList.remove("hidden-force");
  } else {
    el.type = "password";
    eyeOpen.classList.remove("hidden-force");
    eyeClosed.classList.add("hidden-force");
  }
}
async function toggleLandingReceipt() {
  const wrapper = document.getElementById("landingReceiptFormWrapper");
  const icon = document.getElementById("receiptExpandIcon");
  if (!wrapper) return;
  if (wrapper.classList.contains("hidden-force")) {
    wrapper.classList.remove("hidden-force");
    if (icon) icon.classList.add("rotate-180");

    try {
      const catSelect = document.getElementById("landingRecCategory");
      if (catSelect) {
        catSelect.innerHTML =
          '<option value="" disabled selected>Loading categories...</option>';
        const finRes = await apiCall("fetchFinance");
        if (finRes && finRes.rates) {
          window.globalFinanceRates = finRes.rates;
        }
        const financeConfig = finRes.data?.config || {};
        const financeOptions =
          finRes.data?.options ||
          (Array.isArray(finRes.data) ? finRes.data : []);

        let optionsHtml = "";
        if (financeConfig.finalOptionId) {
          const opt = financeOptions.find(
            (o) => o.id === financeConfig.finalOptionId,
          );
          if (opt && opt.fields) {
            const esc =
              typeof window.escapeHtml === "function"
                ? window.escapeHtml
                : (s) =>
                    String(s == null ? "" : s)
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#39;");
            opt.fields.forEach((f) => {
              optionsHtml += `<option value="${esc(f.id)}">${esc(f.name)}</option>`;
            });
          }
        }
        if (optionsHtml === "") {
          optionsHtml =
            '<option value="" disabled selected>No categories available</option>';
        } else {
          optionsHtml =
            '<option value="" disabled selected>Select Category</option>' +
            optionsHtml;
        }
        if (catSelect) catSelect.innerHTML = optionsHtml;
      }
    } catch (e) {
      console.error("Failed to fetch finance options", e);
    }
  } else {
    wrapper.classList.add("hidden-force");
    if (icon) icon.classList.remove("rotate-180");
  }
}

async function submitLandingReceipt(e) {
  e.preventDefault();
  const btn = document.getElementById("landingRecBtn");
  const err = document.getElementById("landingReceiptError");
  const succ = document.getElementById("landingReceiptSuccess");
  err.classList.add("hidden-force");
  succ.classList.add("hidden-force");

  const nric = document
    .getElementById("landingRecNric")
    .value.trim()
    .toUpperCase();
  const nameField = document.getElementById("landingRecName");
  const uploaderName = nameField ? nameField.value.trim() : "";
  const amount =
    parseFloat(document.getElementById("landingRecAmount").value) || 0;
  const category = document.getElementById("landingRecCategory").value.trim();
  const remarks = document.getElementById("landingRecRemarks").value.trim();
  const fileInput = document.getElementById("landingRecFile");

  if (!nric) {
    err.textContent = "Uploader NRIC is required.";
    return err.classList.remove("hidden-force");
  }
  if (
    typeof isValidNRIC === "function" &&
    !isValidNRIC(nric) &&
    nric.length < 5
  ) {
    err.textContent = "Invalid NRIC/FIN or Passport format.";
    return err.classList.remove("hidden-force");
  }
  if (isNaN(amount) || amount === 0) {
    err.textContent = "Please enter a valid non-zero amount.";
    return err.classList.remove("hidden-force");
  }
  if (!category) {
    err.textContent = "Category is required.";
    return err.classList.remove("hidden-force");
  }
  if (!fileInput.files.length) {
    err.textContent = "Please select a file.";
    return err.classList.remove("hidden-force");
  }

  const file = fileInput.files[0];
  if (file.size > 4 * 1024 * 1024) {
    err.textContent = "File exceeds 4MB limit.";
    return err.classList.remove("hidden-force");
  }

  setBtnLoading(btn, true);
  try {
    const base64 = await toBase64(file);

    const ext = file.name.split(".").pop() || "png";
    const receiptNo = `${nric.slice(-4)}${Date.now().toString().slice(-4)}`;
    const finalFileName = `${uploaderName || nric} - ${receiptNo}.${ext}`;
    const parsedSgd = parseFloat(document.getElementById("landingRecSgd").value);

    const payload = {
      uploaderNric: nric,
      uploaderName: uploaderName,
      currency: document.getElementById("landingRecCurrency").value,
      amount: amount,
      rate: parseFloat(document.getElementById("landingRecRate").value) || 1,
      sgdAmount: isNaN(parsedSgd) || parsedSgd === 0 ? amount : parsedSgd,
      categoryId: category,
      remarks: remarks,
      fileName: finalFileName,
      mimeType: file.type,
      fileData: base64.split(",")[1],
    };
    const res = await apiCall("uploadReceipt", { payload: payload });
    succ.textContent = "Receipt uploaded successfully!";
    succ.classList.remove("hidden-force");
    document.getElementById("landingReceiptForm").reset();
  } catch (error) {
    err.textContent = error.message;
    err.classList.remove("hidden-force");
  } finally {
    setBtnLoading(btn, false);
  }
}

function landingCurChange() {
  let cur = document.getElementById("landingRecCurrency").value;
  const rateContainer = document.getElementById(
    "landingReceiptBidirectionalRate",
  );

  if (cur === "SGD") {
    rateContainer.classList.add("hidden-force");
    document.getElementById("landingRecRate").value = 1;
  } else {
    rateContainer.classList.remove("hidden-force");
    document.getElementById("landingRecCurLabel1").innerText = cur;
    document.getElementById("landingRecCurLabel2").innerText = cur;

    let rate =
      (window.globalFinanceRates && window.globalFinanceRates[cur] > 0
        ? parseFloat(window.globalFinanceRates[cur])
        : 0) || (cur === "MYR" ? 0.31 : 1);

    document.getElementById("landingRecRate").value = rate;
    document.getElementById("landingRecRateToSgd").value =
      rate >= 0.01 ? rate.toFixed(4) : rate.toFixed(6);
    const inv = 1 / rate;
    document.getElementById("landingRecRateFromSgd").value =
      inv >= 100 ? inv.toFixed(2) : inv.toFixed(4);
  }
  landingCalcSgd();
}

function handleLandingRateInputSync(mode, value) {
  const val = parseFloat(value);
  const inputToSgd = document.getElementById("landingRecRateToSgd");
  const inputFromSgd = document.getElementById("landingRecRateFromSgd");
  const hiddenRate = document.getElementById("landingRecRate");

  if (isNaN(val) || val <= 0 || value.trim() === "") {
    if (value.trim() === "") {
      if (mode === "to_sgd" && inputFromSgd) inputFromSgd.value = "";
      if (mode === "from_sgd" && inputToSgd) inputToSgd.value = "";
    }
    hiddenRate.value = 1; // fallback
  } else {
    const inverse = 1 / val;
    if (mode === "to_sgd") {
      if (inputFromSgd)
        inputFromSgd.value = inverse >= 100 ? inverse.toFixed(2) : inverse.toFixed(4);
      hiddenRate.value = val;
    } else if (mode === "from_sgd") {
      if (inputToSgd)
        inputToSgd.value = inverse >= 0.01 ? inverse.toFixed(4) : inverse.toFixed(6);
      hiddenRate.value = inverse; // 1 Foreign = X SGD
    }
  }
  landingCalcSgd();
}

function landingCalcSgd() {
  let amt = parseFloat(document.getElementById("landingRecAmount").value) || 0;
  let rate = parseFloat(document.getElementById("landingRecRate").value) || 1;
  document.getElementById("landingRecSgd").value = (amt * rate).toFixed(2);
}
