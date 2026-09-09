const fs = require('fs');
let code = fs.readFileSync('frontend/js/ui.js', 'utf8');

// 1. Replace "British" with the 6 types in ALL_NATIONALITIES
// The original list had "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian"
code = code.replace(
    /"Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian"/,
    '"Bosnian", "Brazilian", "British Citizen", "British Overseas Territories Citizen (BOTC)", "British Overseas Citizen (BOC)", "British Subject", "British National (Overseas) (BNO)", "British Protected Person (BPP)", "Bruneian", "Bulgarian"'
);

// 2. Add "Others" to the END of NATIONALITIES_LIST
code = code.replace(
    /window\.NATIONALITIES_LIST = \[\.\.\.TOP_NATIONALITIES, \.\.\.OTHER_NATIONALITIES\];/,
    "window.NATIONALITIES_LIST = [...TOP_NATIONALITIES, ...OTHER_NATIONALITIES, 'Others'];"
);

// 3. Rewrite setupNationalityDropdown
const setupRegex = /window\.setupNationalityDropdown = function\(inputId\) \{[\s\S]*?\}\s*\}\);\s*\};/m;
const newSetup = `window.setupNationalityDropdown = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.natInit) return;
    input.dataset.natInit = "true";

    // Hide original input
    input.classList.add('hidden-force');
    
    // Create UI container
    const wrapper = document.createElement('div');
    wrapper.className = 'relative w-full';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const displayBtn = document.createElement('button');
    displayBtn.type = 'button';
    displayBtn.className = 'w-full p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary flex justify-between items-center text-left min-h-[42px] transition';
    
    const displaySpan = document.createElement('span');
    displaySpan.className = 'truncate text-sm ' + (input.value ? 'font-semibold' : 'text-gray-400');
    displaySpan.textContent = input.value || 'Select Nationality';
    
    const chevron = document.createElement('div');
    chevron.innerHTML = '<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
    
    displayBtn.appendChild(displaySpan);
    displayBtn.appendChild(chevron);
    wrapper.appendChild(displayBtn);

    // Manual input container (for "Others")
    const manualCont = document.createElement('div');
    manualCont.className = 'hidden-force flex items-center w-full relative';
    const manualInput = document.createElement('input');
    manualInput.type = 'text';
    manualInput.placeholder = 'Please specify...';
    manualInput.className = 'w-full p-2.5 pr-10 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm font-semibold';
    
    const manualClearBtn = document.createElement('button');
    manualClearBtn.type = 'button';
    manualClearBtn.className = 'absolute right-2 p-1 text-gray-400 hover:text-red-500 focus:outline-none';
    manualClearBtn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
    manualCont.appendChild(manualInput);
    manualCont.appendChild(manualClearBtn);
    wrapper.appendChild(manualCont);

    const dropdown = document.createElement('div');
    dropdown.className = 'absolute z-[100] w-full mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl hidden-force flex flex-col max-h-64 overflow-hidden';
    
    const searchHeader = document.createElement('div');
    searchHeader.className = 'p-2 border-b-2 border-gray-100 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.className = 'flex-1 p-1.5 text-sm border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary';
    
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.title = "Clear Field";
    clearBtn.className = 'p-1.5 text-gray-400 hover:text-red-500 transition focus:outline-none';
    clearBtn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
    searchHeader.appendChild(searchInput);
    searchHeader.appendChild(clearBtn);
    dropdown.appendChild(searchHeader);

    const listCont = document.createElement('div');
    listCont.className = 'overflow-y-auto custom-scrollbar flex-1';
    dropdown.appendChild(listCont);
    wrapper.appendChild(dropdown);

    const setManualMode = (isActive) => {
        if (isActive) {
            displayBtn.classList.add('hidden-force');
            manualCont.classList.remove('hidden-force');
            manualInput.value = (input.value && input.value !== 'Others') ? input.value : '';
            setTimeout(() => manualInput.focus(), 50);
        } else {
            displayBtn.classList.remove('hidden-force');
            manualCont.classList.add('hidden-force');
        }
    };

    // Initialize mode based on initial value
    if (input.value && !window.NATIONALITIES_LIST.includes(input.value) && input.value !== 'Others') {
        setManualMode(true);
    }

    manualInput.addEventListener('input', (e) => {
        input.value = e.target.value;
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.dispatchEvent(new Event('change', {bubbles:true}));
    });

    manualClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.dispatchEvent(new Event('change', {bubbles:true}));
        displaySpan.textContent = 'Select Nationality';
        displaySpan.className = 'truncate text-sm text-gray-400';
        setManualMode(false);
    });

    const renderList = (query) => {
        const q = (query || '').toLowerCase();
        let html = '';
        const filtered = window.NATIONALITIES_LIST.filter(n => n.toLowerCase().includes(q));
        
        if (filtered.length === 0) {
            html = '<div class="p-3 text-xs text-center text-gray-500">No results found</div>';
        } else {
            html = filtered.map(n => {
                const isTop = TOP_NATIONALITIES.includes(n);
                let styling = isTop ? 'font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/30' : 'font-medium text-gray-700 dark:text-gray-300';
                if (n === 'Others') styling = 'font-bold text-primary italic bg-green-50/50 dark:bg-green-900/20 border-t border-gray-100 dark:border-gray-700';
                return \`<div class="p-2.5 border-b-2 border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm \${styling} nat-opt" data-val="\${n}">\${n}</div>\`;
            }).join('');
        }
        listCont.innerHTML = html;
        
        Array.from(listCont.getElementsByClassName('nat-opt')).forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.dataset.val;
                
                if (val === 'Others') {
                    dropdown.classList.add('hidden-force');
                    setManualMode(true);
                    return;
                }
                
                input.value = val;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                input.dispatchEvent(new Event('change', {bubbles:true}));
                displaySpan.textContent = val;
                displaySpan.className = 'truncate text-sm font-semibold';
                dropdown.classList.add('hidden-force');
                setManualMode(false);
            });
        });
    };

    displayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden-force');
        document.querySelectorAll('.nat-dropdown-open').forEach(d => {
            if(d !== dropdown) d.classList.add('hidden-force');
        });
        if (isHidden) {
            dropdown.classList.remove('hidden-force');
            dropdown.classList.add('nat-dropdown-open');
            searchInput.value = '';
            renderList('');
            setTimeout(() => searchInput.focus(), 50);
        } else {
            dropdown.classList.add('hidden-force');
            dropdown.classList.remove('nat-dropdown-open');
        }
    });

    searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        input.dispatchEvent(new Event('input', {bubbles:true}));
        input.dispatchEvent(new Event('change', {bubbles:true}));
        displaySpan.textContent = 'Select Nationality';
        displaySpan.className = 'truncate text-sm text-gray-400';
        dropdown.classList.add('hidden-force');
        dropdown.classList.remove('nat-dropdown-open');
        setManualMode(false);
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.add('hidden-force');
            dropdown.classList.remove('nat-dropdown-open');
        }
    });
};`;

if (code.match(setupRegex)) {
    code = code.replace(setupRegex, newSetup);
    fs.writeFileSync('frontend/js/ui.js', code);
    console.log("Patched setupNationalityDropdown");
} else {
    console.log("Could not find setupNationalityDropdown");
}
