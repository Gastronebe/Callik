// utils/timer.js - Countdown timer a focus ring logika

import { timeStringToMinutes, formatMMSS } from './formatters.js';
import { RING_CIRC } from '../core/constants.js';

/**
 * Najde aktuální pracovní blok podle času
 */
export function getCurrentWorkBlock(blocks, nowMs) {
  const workBlocks = blocks.filter(b => b.type === "work");
  workBlocks.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));

  for (const b of workBlocks) {
    const startMs = timeStringToMinutes(b.start) * 60 * 1000;
    const endMs = timeStringToMinutes(b.end) * 60 * 1000;
    if (nowMs >= startMs && nowMs < endMs) return b;
  }
  return null;
}

/**
 * Aktualizuje focus ring UI
 */
export function updateFocusRing(elements, currentBlock, nowMins, nowSecs, getProjectById) {
  const { focusTimeEl, focusLabelEl, focusRangeEl, focusProjectEl, ringFg } = elements;

  if (!focusTimeEl || !ringFg) return;

  if (currentBlock) {
    const startMins = timeStringToMinutes(currentBlock.start);
    const endMins = timeStringToMinutes(currentBlock.end);
    const totalSecs = (endMins - startMins) * 60;
    const elapsedSecs = (nowMins - startMins) * 60 + nowSecs;
    const remainingSecs = totalSecs - elapsedSecs;

    focusTimeEl.textContent = formatMMSS(remainingSecs);
    focusLabelEl.textContent = "Zbývá";
    focusRangeEl.textContent = `${currentBlock.start} — ${currentBlock.end}`;

    const progress = elapsedSecs / totalSecs;
    const offset = RING_CIRC * (1 - progress);
    ringFg.style.strokeDashoffset = `${offset}`;

    // Projekt se nastavuje asynchronně v hlavním modulu
    return currentBlock.project_id;
  } else {
    focusTimeEl.textContent = "--:--";
    focusLabelEl.textContent = "Žádný aktivní blok";
    focusRangeEl.textContent = "";
    focusProjectEl.textContent = "";
    ringFg.style.strokeDashoffset = `${RING_CIRC}`;
    return null;
  }
}

/**
 * Vytvoří countdown interval
 */
export function createCountdownInterval(getBlocksAndElements, getProjectById) {
  return setInterval(async () => {
    const { blocks, elements } = await getBlocksAndElements();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowSecs = now.getSeconds();
    const nowMs = (nowMins * 60 + nowSecs) * 1000;

    const currentBlock = getCurrentWorkBlock(blocks, nowMs);
    const projectId = updateFocusRing(elements, currentBlock, nowMins, nowSecs, getProjectById);

    if (projectId && elements.focusProjectEl) {
      const proj = await getProjectById(projectId);
      elements.focusProjectEl.textContent = proj ? proj.name : "";
    }
  }, 1000);
}
