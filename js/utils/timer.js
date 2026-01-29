// utils/timer.js - Countdown timer s pause/resume funkcionalitou

import { timeStringToMinutes, formatMMSS } from './formatters.js';
import { RING_CIRC } from '../core/constants.js';

// Stav timeru (lokální)
let timerState = {
  isPaused: false,
  pauseStartTime: null,      // Kdy začala aktuální pauza (timestamp)
  currentBlockId: null,      // ID aktuálně aktivního bloku
  accumulatedPauseMs: 0      // Naakumulovaný čas pauzy od načtení bloku
};

/**
 * Vrátí aktuální stav timeru
 */
export function getTimerState() {
  return { ...timerState };
}

/**
 * Nastaví stav pauzy
 */
export function setTimerPaused(isPaused) {
  if (isPaused && !timerState.isPaused) {
    // Začínáme pauzu
    timerState.isPaused = true;
    timerState.pauseStartTime = Date.now();
  } else if (!isPaused && timerState.isPaused) {
    // Končíme pauzu - přičteme čas k akumulovanému
    if (timerState.pauseStartTime) {
      timerState.accumulatedPauseMs += Date.now() - timerState.pauseStartTime;
    }
    timerState.isPaused = false;
    timerState.pauseStartTime = null;
  }
}

/**
 * Resetuje stav timeru pro nový blok
 */
export function resetTimerState(blockId, savedPausedSeconds = 0) {
  timerState = {
    isPaused: false,
    pauseStartTime: null,
    currentBlockId: blockId,
    accumulatedPauseMs: (savedPausedSeconds || 0) * 1000
  };
}

/**
 * Vrátí celkový čas pauzy v sekundách (včetně probíhající pauzy)
 */
export function getTotalPausedSeconds() {
  let totalMs = timerState.accumulatedPauseMs;
  if (timerState.isPaused && timerState.pauseStartTime) {
    totalMs += Date.now() - timerState.pauseStartTime;
  }
  return Math.floor(totalMs / 1000);
}

/**
 * Najde aktuální blok (work nebo break) podle času
 */
export function getCurrentBlock(blocks, nowMs) {
  const sortedBlocks = [...blocks].sort((a, b) =>
    timeStringToMinutes(a.start) - timeStringToMinutes(b.start)
  );

  for (const b of sortedBlocks) {
    const startMs = timeStringToMinutes(b.start) * 60 * 1000;
    const endMs = timeStringToMinutes(b.end) * 60 * 1000;
    if (nowMs >= startMs && nowMs < endMs) return b;
  }
  return null;
}

/**
 * Najde aktuální pracovní blok podle času (pro zpětnou kompatibilitu)
 */
export function getCurrentWorkBlock(blocks, nowMs) {
  const workBlocks = blocks.filter(b => b.type === "work");
  return getCurrentBlock(workBlocks, nowMs);
}

/**
 * Spočítá zbývající a čistý čas bloku
 */
export function calculateBlockTimes(block, nowMins, nowSecs) {
  const startMins = timeStringToMinutes(block.start);
  const endMins = timeStringToMinutes(block.end);
  const totalSecs = (endMins - startMins) * 60;
  const elapsedSecs = (nowMins - startMins) * 60 + nowSecs;

  // Celkový čas pauzy v sekundách
  const pausedSecs = getTotalPausedSeconds();

  // Zbývající čas (bez ohledu na pauzu - reálný čas do konce bloku)
  const remainingSecs = Math.max(0, totalSecs - elapsedSecs);

  // Čistý odpracovaný čas = uplynulý čas - pauza
  const cleanWorkSecs = Math.max(0, elapsedSecs - pausedSecs);

  // Čistý zbývající čas do cíle (pokud pausujeme, zastaví se)
  const cleanRemainingSecs = timerState.isPaused
    ? remainingSecs  // Během pauzy se reálný čas stále odpočítává
    : remainingSecs;

  return {
    totalSecs,
    elapsedSecs,
    remainingSecs,
    pausedSecs,
    cleanWorkSecs,
    cleanRemainingSecs,
    progress: elapsedSecs / totalSecs
  };
}

/**
 * Aktualizuje focus ring UI s podporou pauzy
 */
export function updateFocusRingWithPause(elements, currentBlock, nowMins, nowSecs) {
  const {
    focusTimeEl, focusLabelEl, focusRangeEl, focusProjectEl, ringFg,
    focusCleanTimeEl, focusPausedTimeEl
  } = elements;

  if (!focusTimeEl || !ringFg) return null;

  if (currentBlock) {
    // Zkontrolujeme, zda se změnil blok
    if (timerState.currentBlockId !== currentBlock.id) {
      resetTimerState(currentBlock.id, currentBlock.paused_seconds || 0);
    }

    const times = calculateBlockTimes(currentBlock, nowMins, nowSecs);

    // Hlavní čas - zbývající
    if (timerState.isPaused) {
      focusTimeEl.textContent = formatMMSS(times.remainingSecs);
      focusLabelEl.textContent = "⏸ PAUZA";
      focusTimeEl.classList.add('paused');
    } else {
      focusTimeEl.textContent = formatMMSS(times.remainingSecs);
      focusLabelEl.textContent = "Zbývá";
      focusTimeEl.classList.remove('paused');
    }

    focusRangeEl.textContent = `${currentBlock.start} — ${currentBlock.end}`;

    // Čistý čas (pokud existuje element)
    if (focusCleanTimeEl) {
      const cleanMins = Math.floor(times.cleanWorkSecs / 60);
      focusCleanTimeEl.textContent = `Čistý čas: ${cleanMins} min`;
    }

    // Čas pauzy (pokud existuje element)
    if (focusPausedTimeEl) {
      if (times.pausedSecs > 0) {
        focusPausedTimeEl.textContent = `Pauza: ${formatMMSS(times.pausedSecs)}`;
        focusPausedTimeEl.style.display = 'block';
      } else {
        focusPausedTimeEl.style.display = 'none';
      }
    }

    // Progress ring
    const offset = RING_CIRC * (1 - times.progress);
    ringFg.style.strokeDashoffset = `${offset}`;

    // Barva kruhu při pauze
    if (timerState.isPaused) {
      ringFg.classList.add('paused');
    } else {
      ringFg.classList.remove('paused');
    }

    return {
      projectId: currentBlock.project_id,
      blockId: currentBlock.id,
      pausedSeconds: times.pausedSecs,
      blockType: currentBlock.type
    };
  } else {
    // Žádný aktivní blok
    focusTimeEl.textContent = "--:--";
    focusLabelEl.textContent = "Žádný aktivní blok";
    focusRangeEl.textContent = "";
    if (focusProjectEl) focusProjectEl.textContent = "";
    if (focusCleanTimeEl) focusCleanTimeEl.textContent = "";
    if (focusPausedTimeEl) focusPausedTimeEl.style.display = 'none';
    ringFg.style.strokeDashoffset = `${RING_CIRC}`;
    ringFg.classList.remove('paused');
    focusTimeEl.classList.remove('paused');

    // Reset stavu když není blok
    if (timerState.currentBlockId !== null) {
      timerState.currentBlockId = null;
      timerState.isPaused = false;
      timerState.pauseStartTime = null;
      timerState.accumulatedPauseMs = 0;
    }

    return null;
  }
}

/**
 * Vrátí čistý čas bloku v minutách (pro zobrazení v tabulce)
 */
export function getCleanDurationMinutes(block) {
  const startMins = timeStringToMinutes(block.start);
  const endMins = timeStringToMinutes(block.end);
  const totalMins = endMins - startMins;
  const pausedMins = Math.floor((block.paused_seconds || 0) / 60);
  return Math.max(0, totalMins - pausedMins);
}
