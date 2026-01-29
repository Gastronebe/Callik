// services/days.js - Správa dnů

import { dbUpsertDay, dbGetDay } from '../db.js';

// Cache pro aktuální den
let cachedCurrentDay = null;
let currentDateStr = "";

/**
 * Nastaví aktuální datum
 */
export function setCurrentDate(dateStr) {
  currentDateStr = dateStr;
  // Invaliduj cache pokud se změnilo datum
  if (cachedCurrentDay && cachedCurrentDay.date !== dateStr) {
    cachedCurrentDay = null;
  }
}

/**
 * Vrátí aktuální datum
 */
export function getCurrentDate() {
  return currentDateStr;
}

/**
 * Vrátí nebo vytvoří den pro aktuální datum
 */
export async function getOrCreateCurrentDay() {
  if (cachedCurrentDay && cachedCurrentDay.date === currentDateStr) {
    return cachedCurrentDay;
  }
  let day = await dbGetDay(currentDateStr);
  if (!day) {
    const newDay = {
      date: currentDateStr,
      goals: { minutes: 0, pay: 0, calls: 0 }
    };
    await dbUpsertDay(newDay);
    day = await dbGetDay(currentDateStr);
  }
  cachedCurrentDay = day;
  return day;
}

/**
 * Uloží den do DB
 */
export async function saveDay(day) {
  try {
    await dbUpsertDay(day);
    cachedCurrentDay = day;
  } catch (e) {
    console.warn('DB upsert day error', e);
    throw e;
  }
}

/**
 * Invaliduje cache pro aktuální den
 */
export function invalidateDayCache() {
  cachedCurrentDay = null;
}
