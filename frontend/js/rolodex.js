let currentPickerTarget = null; 
const monthsArr =['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function openDatePicker(targetId, type) {
 currentPickerTarget = targetId; document.getElementById('datePickerSheet').classList.remove('hidden-force');
 const colD = document.getElementById('colDay'); const colM = document.getElementById('colMonth'); const colY = document.getElementById('colYear');
 const spacer = '<div style="height: 80px;"></div>'; let dHtml = spacer; for(let i=1; i<=31; i++) { let val = String(i).padStart(2,'0'); dHtml += `<div class="picker-item text-gray-400" data-val="${val}" onclick="scrollToIndex('colDay', ${i-1})">${val}</div>`; } dHtml += spacer;
 let mHtml = spacer; monthsArr.forEach((m, i) => { mHtml += `<div class="picker-item text-gray-400" data-val="${m}" onclick="scrollToIndex('colMonth', ${i})">${m}</div>`; }); mHtml += spacer;
 let yHtml = spacer; const curYear = new Date().getFullYear(); let startYear, endYear, step;
 if(type === 'dob') { startYear = curYear; endYear = 1920; step = -1; } else { startYear = curYear; endYear = curYear + 20; step = 1; }
 let idx = 0; for(let i = startYear; type === 'dob' ? i >= endYear : i <= endYear; i += step) { yHtml += `<div class="picker-item text-gray-400" data-val="${i}" onclick="scrollToIndex('colYear', ${idx})">${i}</div>`; idx++; } yHtml += spacer;
 colD.innerHTML = dHtml; colM.innerHTML = mHtml; colY.innerHTML = yHtml;
 colD.onscroll = () => highlightCenterItem('colDay'); colM.onscroll = () => highlightCenterItem('colMonth'); colY.onscroll = () => highlightCenterItem('colYear');
 const curVal = document.getElementById(targetId).value;
 setTimeout(() => {
   if(curVal) { const parts = curVal.split(' '); if(parts.length === 3) {
       const dIdx = Array.from(colD.querySelectorAll('.picker-item')).findIndex(el => el.dataset.val === parts[0]); const mIdx = Array.from(colM.querySelectorAll('.picker-item')).findIndex(el => el.dataset.val === parts[1]); const yIdx = Array.from(colY.querySelectorAll('.picker-item')).findIndex(el => el.dataset.val === parts[2]);
       if(dIdx > -1) colD.scrollTop = dIdx * 40; if(mIdx > -1) colM.scrollTop = mIdx * 40; if(yIdx > -1) colY.scrollTop = yIdx * 40;
     } } else { colD.scrollTop = 0; colM.scrollTop = 0; colY.scrollTop = 0; }
   highlightCenterItem('colMonth'); highlightCenterItem('colYear'); highlightCenterItem('colDay');
 }, 10);
}

function scrollToIndex(colId, index) { document.getElementById(colId).scrollTo({ top: index * 40, behavior: 'smooth' }); }

function highlightCenterItem(colId) {
 const col = document.getElementById(colId); const visibleItems = Array.from(col.querySelectorAll('.picker-item')).filter(i => !i.classList.contains('hidden-force'));
 if(!visibleItems.length) return; let index = Math.round(col.scrollTop / 40); if (index >= visibleItems.length) index = visibleItems.length - 1; 
 visibleItems.forEach((item, i) => {
   if(i === index) { item.classList.remove('text-gray-400'); item.classList.add('text-primary', 'font-extrabold', 'text-3xl'); item.dataset.selected = "true"; } 
   else { item.classList.add('text-gray-400'); item.classList.remove('text-primary', 'font-extrabold', 'text-3xl'); item.dataset.selected = "false"; }
 });
 if(colId === 'colMonth' || colId === 'colYear') updateValidDays();
}

function updateValidDays() {
 const mItem = document.querySelector('#colMonth .picker-item[data-selected="true"]'); const yItem = document.querySelector('#colYear .picker-item[data-selected="true"]'); if(!mItem || !yItem) return;
 const maxDays = new Date(parseInt(yItem.dataset.val), monthsArr.indexOf(mItem.dataset.val) + 1, 0).getDate(); const colD = document.getElementById('colDay');
 colD.querySelectorAll('.picker-item').forEach((item) => {
   const shouldHide = parseInt(item.dataset.val) > maxDays;
   if(shouldHide && !item.classList.contains('hidden-force')) item.classList.add('hidden-force'); if(!shouldHide && item.classList.contains('hidden-force')) item.classList.remove('hidden-force');
 });
 if (colD.scrollTop > (maxDays - 1) * 40) scrollToIndex('colDay', maxDays - 1);
}

function confirmPicker() {
 const d = document.querySelector('#colDay .picker-item[data-selected="true"]'); const m = document.querySelector('#colMonth .picker-item[data-selected="true"]'); const y = document.querySelector('#colYear .picker-item[data-selected="true"]');
 if(d && m && y && currentPickerTarget) document.getElementById(currentPickerTarget).value = `${d.dataset.val} ${m.dataset.val} ${y.dataset.val}`; closePicker();
}

function closePicker() { document.getElementById('datePickerSheet').classList.add('hidden-force'); }