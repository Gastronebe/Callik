// utils/formatters.js - Formátování a parsování hodnot

/**
 * Přidá úvodní nulu k číslu (např. 5 -> "05")
 */
export function pad2(n) {
  return n.toString().padStart(2, "0");
}

/**
 * Převede minuty od půlnoci na časový řetězec (např. 510 -> "08:30")
 */
export function minutesToTimeString(totalMinutesFromMidnight) {
  const h = Math.floor(totalMinutesFromMidnight / 60);
  const m = totalMinutesFromMidnight % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Převede časový řetězec na minuty od půlnoci (např. "08:30" -> 510)
 */
export function timeStringToMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Vrátí délku bloku v minutách
 */
export function getDurationMinutes(block) {
  const startMins = timeStringToMinutes(block.start);
  const endMins = timeStringToMinutes(block.end);
  return Math.max(endMins - startMins, 0);
}

/**
 * Seřadí bloky podle času začátku
 */
export function sortBlocksByStart(blocks) {
  if (!blocks || !Array.isArray(blocks)) return [];
  return blocks.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
}

/**
 * Parsuje české číslo s čárkou (např. "12,5" -> 12.5)
 */
export function parseCzNumber(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  return parseFloat(s.replace(/\s/g, '').replace(',', '.'));
}

/**
 * Formátuje sekundy na MM:SS (např. 125 -> "02:05")
 */
export function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

/**
 * Formátuje dnešní datum jako YYYY-MM-DD
 */
export function getTodayDateString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = pad2(today.getMonth() + 1);
  const dd = pad2(today.getDate());
  return `${yyyy}-${mm}-${dd}`;
}
