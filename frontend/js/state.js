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

// Idle-Time Hydration State
let isHydrated = false;