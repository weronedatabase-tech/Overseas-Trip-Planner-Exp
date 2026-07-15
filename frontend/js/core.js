// ==========================================
// core.js - Centralized MPA App Engine
// ==========================================
// [CONSIDERATION - CONCURRENCY & ISOLATION]: This file is loaded on every HTML page.
// It acts as the backbone for the MPA architecture, handling shared state, Hydration,
// Optimistic UI tracking, and the standardized layout wrapper.

window.AppCore = {
    // Shared State
    currentUser: null,
    appSettings: null,
    
    // [CONSIDERATION - OPTIMISTIC UI]: Globally track mutations to reject stale background polling.
    lastLocalChange: 0,
    
    // Core Initialization
    init: async function() {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
        this.applyTheme();
        this.loadSession();
        this.renderEnvironmentBanner();
        
        // Protect pages that require auth
        const path = window.location.pathname;
        const publicPages = ['/', '/index.html', 'index.html'];
        const isPublic = publicPages.some(p => path.endsWith(p));
        
        if (!this.currentUser && !isPublic) {
            window.location.href = './index.html';
            return;
        }
    },

    loadSession: function() {
        const saved = localStorage.getItem('userSession');
        if (saved) this.currentUser = JSON.parse(saved);
        
        // [CONSIDERATION - HYDRATION]: Hydrate settings instantly from cache for 0ms TTFB
        const cachedSettings = localStorage.getItem('appSettings');
        if (cachedSettings) this.appSettings = JSON.parse(cachedSettings);
    },

    // ==========================================
    // Delta API Fetcher & Concurrency Safety
    // ==========================================
    apiFetch: async function(action, payload = {}, isBackgroundPoll = false) {
        const fetchStartTime = Date.now();
        
        try {
            const res = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action, ...payload }), 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            
            if(!res.ok) throw new Error("Network error."); 
            const data = await res.json();
            if(data.status === 'error') throw new Error(data.message); 
            
            // [CONSIDERATION - OPTIMISTIC UI]: Stale Payload Rejection
            // If user mutated data locally while this request was in flight, discard this result.
            if (isBackgroundPoll && this.lastLocalChange > fetchStartTime) {
                console.warn(`[AppCore] Stale payload rejected for ${action}`);
                return null; 
            }
            
            return data;
        } catch (err) {
            if(err.message.includes('Failed to fetch') && !isBackgroundPoll) { 
                this.showToast("Auth required.", true); 
                setTimeout(() => window.open(API_URL, '_blank'), 2000); 
            }
            throw err;
        }
    },

    trackMutation: function() {
        this.lastLocalChange = Date.now();
    },

    // ==========================================
    // Standardized UI Generators (MPA Wrapper)
    // ==========================================
    renderEnvironmentBanner: function() {
        let banner = document.getElementById('devModeBar');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'devModeBar';
            document.body.insertBefore(banner, document.body.firstChild);
        }
        
        if (ENV === 'Dev') {
            banner.textContent = 'Development Environment';
            banner.className = 'w-full bg-red-600 text-white text-center py-1 text-[10px] font-bold tracking-widest uppercase shrink-0 z-[100]';
        } else if (ENV === 'Exp') {
            banner.textContent = 'Experimentation Environment';
            banner.className = 'w-full bg-purple-600 text-white text-center py-1 text-[10px] font-bold tracking-widest uppercase shrink-0 z-[100]';
        } else {
            banner.classList.add('hidden-force');
        }
    },

    renderHeader: function(pageTitle, backUrl = './dashboard.html') {
        const headerHtml = `
        <header class="sticky top-0 z-50 shadow-sm bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between transition-colors w-full">
            <div class="flex items-center min-w-0 flex-1">
                ${backUrl ? `<a href="${backUrl}" class="mr-3 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg></a>` : ''}
                <div class="flex flex-col min-w-0">
                    <h1 class="font-black text-lg md:text-xl text-gray-900 dark:text-white leading-tight truncate tracking-tight">${pageTitle}</h1>
                    <span id="headerSubtitle" class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate"></span>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-2">
                <button onclick="AppCore.hardRefresh()" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none" title="Refresh Cache">
                    <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
                <button onclick="AppCore.toggleTheme()" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none" title="Toggle Theme">🌗</button>
                <a href="./dashboard.html" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none" title="Home">
                    <svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                </a>
            </div>
        </header>
        `;
        
        const container = document.getElementById('app-header');
        if (container) {
            container.innerHTML = headerHtml;
            if(this.appSettings?.tripTitle) {
                const sub = document.getElementById('headerSubtitle');
                if(sub) sub.textContent = `${this.appSettings.tripTitle} ${this.appSettings.tripYear}`;
            }
        }
    },

    // ==========================================
    // Utils & UX
    // ==========================================
    showToast: function(msg, isError = false) {
        let t = document.getElementById('global-toast');
        if(!t) {
            t = document.createElement('div');
            t.id = 'global-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.className = `fixed top-14 left-1/2 transform -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl z-[100] transition-opacity duration-300 text-sm font-bold border ${isError ? 'bg-red-600 text-white border-red-700' : 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-200'}`;
        
        t.style.opacity = '1';
        setTimeout(() => t.style.opacity = '0', 3000);
    },

    applyTheme: function() {
        if(localStorage.getItem('theme') === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },

    toggleTheme: function() {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    },

    hardRefresh: async function() {
        this.showToast("Clearing caches...");
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for(let r of regs) await r.unregister();
        }
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('v', Date.now());
            window.location.replace(url.toString());
        }, 800);
    },

    logout: function() {
        localStorage.removeItem('userSession');
        window.location.href = './index.html';
    }
};

// Bootstrap core on load
document.addEventListener('DOMContentLoaded', () => AppCore.init());