let loadedFamily = [];
let finConfig = null;
let finOptions = [];
let globalFinanceRates = { "SGD": 1 };
let myReceipts = [];

async function loadProfileData() {
 const tabProfile = document.getElementById('tab-profile');
 if(!tabProfile) return;
 
 tabProfile.innerHTML = `<div class="loader w-8 h-8 border-primary mx-auto my-12"></div>`;

 try {
   const [profRes, finRes, recRes] = await Promise.all([
       apiCall('getProfile', { nric: currentUser.nric }),
       apiCall('fetchFinance'),
       apiCall('fetchReceipts')
   ]);

   loadedFamily = profRes.family || [];
   finConfig = finRes.data?.config || {};
   finOptions = finRes.data?.options || [];
   globalFinanceRates = finRes.rates || { "SGD": 1 };
   myReceipts = (recRes.receipts || []).filter(r => r.uploaderNric === currentUser.nric && !r.isDeleted);

   renderProfileFullView();

 } catch (e) { 
   tabProfile.innerHTML = '<p class="text-red-500 font-bold text-xs p-2 text-center">Error loading dashboard.</p>'; 
 }
}

function generatePayNowStr(proxyType, proxyValue, amount, ref) {
 const formatTlv = (id, value) => {
     const len = value.length.toString().padStart(2, '0');
     return `${id}${len}${value}`;
 };
 
 const crc16 = (str) => {
     let crc = 0xFFFF;
     for (let c = 0; c < str.length; c++) {
         crc ^= str.charCodeAt(c) << 8;
         for (let i = 0; i < 8; i++) {
             if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
             else crc = crc << 1;
         }
     }
     return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
 };

 const pFormat = formatTlv('00', '01');
 const init = formatTlv('01', '12'); 
 const guid = formatTlv('00', 'SG.PAYNOW');
 const type = formatTlv('01', proxyType); 
 const val = formatTlv('02', proxyValue);
 const edit = formatTlv('03', '1'); 
 const accountInfo = formatTlv('26', guid + type + val + edit);
 const mcc = formatTlv('52', '0000');
 const cur = formatTlv('53', '702');
 const amt = formatTlv('54', parseFloat(amount).toFixed(2));
 const country = formatTlv('58', 'SG');
 const merchant = formatTlv('59', 'MYG Trip');
 const city = formatTlv('60', 'Singapore');
 const additional = ref ? formatTlv('62', formatTlv('01', ref)) : '';
 
 let str = pFormat + init + accountInfo + mcc + cur + amt + country + merchant + city + additional + '6304';
 str += crc16(str);
 return str;
}

function renderProfileFullView() {
 const tabProfile = document.getElementById('tab-profile');
 let html = '';

 // 1. Locked Banner
 if(!appSettings.allowEdits) {
   let cListHtml = '';
   if(appSettings.committee) {
     appSettings.committee.forEach(c => { 
       if(c.phone) cListHtml += `<a href="https://wa.me/65${c.phone}" target="_blank" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold px-2 py-1 rounded shadow-sm text-[10px] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Chat with ${c.name}</a>`; 
     });
   }
   html += `
   <div class="bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg shadow-sm">
       <p class="font-bold mb-0.5 text-xs">🔒 Editing is currently Locked.</p>
       <p class="text-[10px] mb-2">To request changes to your details, please contact a Committee Member:</p>
       <div class="flex flex-wrap gap-1.5">${cListHtml}</div>
   </div>`;
 }

 // 2. Profiles Grid
 let profilesHtml = '';
 loadedFamily.forEach((m, i) => {
   let groupOpts = `<option value="">Select...</option>`;
   if(appSettings.projectGroups) { 
     appSettings.projectGroups.forEach(g => { groupOpts += `<option value="${g}" ${m.group === g ? 'selected' : ''}>${g}</option>`; }); 
   }
   if(m.group && (!appSettings.projectGroups || !appSettings.projectGroups.includes(m.group))) { 
     groupOpts += `<option value="${m.group}" selected>${m.group} (Archived)</option>`; 
   }
   const dynColor = getProjectColor(m.group);

   profilesHtml += `
     <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative" id="profCard_${i}">
       <div class="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-2 mb-3">
         <div class="flex items-center flex-wrap gap-1.5">
           <span class="font-extrabold text-[13px] md:text-sm px-2 py-0.5 rounded shadow-sm border ${dynColor} leading-tight">${m.fullName}</span> 
           <span class="text-[9px] font-black text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded uppercase tracking-wider">${m.role}</span>
         </div>
         ${appSettings.allowEdits ? `<button onclick="enableEditMode(${i})" class="text-primary dark:text-blue-400 text-xs font-bold hover:bg-blue-50 dark:hover:bg-gray-800 px-2 py-1 rounded transition focus:outline-none shrink-0 border border-transparent hover:border-blue-200 dark:hover:border-gray-700 shadow-sm">Edit</button>` : ''}
       </div>
       <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-gray-800 dark:text-gray-200">
         <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Short Name</p><p class="font-semibold">${m.shortName || '-'}</p></div>
         <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">NRIC / FIN</p><p class="font-semibold uppercase">${m.nric}</p></div>
         <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Date of Birth</p><p class="font-semibold">${m.dob}</p></div>
         <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Gender & Nat.</p><p class="font-semibold">${m.gender} | ${m.nationality}</p></div>
         <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Contact & Email</p><p class="font-semibold">${m.contact} | ${m.email || 'N/A'}</p></div>
         <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-1">Project</p><span class="font-bold text-[10px] px-1.5 py-0.5 rounded border inline-block shadow-sm ${dynColor}">${m.group || 'None'}</span></div>
         <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Home Address</p><p class="font-semibold">${m.address}</p></div>
         <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Passport No.</p><p class="font-semibold uppercase">${m.passportNo}</p></div>
         <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Passport Expiry</p><p class="font-semibold">${m.passportExpiry}</p></div>
         <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Emerg. Contact</p><p class="font-semibold">${m.emergencyName} (${m.emergencyRelation}) - <span class="font-mono">${m.emergencyContact}</span></p></div>
         <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Dietary Needs</p><p class="font-semibold text-red-600 dark:text-red-400">${m.diet || 'None'}</p></div>
         <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Sleeping Arrangement</p><p class="font-semibold text-blue-600 dark:text-blue-400">${m.sleeping || 'No special request'}</p></div>
         <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Other Points to Note</p><p class="font-semibold">${m.otherPoints || 'None'}</p></div>
         ${m.role === 'CAREGIVER' ? `<div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[9px] uppercase tracking-wider mb-0.5">Caregiver For</p><p class="font-semibold">${m.relatedTrainee} (${m.relationship})</p></div>` : ''}
       </div>
     </div>
     
     <form id="profEdit_${i}" onsubmit="event.preventDefault(); saveProfileEdit(${i}, this.querySelector('button[type=submit]'));" class="hidden-force bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-primary dark:border-blue-500 space-y-3 shadow-[0_4px_15px_-5px_rgba(37,99,235,0.2)]">
       <h4 class="font-black text-sm mb-1 border-b border-gray-100 dark:border-gray-800 pb-1.5 text-gray-900 dark:text-white tracking-tight">Edit Details</h4>
       <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Full Name</label><input type="text" id="edName_${i}" value="${m.fullName}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Short Name</label><input type="text" id="edShortName_${i}" value="${m.shortName || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Email</label><input type="text" id="edEmail_${i}" value="${m.email}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Contact</label><input type="tel" pattern="[0-9]{8}" id="edContact_${i}" value="${m.contact}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Gender</label><select id="edGender_${i}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"><option ${m.gender==='Male'?'selected':''}>Male</option><option ${m.gender==='Female'?'selected':''}>Female</option></select></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Role</label><select id="edRole_${i}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"><option ${m.role==='TRAINEE'?'selected':''}>TRAINEE</option><option ${m.role==='CAREGIVER'?'selected':''}>CAREGIVER</option><option ${m.role==='VOLUNTEER'?'selected':''}>VOLUNTEER</option></select></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Project</label><select id="edGroup_${i}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${groupOpts}</select></div>
          <div class="md:col-span-2"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Address</label><textarea id="edAddress_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.address}</textarea></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Nationality</label><input type="text" id="edNat_${i}" value="${m.nationality}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">DOB</label><input type="text" id="edDob_${i}" value="${m.dob}" readonly onclick="openDatePicker('edDob_${i}', 'dob')" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-center font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Passport No.</label><input type="text" id="edPass_${i}" value="${m.passportNo}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs uppercase font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Passport Expiry</label><input type="text" id="edExp_${i}" value="${m.passportExpiry}" readonly onclick="openDatePicker('edExp_${i}', 'exp')" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-center font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Emergency Contact Name</label><input type="text" id="edEmName_${i}" value="${m.emergencyName}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Emergency Contact No.</label><input type="tel" pattern="[0-9]{8}" id="edEmCont_${i}" value="${m.emergencyContact}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Emergency Relation</label><input type="text" id="edEmRel_${i}" value="${m.emergencyRelation}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Dietary Needs</label><input type="text" id="edDiet_${i}" value="${m.diet}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
          <div class="md:col-span-2"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Sleeping Arrangement Request</label><textarea id="edSleep_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.sleeping}</textarea></div>
          <div class="md:col-span-2"><label class="text-[10px] font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Other Points to Note</label><textarea id="edOther_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.otherPoints}</textarea></div>
       </div>
       <div class="flex space-x-2 pt-1 mt-2 border-t border-gray-100 dark:border-gray-800">
         <button type="button" onclick="cancelEditMode(${i})" class="flex-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm mt-2">Cancel</button>
         <button type="submit" class="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg shadow-sm hover:bg-blue-600 transition flex justify-center items-center focus:outline-none mt-2">
            <span class="btn-text">Save Changes</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div>
         </button>
       </div>
     </form>
   `;
 });

 html += `
 <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
   <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full">
     <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">
         <h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
             <svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Trip Fees & Payment
         </h3>
     </div>
     ${generatePaymentPortalHtml()}
   </div>
   <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full">
     <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">
         <h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
             <svg class="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             Upload Receipt
         </h3>
     </div>
     ${generateReceiptFormHtml()}
   </div>
 </div>
 
 <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mt-4">
     <h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">My Receipts History</h3>
     <div id="myReceiptsContainer" class="overflow-x-auto">
         ${generateMyReceiptsHtml()}
     </div>
 </div>
 `;

 tabProfile.innerHTML = `<div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2 mb-3"><h3 class="text-lg font-black text-gray-900 dark:text-white tracking-tight">Personal Details</h3></div>` + html;
}

function generatePaymentPortalHtml() {
 const pocNric = loadedFamily.length > 0 ? loadedFamily[0].pocNric : currentUser.nric;
 const baseFee = finConfig.perPersonFee || 0;
 const size = loadedFamily.length;
 const dev = finConfig.feeDeviations?.[pocNric]?.amount || 0;
 const finalExpected = (size * baseFee) + dev;
 const isPaid = finConfig.feesReceived?.[pocNric] === true;

 let membersListHtml = loadedFamily.map(m => {
     const roleColor = m.role === 'TRAINEE' ? 'text-blue-600 dark:text-blue-400' : (m.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400');
     return `<span class="inline-block mr-1.5"><span class="${roleColor} font-black text-[9px] mr-0.5 border border-current px-0.5 rounded">${m.role.substring(0,3)}</span><span class="font-bold text-xs text-gray-800 dark:text-gray-200">${m.shortName || m.fullName}</span></span>`;
 }).join('');

 if (finalExpected <= 0) {
     return `<div class="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-gray-500"><svg class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p class="text-xs font-bold uppercase tracking-widest">No pending fees.</p></div>`;
 }

 if (isPaid) {
     return `
     <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl flex flex-col items-center justify-center flex-1">
         <div class="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mb-3 shadow-md">
             <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
         </div>
         <h4 class="text-lg font-black text-green-800 dark:text-green-400 uppercase tracking-widest mb-1">Payment Received</h4>
         <p class="text-xs font-bold text-green-600 dark:text-green-500">Thank you for your payment of SGD ${finalExpected.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
     </div>
     `;
 }

 const orderNo = pocNric.substring(0, 4) + "-" + Date.now().toString().slice(-4);
 const qrStr = generatePayNowStr('2', '201234567M', finalExpected, orderNo); 
 const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrStr)}`;

 return `
 <div class="flex flex-col gap-3">
     <div class="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
         <p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Total Fee for Family Group</p>
         <p class="text-2xl font-black text-blue-700 dark:text-blue-400 leading-none">SGD ${finalExpected.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
         <div class="mt-2 text-left">${membersListHtml}</div>
     </div>
     
     <div class="flex flex-col items-center justify-center p-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
         <img src="${qrUrl}" alt="PayNow QR Code" class="w-48 h-48 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-2">
         <p class="text-xs font-bold text-gray-800 dark:text-gray-200 text-center">Scan with your banking app to PayNow</p>
         <p class="text-[9px] font-medium text-gray-500 mt-1">Order Ref: <span class="font-mono font-bold">${orderNo}</span></p>
     </div>
 </div>
 `;
}

function generateReceiptFormHtml() {
 let finalOpt = finOptions.find(o => o.id === finConfig.finalOptionId);
 let catOptionsHtml = '<option value="">-- Select Category --</option>';
 if (finalOpt && finalOpt.fields) {
     finalOpt.fields.forEach(f => {
         catOptionsHtml += `<option value="${f.id}">${f.name}</option>`;
     });
 } else {
     catOptionsHtml = '<option value="">(Budget not finalized)</option>';
 }

 const currencies = ["SGD", "MYR", "USD", "EUR", "GBP", "AUD", "IDR", "THB", "JPY", "KRW", "TWD", "PHP", "VND"];
 let curOptionsHtml = '';
 currencies.forEach(c => { curOptionsHtml += `<option value="${c}">${c}</option>`; });

 const rateVal = globalFinanceRates['SGD'] || 1;

 return `
 <form id="receiptForm" onsubmit="event.preventDefault(); submitReceipt(this.querySelector('button[type=submit]'));" class="flex flex-col gap-3 h-full">
     <div>
         <label class="block text-[10px] font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expense Category</label>
         <select id="recCategory" required class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary shadow-sm" ${!finalOpt ? 'disabled' : ''}>
             ${catOptionsHtml}
         </select>
     </div>
     
     <div class="grid grid-cols-2 gap-3">
         <div>
             <label class="block text-[10px] font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Currency</label>
             <select id="recCurrency" onchange="onReceiptCurChange()" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary shadow-sm">
                 ${curOptionsHtml}
             </select>
         </div>
         <div>
             <label class="block text-[10px] font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</label>
             <input type="number" id="recAmount" step="0.01" required oninput="calcReceiptSgd()" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary shadow-sm text-right" placeholder="0.00">
         </div>
     </div>

     <div class="grid grid-cols-2 gap-3 p-2 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-800/50">
         <div>
             <label class="block text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Locked Rate</label>
             <input type="number" id="recRate" value="${rateVal}" readonly class="w-full bg-transparent border-none p-0 text-xs font-black text-purple-800 dark:text-purple-300 focus:ring-0">
         </div>
         <div class="text-right">
             <label class="block text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">SGD Equivalent</label>
             <div class="flex items-center justify-end gap-1">
                 <span class="text-xs font-black text-purple-800 dark:text-purple-300">SGD</span>
                 <input type="text" id="recSgd" value="0.00" readonly class="w-16 bg-transparent border-none p-0 text-sm font-black text-purple-800 dark:text-purple-300 focus:ring-0 text-right text-ellipsis">
             </div>
         </div>
     </div>

     <div>
         <label class="block text-[10px] font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">File (Max 4MB)</label>
         <input type="file" id="recFile" required accept="image/*,.pdf" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600">
     </div>

     <div>
         <label class="block text-[10px] font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks</label>
         <input type="text" id="recRemarks" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary shadow-sm" placeholder="Optional details...">
     </div>

     <div class="mt-auto pt-2">
         <button type="submit" class="w-full bg-purple-600 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm hover:bg-purple-700 transition flex justify-center items-center focus:outline-none" ${!finalOpt ? 'disabled' : ''}>
            <span class="btn-text">Upload Receipt</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div>
         </button>
     </div>
 </form>
 `;
}

function onReceiptCurChange() {
 const cur = document.getElementById('recCurrency').value;
 const rate = globalFinanceRates[cur] || 1;
 document.getElementById('recRate').value = rate.toFixed(4);
 calcReceiptSgd();
}

function calcReceiptSgd() {
 const amt = parseFloat(document.getElementById('recAmount').value) || 0;
 const rate = parseFloat(document.getElementById('recRate').value) || 1;
 document.getElementById('recSgd').value = (amt * rate).toFixed(2);
}

async function submitReceipt(btn) {
 const cat = document.getElementById('recCategory').value;
 const cur = document.getElementById('recCurrency').value;
 const amt = parseFloat(document.getElementById('recAmount').value) || 0;
 const rate = parseFloat(document.getElementById('recRate').value) || 1;
 const sgd = parseFloat(document.getElementById('recSgd').value) || 0;
 const rem = document.getElementById('recRemarks').value;
 const fileInput = document.getElementById('recFile');

 if (!cat || amt <= 0 || !fileInput.files || fileInput.files.length === 0) {
     showToast("Please fill all required fields and select a file.", true);
     return;
 }

 const file = fileInput.files[0];
 if (file.size > 4194304) {
     showToast("File must be smaller than 4MB.", true);
     return;
 }

 setBtnLoading(btn, true);

 try {
     const base64Data = await new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = (e) => resolve(e.target.result.split(',')[1]);
         reader.onerror = () => reject(new Error("File read error"));
         reader.readAsDataURL(file);
     });

     const payload = {
         uploaderNric: currentUser.nric,
         categoryId: cat,
         currency: cur,
         amount: amt,
         rate: rate,
         sgdAmount: sgd,
         remarks: rem,
         fileName: file.name,
         mimeType: file.type || 'application/octet-stream',
         fileData: base64Data
     };

     const res = await apiCall('uploadReceipt', { payload: payload });
     if (res.receipts) {
         myReceipts = res.receipts.filter(r => r.uploaderNric === currentUser.nric && !r.isDeleted);
         renderMyReceiptsContainer();
     }
     showToast("Receipt uploaded successfully!");
     document.getElementById('receiptForm').reset();
     document.getElementById('recRate').value = globalFinanceRates['SGD'];
     document.getElementById('recSgd').value = '0.00';
 } catch(e) {
     showToast(e.message, true);
 } finally {
     setBtnLoading(btn, false);
 }
}

function renderMyReceiptsContainer() {
 const cont = document.getElementById('myReceiptsContainer');
 if(cont) cont.innerHTML = generateMyReceiptsHtml();
}

function generateMyReceiptsHtml() {
 if (myReceipts.length === 0) {
     return `<div class="p-6 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No receipts uploaded yet.</div>`;
 }

 let html = `
 <table class="w-full text-left border-collapse">
     <thead class="bg-gray-100 dark:bg-gray-800 text-[10px] uppercase font-black text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 tracking-wider">
         <tr>
             <th class="p-2">Date</th>
             <th class="p-2">Category</th>
             <th class="p-2 text-right">Amount</th>
             <th class="p-2 text-right">SGD</th>
             <th class="p-2">Remarks</th>
             <th class="p-2 text-center">File</th>
         </tr>
     </thead>
     <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
 `;

 myReceipts.sort((a,b) => b.ts - a.ts).forEach(r => {
     let catName = 'Unknown';
     if (finConfig.finalOptionId) {
         const opt = finOptions.find(o => o.id === finConfig.finalOptionId);
         if (opt) {
             const f = opt.fields.find(field => field.id === r.categoryId);
             if (f) catName = f.name;
         }
     }
     
     const dateStr = new Date(r.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
     
     html += `
     <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
         <td class="p-2 text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">${dateStr}</td>
         <td class="p-2 text-xs font-bold text-primary max-w-[120px] truncate" title="${catName}">${catName}</td>
         <td class="p-2 text-xs font-bold text-gray-800 dark:text-gray-200 text-right whitespace-nowrap">${r.currency} ${r.amount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
         <td class="p-2 text-[11px] font-black text-purple-600 dark:text-purple-400 text-right whitespace-nowrap">SGD ${r.sgdAmount.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
         <td class="p-2 text-[10px] font-medium text-gray-600 dark:text-gray-400 max-w-[100px] truncate" title="${r.remarks}">${r.remarks || '-'}</td>
         <td class="p-2 text-xs text-center">
             ${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" class="text-blue-500 hover:text-blue-700 font-bold underline">View</a>` : '-'}
         </td>
     </tr>
     `;
 });

 html += `</tbody></table>`;
 return html;
}

function enableEditMode(i) { 
 document.getElementById(`profCard_${i}`).classList.add('hidden-force'); 
 document.getElementById(`profEdit_${i}`).classList.remove('hidden-force'); 
}

function cancelEditMode(i) { 
 document.getElementById(`profEdit_${i}`).classList.add('hidden-force'); 
 document.getElementById(`profCard_${i}`).classList.remove('hidden-force'); 
}

async function saveProfileEdit(i, btn) {
 setBtnLoading(btn, true);
 const updated = {
   nric: loadedFamily[i].nric, 
   fullName: document.getElementById(`edName_${i}`).value, 
   shortName: document.getElementById(`edShortName_${i}`).value, 
   email: document.getElementById(`edEmail_${i}`).value, 
   role: document.getElementById(`edRole_${i}`).value, 
   gender: document.getElementById(`edGender_${i}`).value,
   contact: document.getElementById(`edContact_${i}`).value, 
   dob: document.getElementById(`edDob_${i}`).value, 
   group: document.getElementById(`edGroup_${i}`).value, 
   address: document.getElementById(`edAddress_${i}`).value,
   nationality: document.getElementById(`edNat_${i}`).value, 
   passportNo: document.getElementById(`edPass_${i}`).value.toUpperCase(), 
   passportExpiry: document.getElementById(`edExp_${i}`).value, 
   diet: document.getElementById(`edDiet_${i}`).value,
   emergencyName: document.getElementById(`edEmName_${i}`).value, 
   emergencyContact: document.getElementById(`edEmCont_${i}`).value, 
   emergencyRelation: document.getElementById(`edEmRel_${i}`).value, 
   sleeping: document.getElementById(`edSleep_${i}`).value,
   otherPoints: document.getElementById(`edOther_${i}`).value, 
   relatedTrainee: loadedFamily[i].relatedTrainee, 
   relationship: loadedFamily[i].relationship
 };

 try { 
   await apiCall('updateProfile', { member: updated }); 
   showToast("Profile Updated!"); 
   loadProfileData(); 
 } catch (e) { 
   showToast(e.message, true); 
 } finally { 
   setBtnLoading(btn, false); 
 }
}