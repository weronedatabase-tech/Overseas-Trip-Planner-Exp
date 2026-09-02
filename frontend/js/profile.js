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
 const [profRes, finRes, recRes, logRes] = await Promise.all([
        apiCall('getProfile', { nric: currentUser.nric }).catch(e => { console.warn("Failed to load profile:", e); return { family: [] }; }),
        apiCall('fetchFinance').catch(e => { console.warn("Failed to load finance:", e); return { data: { config: {}, options: [] }, rates: { "SGD": 1 } }; }),
        apiCall('fetchReceipts').catch(e => { console.warn("Failed to load receipts:", e); return { receipts: [] }; }),
        apiCall('fetchLogistics').catch(e => { console.warn("Failed to load logistics:", e); return null; })
    ]);

 loadedFamily = profRes.family || [];
 finConfig = finRes.data?.config || {};
 finOptions = finRes.data?.options || [];
 globalFinanceRates = finRes.rates || { "SGD": 1 };
 const familyNrics = loadedFamily.map(f => f.nric);
 if(!familyNrics.includes(currentUser.nric)) familyNrics.push(currentUser.nric);
 myReceipts = (recRes.receipts || []).filter(r => (familyNrics.includes(r.uploaderNric) || familyNrics.includes(r.paidByNric)) && !r.isDeleted);
 globalLogistics = logRes || null;

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
let topBannersHtml = '';

let tripEnd = appSettings.tripEndDate ? new Date(appSettings.tripEndDate) : null;
let minExpiry = null;
if (tripEnd && !isNaN(tripEnd.getTime())) {
   minExpiry = new Date(tripEnd);
   minExpiry.setMonth(minExpiry.getMonth() + 6);
}
let expiringNames = [];
if (minExpiry) {
   loadedFamily.forEach(m => {
       if (m.passportExpiry) {
           const expD = new Date(m.passportExpiry);
           if (!isNaN(expD.getTime()) && expD < minExpiry) {
               expiringNames.push(m.shortName || m.fullName);
           }
       }
   });
}

if (expiringNames.length > 0 && tripEnd) {
   topBannersHtml += `
   <div class="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-400 p-3 rounded-lg shadow-sm">
       <p class="font-bold mb-0.5 text-xs flex items-center gap-1.5"><svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Passport Validity Warning</p>
       <p class="text-xs leading-tight mt-1">The following members have passports expiring within 6 months of the trip end date (<span class="font-bold">${typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(tripEnd) : tripEnd.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}</span>): <span class="font-bold">${expiringNames.join(', ')}</span>. Please renew them immediately.</p>
   </div>`;
}

// 1. Locked Banner
if(!appSettings.allowEdits) {
 let cListHtml = '';
 if(appSettings.committee) {
   appSettings.committee.forEach(c => { 
     if(c.phone) cListHtml += `<a href="https://wa.me/65${c.phone}" target="_blank" class="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold px-2 py-1 rounded shadow-sm text-xs border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">Chat with ${c.name}</a>`; 
   });
 }
 topBannersHtml += `
 <div class="bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/50 text-yellow-800 dark:text-yellow-400 p-3 rounded-lg shadow-sm">
     <p class="font-bold mb-0.5 text-xs">🔒 Editing is currently Locked.</p>
     <p class="text-xs mb-2">To request changes to your details, please contact a Committee Member:</p>
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




 let expiryHighlight = false;
 if (m.passportExpiry && minExpiry) {
   const expD = new Date(m.passportExpiry);
   if (!isNaN(expD.getTime()) && expD < minExpiry) {
     expiryHighlight = true;
   }
 }

 const mRoleColor = m.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (m.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
 let headerLabel = i === 0 ? '<span class="text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">My Profile</span>' : '<span class="text-xs font-black bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 inline-block shadow-sm">Family Member</span>';

 profilesHtml += `
   <div class="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative mb-4" id="profCard_${i}">
     ${headerLabel}
     <div class="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-2 mb-3">
       <div class="flex items-center flex-wrap gap-1.5">
         <span class="font-extrabold text-[13px] md:text-sm px-2 py-0.5 rounded shadow-sm border ${dynColor} leading-tight">${m.fullName}</span> 
         <span class="text-[11px] font-black ${mRoleColor} bg-gray-50 dark:bg-gray-800 px-1 py-[1px] leading-tight rounded-sm border border-gray-200 dark:border-gray-700 uppercase tracking-wide">${m.role}</span>
       </div>
       ${appSettings.allowEdits ? `<button onclick="enableEditMode(${i})" class="text-primary dark:text-green-400 text-xs font-bold hover:bg-green-50 dark:hover:bg-gray-800 px-2 py-1 rounded transition focus:outline-none shrink-0 border border-transparent hover:border-green-200 dark:hover:border-gray-700 shadow-sm">Edit</button>` : ''}
     </div>
     <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-gray-800 dark:text-gray-200">
       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Short Name</p><p class="font-semibold">${m.shortName || '-'}</p></div>
       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">NRIC / FIN</p><p class="font-semibold uppercase">${m.nric}</p></div>
       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Date of Birth</p><p class="font-semibold">${m.dob}</p></div>
       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Gender & Nat.</p><p class="font-semibold">${m.gender} | ${m.nationality}</p></div>
       <div><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Contact & Email</p><div class="font-semibold flex items-center gap-1">${renderPhoneLink(m.contact)} | ${m.email || 'N/A'}</div></div>
       <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-1">Project</p><span class="font-bold text-xs px-1.5 py-0.5 rounded border inline-block shadow-sm ${dynColor}">${m.group || 'None'}</span></div>
       <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Home Address</p><p class="font-semibold">${m.address}</p></div>
       <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Passport No.</p><p class="font-semibold uppercase">${m.passportNo}</p></div>
       <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Passport Expiry</p><p class="${expiryHighlight ? 'font-bold text-red-600 dark:text-red-400' : 'font-semibold'}">${m.passportExpiry || '-'}${expiryHighlight ? ' <span title="Expiring within 6 months of trip" class="text-sm">⚠️</span>' : ''}</p></div>
       <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Emerg. Contact</p><div class="font-semibold flex items-center gap-1">${m.emergencyName} (${m.emergencyRelation}) - <span class="font-mono">${renderPhoneLink(m.emergencyContact)}</span></div></div>
       <div class="border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Dietary Needs</p><p class="font-semibold text-red-600 dark:text-red-400">${m.diet || 'None'}</p></div>
       <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Sleeping Arrangement</p><p class="font-semibold text-green-600 dark:text-green-400">${m.sleeping || 'No special request'}</p></div>
       <div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Other Points to Note</p><p class="font-semibold">${m.otherPoints || 'None'}</p></div>
       ${m.role === 'TRAINEE' ? `<div class="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-2"><p class="font-bold text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-wider mb-0.5">Medical Conditions and Medications to take note of</p><p class="font-semibold">${m.medical || 'None'}</p></div>` : ''}

     </div>
   </div>
   
   <form id="profEdit_${i}" onsubmit="event.preventDefault(); saveProfileEdit(${i}, this.querySelector('button[type=submit]'));" class="hidden-force bg-white dark:bg-gray-900 p-3 md:p-4 rounded-xl border border-primary dark:border-green-500 space-y-3 shadow-[0_4px_15px_-5px_rgba(22,163,74,0.2)]">
     <h4 class="font-black text-sm mb-1 border-b border-gray-100 dark:border-gray-800 pb-1.5 text-gray-900 dark:text-white tracking-tight">Edit Details</h4>
     <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Full Name</label><input type="text" id="edName_${i}" value="${m.fullName}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Short Name</label><input type="text" id="edShortName_${i}" value="${m.shortName || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Email</label><input type="text" id="edEmail_${i}" value="${m.email}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Contact</label><input type="tel" pattern="[0-9]{8}" id="edContact_${i}" value="${m.contact}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Gender</label><select id="edGender_${i}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"><option ${m.gender==='Male'?'selected':''}>Male</option><option ${m.gender==='Female'?'selected':''}>Female</option></select></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Role</label><select id="edRole_${i}" onchange="document.getElementById('edRelated_${i}').closest('.relative').className = this.value === 'CAREGIVER' ? 'block relative' : 'hidden-force relative'; document.getElementById('edRelation_${i}').parentElement.className = this.value === 'CAREGIVER' ? 'block' : 'hidden-force'; document.getElementById('edMedical_${i}').parentElement.className = this.value === 'TRAINEE' ? 'md:col-span-2' : 'hidden-force';" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"><option ${m.role==='TRAINEE'?'selected':''}>TRAINEE</option><option ${m.role==='CAREGIVER'?'selected':''}>CAREGIVER</option><option ${m.role==='VOLUNTEER'?'selected':''}>VOLUNTEER</option></select></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Project</label><select id="edGroup_${i}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${groupOpts}</select></div>
        <div class="md:col-span-2"><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Address</label><textarea id="edAddress_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.address}</textarea></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Nationality</label><input type="text" id="edNat_${i}" value="${m.nationality}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">DOB</label><input type="text" id="edDob_${i}" value="${formatDDMmmYYYY(m.dob)}" readonly onclick="openDatePicker('edDob_${i}', 'dob')" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-center font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Passport No.</label><input type="text" id="edPass_${i}" value="${m.passportNo}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs uppercase font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Passport Expiry</label><input type="text" id="edExp_${i}" value="${m.passportExpiry ? formatDDMmmYYYY(m.passportExpiry) : ''}" readonly onclick="openDatePicker('edExp_${i}', 'exp')" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-center font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Emergency Contact Name</label><input type="text" id="edEmName_${i}" value="${m.emergencyName}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Emergency Contact No.</label><input type="tel" pattern="[0-9]{8}" id="edEmCont_${i}" value="${m.emergencyContact}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Emergency Relation</label><input type="text" id="edEmRel_${i}" value="${m.emergencyRelation}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Dietary Needs</label><input type="text" id="edDiet_${i}" value="${m.diet}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div class="md:col-span-2"><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Sleeping Arrangement Request</label><textarea id="edSleep_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.sleeping}</textarea></div>
        <div class="${m.role === 'TRAINEE' ? 'md:col-span-2' : 'hidden-force'}"><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Medical Conditions and Medications to take note of</label><textarea id="edMedical_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.medical}</textarea></div>
        <div class="${m.role==='CAREGIVER'?'block':'hidden-force'} relative"><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Related Trainees' Name(s)</label><input type="text" id="edRelated_${i}" placeholder="Search trainee..." value="${m.relatedTrainee || ''}" autocomplete="off" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div class="${m.role==='CAREGIVER'?'block':'hidden-force'}"><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Relationship to Trainee(s)</label><input type="text" id="edRelation_${i}" value="${m.relationship || ''}" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"></div>
        <div class="md:col-span-2"><label class="text-xs font-bold mb-0.5 text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Other Points to Note</label><textarea id="edOther_${i}" rows="2" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-sm">${m.otherPoints}</textarea></div>
     </div>
     <div class="flex space-x-2 pt-1 mt-2 border-t border-gray-100 dark:border-gray-800">
       <button type="button" onclick="cancelEditMode(${i})" class="flex-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition focus:outline-none shadow-sm mt-2">Cancel</button>
       <button type="submit" class="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg shadow-sm hover:bg-green-600 transition flex justify-center items-center focus:outline-none mt-2">
          <span class="btn-text">Save Changes</span><div class="btn-spinner spinner-white hidden-force ml-1.5 !w-3 !h-3 border-2"></div>
       </button>
     </div>
   </form>
 `;
});

let receiptsHtml = `
<div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
   <h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">Trip Fees Payment Confirmation</h3>
   <div id="myReceiptsContainer" class="overflow-x-auto">
       ${generateMyReceiptsHtml()}
   </div>
</div>
`;

let paymentHtml = `
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
 ${finConfig.showPaymentSection ? `
 <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full">
   <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">
       <h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
           <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           Trip Fees & Payment
       </h3>
   </div>
   ${generatePaymentPortalHtml()}
 </div>
 <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-full">
   <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2 mb-3">
       <h3 class="text-sm font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
           <svg class="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           Upload Fees Paid Confirmation Screenshot
       </h3>
   </div>
   ${generateReceiptFormHtml()}
 </div>
 ` : ''}
</div>
`;

let personalDetailsHeader = `<div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2 mb-3 mt-4"><h3 class="text-lg font-black text-gray-900 dark:text-white tracking-tight">Personal Details</h3></div>`;

tabProfile.innerHTML = topBannersHtml + personalDetailsHeader + profilesHtml + receiptsHtml + paymentHtml;
}

function generatePaymentPortalHtml() {
if (!finConfig.showPaymentSection) return '';
const targetMembers = loadedFamily;
const hasCaregiver = targetMembers.some(m => m.role === 'CAREGIVER');
let targetNric = loadedFamily[0].pocNric;

const baseFee = finConfig.perPersonFee || 0;
const size = targetMembers.length;
const dev = finConfig.feeDeviations?.[targetNric]?.amount || 0;
const finalExpected = (size * baseFee) + dev;
const isPaid = finConfig.feesReceived?.[targetNric] === true;

const _hash = targetNric.split('').reduce((a,b)=>(((a<<5)-a)+b.charCodeAt(0))|0,0);
const orderNo = targetNric.substring(0, 4).toUpperCase() + "-" + Math.abs(_hash).toString(10).slice(-4).padStart(4, '0');
window._currentOrderRef = orderNo; // Update global state just in case it's used elsewhere

let membersListHtml = targetMembers.map(m => {
   const roleColor = m.role === 'TRAINEE' ? 'text-green-600 dark:text-green-400' : (m.role === 'CAREGIVER' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400');
   return `<span class="inline-block mr-1.5"><span class="${roleColor} font-black text-[11px] mr-0.5 border border-current px-0.5 rounded">${m.role.substring(0,3)}</span><span class="font-bold text-xs text-gray-800 dark:text-gray-200">${m.shortName || m.fullName}</span></span>`;
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

const payNowNum = finConfig.payNowNumber ? "+65" + finConfig.payNowNumber : "";
const qrStr = payNowNum ? generatePayNowStr('0', payNowNum, finalExpected, orderNo) : ""; 
const qrUrl = qrStr ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrStr)}` : "";

return `<div class="flex flex-col gap-3">
   <div class="bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
       <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Total Fee</p>
       <p class="text-2xl font-black text-green-700 dark:text-green-400 leading-none">SGD ${finalExpected.toLocaleString('en-US', {minimumFractionDigits:2})}</p>
       <div class="mt-2 text-left">${membersListHtml}</div>
   </div>
   
   <div class="flex flex-col items-center justify-center p-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
       ${qrUrl ? `<img src="${qrUrl}" alt="PayNow QR Code" class="w-48 h-48 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-2">
       <p class="text-xs font-bold text-gray-800 dark:text-gray-200 text-center">Scan with your banking app to PayNow</p>
       <p class="text-[11px] font-medium text-gray-500 mt-1">Order Ref: <span class="font-mono font-bold">${orderNo}</span></p>` : `<p class="text-xs font-bold text-red-500 p-4 text-center">Admin has not set up PayNow details.</p>`}
   </div>
</div>
`;
}

function generateReceiptFormHtml() {
return `<form id="uploadReceiptForm" onsubmit="submitReceipt(event)" class="flex flex-col gap-4 flex-1">
   <div id="recError" class="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 p-2 rounded-lg text-xs mb-2 font-bold hidden-force"></div>
   <div id="recSuccess" class="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 p-2 rounded-lg text-xs mb-2 font-bold hidden-force"></div>
   
   <div>
       <label class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Screenshot File (Max 4MB)</label>
       <input type="file" id="recFile" required accept="image/*,.pdf" class="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600">
       <p class="text-[10px] text-gray-400 mt-1 italic">Note: Re-uploading will automatically overwrite any previously submitted screenshot.</p>
   </div>
   <div>
       <label class="block text-xs font-bold mb-1 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks (Optional)</label>
       <input type="text" id="recRemarks" class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary shadow-sm" placeholder="Any details...">
   </div>
   <div class="mt-auto pt-2">
       <button type="submit" class="w-full bg-purple-600 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm hover:bg-purple-700 transition flex justify-center items-center focus:outline-none">
          <span class="btn-text">Upload Confirmation</span><div class="btn-spinner spinner-white hidden-force ml-2 !w-3 !h-3 border-2"></div>
       </button>
   </div>
</form>`;
}

async function submitReceipt(e, suffix = "") {
   e.preventDefault();
   const btn = e.target.querySelector('button[type="submit"]');
   const err = document.getElementById('recError' + suffix);
   const succ = document.getElementById('recSuccess' + suffix);
   err.classList.add('hidden-force');
   succ.classList.add('hidden-force');

   const remarks = document.getElementById('recRemarks' + suffix).value.trim();
   const fileInput = document.getElementById('recFile' + suffix);
   
   if(!fileInput.files.length) { err.textContent = "Please select a file."; return err.classList.remove('hidden-force'); }
   const file = fileInput.files[0];
   if (file.size > 4 * 1024 * 1024) { err.textContent = "File exceeds 4MB limit."; return err.classList.remove('hidden-force'); }

   setBtnLoading(btn, true);
   try {
       const base64 = await toBase64(file);
       
       let targetNric = loadedFamily[0].pocNric;
              const size = loadedFamily.length;
       const baseFee = finConfig.perPersonFee || 0;
       const dev = finConfig.feeDeviations?.[targetNric]?.amount || 0;
       const finalExpected = (size * baseFee) + dev;

       const recNricInput = document.getElementById('recNric');
       const recNameInput = document.getElementById('recName');
       const recCatInput = document.getElementById('recCategory');
       
       const finalUploaderNric = recNricInput ? recNricInput.value.trim() : currentUser.nric;
       const finalUploaderName = recNameInput ? recNameInput.value.trim() : '';
       
       const familyMember = loadedFamily.find(m => m.nric === finalUploaderNric);
       let shortName = finalUploaderName;
       if (!shortName) {
           shortName = familyMember?.shortName || familyMember?.fullName || currentUser.name || finalUploaderNric;
       }

       const ext = file.name.split('.').pop() || 'png';
       const _targetForHash = (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) ? loadedFamily[0].pocNric : finalUploaderNric;
       const _upHash = _targetForHash.split('').reduce((a,b)=>(((a<<5)-a)+b.charCodeAt(0))|0,0);
       const orderRefToUse = window._currentOrderRef || (_targetForHash.substring(0, 4).toUpperCase() + '-' + Math.abs(_upHash).toString(10).slice(-4).padStart(4, '0'));
       const finalFileName = `${shortName}_${orderRefToUse}.${ext}`;

       const payload = {
           uploaderNric: finalUploaderNric,
           uploaderName: finalUploaderName,
           categoryId: recCatInput ? recCatInput.value : "Fees Payment Screenshot",
           currency: document.getElementById('recCurrency') ? document.getElementById('recCurrency').value : 'SGD',
           amount: document.getElementById('recAmount') ? parseFloat(document.getElementById('recAmount').value) : finalExpected,
           rate: document.getElementById('recRate') ? parseFloat(document.getElementById('recRate').value) : 1,
           sgdAmount: document.getElementById('recSgd') ? parseFloat(document.getElementById('recSgd').value) : finalExpected,
           // categoryId is already set above
           paidByNric: recNricInput ? recNricInput.value.trim() : currentUser.nric,
           familyNrics: loadedFamily.map(f => f.nric),
           remarks: remarks,
           fileName: finalFileName,
           mimeType: file.type,
           fileData: base64.split(',')[1]
       };

   const res = await apiCall('uploadReceipt', { payload: payload });
   if (res.receipts) {
       const familyNrics = loadedFamily.map(f => f.nric);
       if(!familyNrics.includes(currentUser.nric)) familyNrics.push(currentUser.nric);
       myReceipts = res.receipts.filter(r => (familyNrics.includes(r.uploaderNric) || familyNrics.includes(r.paidByNric)) && !r.isDeleted);
       renderMyReceiptsContainer();
   }
   showToast("Receipt uploaded successfully!");
   const frm = document.getElementById('uploadReceiptForm' + suffix); if(frm) frm.reset();
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
const feeReceipts = myReceipts.filter(r => !r.isDeleted && r.categoryId === "Fees Payment Screenshot").sort((a, b) => b.ts - a.ts);

if (feeReceipts.length === 0) {
   return `<div class="p-6 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Trip Fees Payment Confirmation Screenshot NOT Uploaded</div>`;
}

const feeReceipt = feeReceipts[0];
const timeStr = new Date(feeReceipt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const dateStr = (typeof formatDDMmmYYYY === 'function' ? formatDDMmmYYYY(feeReceipt.ts) : '') + ' ' + timeStr;

return `
   <div class="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
       <svg class="w-12 h-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>
       <h4 class="text-lg font-black text-gray-900 dark:text-white mb-1">Screenshot Uploaded</h4>
       <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Uploaded on ${dateStr}</p>
       ${feeReceipt.fileUrl ? 
           `<div class="mt-4 w-full max-w-lg mx-auto aspect-[3/4] relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-gray-100 dark:bg-gray-900">
               <iframe src="${feeReceipt.fileUrl.replace(/\/view.*/, '/preview')}" class="absolute top-0 left-0 w-full h-full border-0"></iframe>
           </div>`
           : `<span class="text-xs font-bold text-red-500">Link unavailable</span>`
       }
       <button onclick="document.getElementById('reuploadFormContainer').classList.toggle('hidden-force')" class="mt-6 text-xs text-primary font-bold hover:underline flex items-center gap-1">
           <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
           Incorrect file? Re-upload screenshot
       </button>
       <div id="reuploadFormContainer" class="hidden-force mt-4 w-full max-w-lg mx-auto bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-left">
           ${generateReceiptFormHtml('_re')}
       </div>
   </div>
`;
}

function enableEditMode(i) {
  document.getElementById(`profCard_${i}`).classList.add('hidden-force');
  document.getElementById(`profEdit_${i}`).classList.remove('hidden-force');
  if (typeof setupNationalityDropdown === 'function') setupNationalityDropdown(`edNat_${i}`);
}

function cancelEditMode(i) { 
document.getElementById(`profEdit_${i}`).classList.add('hidden-force'); 
document.getElementById(`profCard_${i}`).classList.remove('hidden-force'); 
}

async function saveProfileEdit(i, btn) {
setBtnLoading(btn, true);
const roleVal = document.getElementById(`edRole_${i}`).value;
const relatedVal = document.getElementById(`edRelated_${i}`) ? document.getElementById(`edRelated_${i}`).value.trim() : loadedFamily[i].relatedTrainee;

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
 medical: document.getElementById(`edMedical_${i}`).value,
 relatedTrainee: document.getElementById(`edRelated_${i}`) ? document.getElementById(`edRelated_${i}`).value : loadedFamily[i].relatedTrainee, 
 relationship: document.getElementById(`edRelation_${i}`) ? document.getElementById(`edRelation_${i}`).value : loadedFamily[i].relationship
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

window.handleProfileRelatedSearch = function(idx, fullQuery) {
    const dd = document.getElementById('edRelatedDropdown_' + idx);
    if(!dd) return;
    
    const parts = (fullQuery || '').split('|');
    const query = parts[parts.length - 1].trim().toLowerCase();
    
    let allP = [];
    if (typeof loadedFamily !== 'undefined' && loadedFamily.length > 0) {
        allP = loadedFamily; // Only family members in profile
    }
    
    const trainees = allP.filter(p => p.role === 'TRAINEE');
    const results = trainees.filter(t => (t.fullName || '').toLowerCase().includes(query) || (t.shortName || '').toLowerCase().includes(query));
    
    if(results.length === 0) {
        dd.innerHTML = '<div class="p-2 text-xs text-gray-500 text-center">No family trainees found.</div>';
    } else {
        dd.innerHTML = results.map(t => {
            const escName = (t.fullName || '').replace(/'/g, "\\'");
            return '<div class="p-2 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onclick="selectProfileRelatedTrainee(' + idx + ', \'' + escName + '\')"><div class="font-bold text-xs text-gray-800 dark:text-gray-200">' + t.fullName + '</div><div class="text-xs text-gray-500">' + (t.shortName || '-') + '</div></div>';
        }).join('');
    }
    dd.classList.remove('hidden-force');
};

window.selectProfileRelatedTrainee = function(idx, name) {
    const inp = document.getElementById('edRelated_' + idx);
    if(inp) {
        let parts = inp.value.split('|');
        parts.pop();
        parts.push(name);
        inp.value = parts.join(' | ') + ' | ';
    }
    const dd = document.getElementById('edRelatedDropdown_' + idx);
    if(dd) dd.classList.add('hidden-force');
    setTimeout(() => { if(inp) inp.focus(); }, 10);
};

document.addEventListener('click', function(e) {
    if(e.target.closest('[id^="edRelated_"]')) return;
    if(e.target.closest('[id^="edRelatedDropdown_"]')) return;
    const dds = document.querySelectorAll('[id^="edRelatedDropdown_"]');
    dds.forEach(dd => dd.classList.add('hidden-force'));
});
