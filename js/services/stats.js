// services/stats.js - Výpočty statistik

import { getDurationMinutes } from '../utils/formatters.js';
import { dbGetAllDays, dbLoadBlocksForDay } from '../db.js';
import { getOrCreateCurrentDay, getCurrentDate } from './days.js';

/**
 * Spočítá denní součty z bloků
 */
export function computeDaySums(blocks) {
  let minutes = 0, pay = 0, calls = 0, leads = 0, cleanWorkMinutes = 0;

  blocks.forEach(b => {
    if (b.type !== "work") return;
    cleanWorkMinutes += getDurationMinutes(b);
    minutes += (b.talk_minutes || 0);
    pay += (b.pay || 0);
    calls += (b.calls || 0);
    if (b.leads != null) leads += b.leads;
  });

  let kpiPercent = null;
  if (calls > 0) kpiPercent = Math.round((leads / calls) * 100);

  let talkVsWorkPercent = null;
  if (cleanWorkMinutes > 0) talkVsWorkPercent = Math.round((minutes / cleanWorkMinutes) * 100);

  return { minutes, pay, calls, leads, kpiPercent, cleanWorkMinutes, talkVsWorkPercent };
}

/**
 * Aktualizuje progress bary
 */
export function updateProgressBars(elements, day, sums) {
  const {
    progressMinutesBar, progressMinutesText,
    progressPayBar, progressPayText,
    progressCallsBar, progressCallsText
  } = elements;

  // Minuty
  const minutesGoal = day.goals.minutes || 0;
  let minutesPct = minutesGoal ? (sums.minutes / minutesGoal) * 100 : 0;
  minutesPct = Math.min(minutesPct, 100);
  progressMinutesBar.style.width = minutesPct + "%";
  progressMinutesText.textContent = minutesGoal ? `${sums.minutes} / ${minutesGoal} min` : `${sums.minutes} min`;

  // Odměna
  const payGoal = day.goals.pay || 0;
  let payPct = payGoal ? (sums.pay / payGoal) * 100 : 0;
  payPct = Math.min(payPct, 100);
  progressPayBar.style.width = payPct + "%";
  progressPayText.textContent = payGoal ? `${sums.pay} / ${payGoal} Kč` : `${sums.pay} Kč`;

  // Hovory
  const callsGoal = day.goals.calls || 0;
  let callsPct = callsGoal ? (sums.calls / callsGoal) * 100 : 0;
  callsPct = Math.min(callsPct, 100);
  progressCallsBar.style.width = callsPct + "%";
  progressCallsText.textContent = callsGoal ? `${sums.calls} / ${callsGoal} hovorů` : `${sums.calls} hovorů`;
}

/**
 * Renderuje statistiky pro vybraný rozsah
 */
export async function renderStatsRange(statsContent, currentRange) {
  const all = await dbGetAllDays();
  if (!all || !all.length) {
    if (statsContent) statsContent.innerHTML = "Žádná data.";
    return;
  }

  if (currentRange === "day") {
    const day = await getOrCreateCurrentDay();
    const blocks = await dbLoadBlocksForDay(day.id);
    const sums = computeDaySums(blocks);
    const currentDateStr = getCurrentDate();

    if (statsContent) {
      statsContent.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
          <div>
            <h3>Denní přehled (${currentDateStr})</h3>
            <p><strong>Minuty hovoru:</strong> ${sums.minutes}</p>
            <p><strong>Odměna:</strong> ${sums.pay} Kč</p>
            <p><strong>Hovory:</strong> ${sums.calls}</p>
            <p><strong>Leady:</strong> ${sums.leads}</p>
            <p><strong>KPI:</strong> ${sums.kpiPercent != null ? sums.kpiPercent + "%" : "-"}</p>
          </div>
        </div>
      `;
    }
  }
}
