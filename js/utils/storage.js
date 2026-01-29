// utils/storage.js - LocalStorage helper funkce

import { SETTINGS_KEY } from '../core/constants.js';

/**
 * Načte JSON z localStorage s fallbackem na výchozí hodnotu
 */
export function loadJSON(key, defaultValue) {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

/**
 * Uloží hodnotu jako JSON do localStorage
 */
export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Načte nastavení aplikace
 */
export function loadSettings() {
  return loadJSON(SETTINGS_KEY, { cumulativeMode: false });
}

/**
 * Uloží nastavení aplikace
 */
export function saveSettings(settings) {
  saveJSON(SETTINGS_KEY, settings);
}
