// app.js - Orchestrační modul aplikace (refaktorováno)

// Core
import { RING_CIRC } from './core/constants.js';

// Utils
import { getTodayDateString } from './utils/formatters.js';
import {
  getCurrentBlock,
  getTimerState,
  setTimerPaused,
  getTotalPausedSeconds,
  updateFocusRingWithPause
} from './utils/timer.js';

// Services
import { dbLoadBlocksForDay, dbUpdateBlock } from './db.js';
import { getOrCreateCurrentDay, setCurrentDate, getCurrentDate, saveDay } from './services/days.js';
import {
  addBlock as addBlockService,
  deleteBlock as deleteBlockService,
  updateBlockField,
  updateBlockProject,
  updateBlockTimes,
  clearAllBlocks,
  loadBlocksForCurrentDay
} from './services/blocks.js';
import { getProjectById } from './services/projects.js';
import { computeDaySums, updateProgressBars, renderStatsRange } from './services/stats.js';

// UI
import { renderBlocks } from './ui/components.js';
import { initDropdown } from './ui/dropdown.js';
import { initProjectDialog, initEditDialog, openProjectDialog, openEditModal } from './ui/dialogs.js';

// --- DOM Elementy ---
const dayDateInput = document.getElementById("dayDate");
const todayBtn = document.getElementById("todayBtn");
const goalMinutesInput = document.getElementById("goalMinutes");
const goalPayInput = document.getElementById("goalPay");
const goalCallsInput = document.getElementById("goalCalls");
const saveGoalsBtn = document.getElementById("saveGoalsBtn");
const goalsForm = document.getElementById("goalsForm");
let blocksTbody;
const clearBlocksBtn = document.getElementById("clearBlocksBtn");

const progressMinutesBar = document.getElementById("progressMinutes");
const progressMinutesText = document.getElementById("progressMinutesText");
const progressPayBar = document.getElementById("progressPay");
const progressPayText = document.getElementById("progressPayText");
const progressCallsBar = document.getElementById("progressCalls");
const progressCallsText = document.getElementById("progressCallsText");

const rangeButtons = document.querySelectorAll(".rangeBtn");
const statsContent = document.getElementById("statsContent");

// Dialog elementy
const projectDialog = document.getElementById("projectDialog");
const projectDialogForm = document.getElementById("projectDialogForm");
const dlgProjectName = document.getElementById("dlgProjectName");
const dlgProjectTargetKpi = document.getElementById("dlgProjectTargetKpi");

// Focus ring DOM
const focusTimeEl = document.getElementById("focusTime");
const focusLabelEl = document.getElementById("focusLabel");
const focusRangeEl = document.getElementById("focusRange");
const focusProjectEl = document.getElementById("focusProject");
const focusCleanTimeEl = document.getElementById("focusCleanTime");
const focusPausedTimeEl = document.getElementById("focusPausedTime");
const ringFg = document.querySelector(".ring-fg");

// Timer control buttons
const timerPlayBtn = document.getElementById("timerPlayBtn");
const timerPauseBtn = document.getElementById("timerPauseBtn");
const timerStopBtn = document.getElementById("timerStopBtn");

// Inicializace ring
if (ringFg) {
  ringFg.style.strokeDasharray = `${RING_CIRC}`;
  ringFg.style.strokeDashoffset = `${RING_CIRC}`;
}

// Stav
let currentRange = "day";
let countdownInterval = null;
let currentActiveBlockId = null;

// --- Pomocné funkce ---

function setToday() {
  const todayStr = getTodayDateString();
  setCurrentDate(todayStr);
  dayDateInput.value = todayStr;
}

async function refreshUI() {
  const blocks = await loadBlocksForCurrentDay();
  await renderBlocks(blocks, blocksTbody, getCallbacks());
  await updateStatsAndProgress();
}

async function loadDayIntoUI() {
  const day = await getOrCreateCurrentDay();
  goalMinutesInput.value = day.goals.minutes || "";
  goalPayInput.value = day.goals.pay || "";
  goalCallsInput.value = day.goals.calls || "";

  const hasGoals = day.goals.minutes > 0 || day.goals.pay > 0 || day.goals.calls > 0;

  const showGoalsBtn = document.getElementById("showGoalsBtn");
  if (hasGoals) {
    goalsForm.classList.add("hidden");
    if (showGoalsBtn) showGoalsBtn.style.display = "block";
  } else {
    goalsForm.classList.remove("hidden");
    if (showGoalsBtn) showGoalsBtn.style.display = "none";
  }

  await refreshUI();
}

async function saveGoalsFromUI() {
  const day = await getOrCreateCurrentDay();
  day.goals.minutes = Number(goalMinutesInput.value) || 0;
  day.goals.pay = Number(goalPayInput.value) || 0;
  day.goals.calls = Number(goalCallsInput.value) || 0;

  await saveDay(day);
  await updateStatsAndProgress();

  const hasGoals = day.goals.minutes > 0 || day.goals.pay > 0 || day.goals.calls > 0;
  const showGoalsBtn = document.getElementById("showGoalsBtn");

  if (hasGoals) {
    goalsForm.classList.add("hidden");
    if (showGoalsBtn) showGoalsBtn.style.display = "block";
  }
}

let goalsDebounceTimer = null;
function debouncedSaveGoals() {
  if (goalsDebounceTimer) clearTimeout(goalsDebounceTimer);
  goalsDebounceTimer = setTimeout(() => { saveGoalsFromUI(); }, 1000);
}
window.debouncedSaveGoals = debouncedSaveGoals;

async function updateStatsAndProgress() {
  const day = await getOrCreateCurrentDay();
  const blocks = await loadBlocksForCurrentDay();
  const sums = computeDaySums(blocks);

  updateProgressBars({
    progressMinutesBar, progressMinutesText,
    progressPayBar, progressPayText,
    progressCallsBar, progressCallsText
  }, day, sums);

  renderStatsRange(statsContent, currentRange);
}

// --- Timer control functions ---

function updateTimerButtons(hasActiveBlock, isPaused) {
  if (!timerPlayBtn || !timerPauseBtn || !timerStopBtn) return;

  if (!hasActiveBlock) {
    // Žádný aktivní blok - všechna tlačítka disabled
    timerPlayBtn.disabled = true;
    timerPauseBtn.disabled = true;
    timerStopBtn.disabled = true;
  } else if (isPaused) {
    // Je pauza - play enabled, pause disabled
    timerPlayBtn.disabled = false;
    timerPauseBtn.disabled = true;
    timerStopBtn.disabled = false;
  } else {
    // Běží - pause enabled, play disabled
    timerPlayBtn.disabled = true;
    timerPauseBtn.disabled = false;
    timerStopBtn.disabled = false;
  }
}

async function savePausedTimeToBlock(blockId) {
  const pausedSeconds = getTotalPausedSeconds();
  if (pausedSeconds > 0 && blockId) {
    try {
      await dbUpdateBlock(blockId, { paused_seconds: pausedSeconds });
    } catch (err) {
      console.error("Chyba při ukládání času pauzy:", err);
    }
  }
}

function handleTimerPlay() {
  const state = getTimerState();
  if (state.isPaused) {
    setTimerPaused(false);
    updateTimerButtons(true, false);
  }
}

function handleTimerPause() {
  const state = getTimerState();
  if (!state.isPaused && state.currentBlockId) {
    setTimerPaused(true);
    updateTimerButtons(true, true);
  }
}

async function handleTimerStop() {
  const state = getTimerState();
  if (state.currentBlockId) {
    // Ukončíme pauzu pokud běží
    if (state.isPaused) {
      setTimerPaused(false);
    }
    // Uložíme čas pauzy do DB
    await savePausedTimeToBlock(state.currentBlockId);
    // Refresh UI
    await refreshUI();
  }
}

// --- Callbacks pro UI komponenty ---

function getCallbacks() {
  return {
    onBlockFieldChange: async (blockId, field, value) => {
      await updateBlockField(blockId, field, value);
      await updateStatsAndProgress();
    },
    onBlockProjectChange: async (blockId, projectId) => {
      await updateBlockProject(blockId, projectId);
      await refreshUI();
    },
    onBlockDelete: async (blockId) => {
      const blocks = await deleteBlockService(blockId);
      if (blocks) await refreshUI();
    },
    onBlockTimeChange: async (blockId, updates) => {
      await updateBlockTimes(blockId, updates);
      await refreshUI();
    },
    openProjectDialog: (blockId) => {
      openProjectDialog(blockId, { projectDialog, dlgProjectName, dlgProjectTargetKpi });
    },
    openEditModal: async (block) => {
      const blocks = await loadBlocksForCurrentDay();
      await openEditModal(block, blocks);
    }
  };
}

// --- Countdown timer ---

function startCountdownLoop() {
  if (countdownInterval) clearInterval(countdownInterval);

  const elements = {
    focusTimeEl,
    focusLabelEl,
    focusRangeEl,
    focusProjectEl,
    focusCleanTimeEl,
    focusPausedTimeEl,
    ringFg
  };

  countdownInterval = setInterval(async () => {
    const blocks = await loadBlocksForCurrentDay();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowSecs = now.getSeconds();
    const nowMs = (nowMins * 60 + nowSecs) * 1000;

    // Najdeme aktuální blok (work i break)
    const currentBlock = getCurrentBlock(blocks, nowMs);

    // Aktualizujeme focus ring s podporou pauzy
    const result = updateFocusRingWithPause(elements, currentBlock, nowMins, nowSecs);

    if (result) {
      // Máme aktivní blok
      const state = getTimerState();
      updateTimerButtons(true, state.isPaused);

      // Aktualizujeme projekt
      if (result.projectId && focusProjectEl) {
        const proj = await getProjectById(result.projectId);
        focusProjectEl.textContent = proj ? proj.name : "";
      } else if (focusProjectEl) {
        focusProjectEl.textContent = result.blockType === "break" ? "Pauza" : "";
      }

      // Ukládáme čas pauzy každých 10 sekund (pokud se změnil blok nebo je pauza)
      if (currentActiveBlockId !== result.blockId) {
        // Změnil se blok - uložíme předchozí
        if (currentActiveBlockId) {
          await savePausedTimeToBlock(currentActiveBlockId);
        }
        currentActiveBlockId = result.blockId;
      }
    } else {
      // Žádný aktivní blok
      updateTimerButtons(false, false);

      // Uložíme čas pauzy předchozího bloku
      if (currentActiveBlockId) {
        await savePausedTimeToBlock(currentActiveBlockId);
        currentActiveBlockId = null;
      }
    }
  }, 1000);
}

// --- INIT ---

async function init() {
  setToday();
  initDropdown();

  const addWorkBlockBtn = document.getElementById("addWorkBlockBtn");
  const addBreakBlockBtn = document.getElementById("addBreakBlockBtn");
  const showGoalsBtn = document.getElementById("showGoalsBtn");
  blocksTbody = document.getElementById("blocksTbody");

  // Show goals button
  if (showGoalsBtn) {
    showGoalsBtn.addEventListener("click", () => {
      goalsForm.classList.remove("hidden");
      showGoalsBtn.style.display = "none";
    });
  }

  todayBtn.addEventListener("click", async () => {
    setToday();
    await loadDayIntoUI();
  });

  dayDateInput.addEventListener("change", async () => {
    setCurrentDate(dayDateInput.value);
    await loadDayIntoUI();
  });

  saveGoalsBtn.addEventListener("click", async () => {
    await saveGoalsFromUI();
  });

  addWorkBlockBtn.addEventListener("click", async () => {
    const blocks = await addBlockService("work");
    if (blocks) await refreshUI();
  });

  addBreakBlockBtn.addEventListener("click", async () => {
    const blocks = await addBlockService("break");
    if (blocks) await refreshUI();
  });

  clearBlocksBtn.addEventListener("click", async () => {
    const blocks = await clearAllBlocks();
    if (blocks) await refreshUI();
  });

  rangeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeButtons.forEach(b => b.classList.remove("rangeBtn-active"));
      btn.classList.add("rangeBtn-active");
      currentRange = btn.dataset.range;
      renderStatsRange(statsContent, currentRange);
    });
  });

  // Timer control buttons
  if (timerPlayBtn) {
    timerPlayBtn.addEventListener("click", handleTimerPlay);
  }
  if (timerPauseBtn) {
    timerPauseBtn.addEventListener("click", handleTimerPause);
  }
  if (timerStopBtn) {
    timerStopBtn.addEventListener("click", handleTimerStop);
  }

  // Initial button state
  updateTimerButtons(false, false);

  // Dialogy
  initProjectDialog(
    { projectDialog, projectDialogForm, dlgProjectName, dlgProjectTargetKpi },
    refreshUI
  );

  initEditDialog(async (blockId, updates) => {
    try {
      await dbUpdateBlock(blockId, updates);
      await refreshUI();
    } catch (err) {
      console.error("Chyba při ukládání:", err);
      alert("Chyba při ukládání dat.");
    }
  });

  await loadDayIntoUI();
  startCountdownLoop();
}

export { init };
