// config.js - Konfigurace aplikace Callík

export const CONFIG = {
    // Aplikace
    APP_NAME: 'Callík',
    APP_URL: 'https://www.callik.fun',
    APP_VERSION: '2.0.0',
    
    // Provozovatel
    OPERATOR_NAME: 'Pavlína Šteiglová',
    OPERATOR_EMAIL: 'info@callik.fun',
    
    // Supabase (nastavit při deployi - zatím prázdné)
    SUPABASE_URL: 'https://ntveqmrguyvdwshsiapi.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50dmVxbXJndXl2ZHdzaHNpYXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTgwMzksImV4cCI6MjA4NDAzNDAzOX0.rugXSeAEIrRBeX90idaw3PCWZvqhf9ez9HUglR1_Wa0',
    
    // Pracovní doba
    WORKDAY_START_HOUR: 8,
    WORKDAY_END_HOUR: 20,
    
    // Bloky
    DEFAULT_WORK_BLOCK_MINUTES: 30,
    DEFAULT_BREAK_BLOCK_MINUTES: 15,
    
    // Avatary
    AVATAR_COUNT: 30,
    AVATAR_PATH: '/assets/avatars/',
    
    // Přezdívky
    NICKNAME_PREFIXES: ['lo', 'me', 'fr', 'wo', 'po', 'bo', 'be', 'to', 'le', 'ar', 'zu', 'ki', 'da', 'va', 'na', 'ra', 'si', 'ti', 'mo', 'ko'],
    
    // Důvody pauz
    BREAK_REASONS: ['Oběd', 'WC', 'Čaj/Káva', 'Technické problémy', 'Porady', 'Jiné...'],
    
    // Notifikace
    NOTIFICATION_SECONDS_BEFORE_END: 30,
    
    // Focus ring
    RING_RADIUS: 92,
    
    // localStorage klíče (pro migraci)
    STORAGE_KEYS: {
      DAYS: 'cc-tracker-days',
      PROJECTS: 'cc-tracker-projects',
      SETTINGS: 'cc-tracker-settings'
    },
    
    // Feature flags
    FEATURES: {
      LEADERBOARD: false,
      TEAM_STATS: false,
      ADMIN_DASHBOARD: false,
      PWA: false,
      OFFLINE_MODE: false
    }
  };
  