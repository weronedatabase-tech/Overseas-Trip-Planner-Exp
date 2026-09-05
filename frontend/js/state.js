// Global Application State Variables
let currentUser = null;
let appSettings = { 
 registrationOpen: false, 
 allowEdits: false, 
 committee: [], 
 projectGroups: [], 
 projectColors: {}, 
 activeProjects: [], 
 junctures: [], 
 sortingRules: [], 
 tripTitle: '', 
 tripYear: '' 
};
let globalLogistics = null;

// Optimistic UI & Sync Safety 
let lastLocalChange = 0;

// Idle-Time Hydration State
let isHydrated = false;