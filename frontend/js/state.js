// Global Application State Variables
let currentSheetList = [];
let selectedVolType = null;
let allNames = [];
let allProjects = []; 
let currentVolTypeRequest = null;
let isAdminAuthenticated = false;
let pendingView = "";
let pendingAction = null;
let currentActiveView = 'landing';
let outingReminders = {};

// Idle-Time Hydration State
let isHydrated = false;
let hydratedEventUrl = null;

// Setting defaults
const DEF_SHARE_FORMAT = "{{Groups}} | {{Meetings}} | {{Dismissals}} | Total: {{Count}}\n\n{{List}}";
let appSettings = null;