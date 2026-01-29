// app.js - Orchestrační modul aplikace (refaktorováno)

// Core
import { RING_CIRC } from './core/constants.js';

// Utils
import { getTodayDateString, timeStringToMinutes, formatMMSS } from './utils/formatters.js';
import { getCurrentWorkBlock } from './utils/timer.js';

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
const ringFg = document.querySelector(".ring-fg");

// Inicializace ring
if (ringFg) {
  ringFg.style.strokeDasharray = `${RING_CIRC}`;
  ringFg.style.strokeDashoffset = `${RING_CIRC}`;
}

// Stav
let currentRange = "day";
let countdownInterval = null;

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

  countdownInterval = setInterval(async () => {
    const blocks = await loadBlocksForCurrentDay();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowSecs = now.getSeconds();
    const nowMs = (nowMins * 60 + nowSecs) * 1000;

    if (focusTimeEl && ringFg) {
      const currentBlock = getCurrentWorkBlock(blocks, nowMs);
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

        if (currentBlock.project_id) {
          const proj = await getProjectById(currentBlock.project_id);
          focusProjectEl.textContent = proj ? proj.name : "";
        } else {
          focusProjectEl.textContent = "";
        }
      } else {
        focusTimeEl.textContent = "--:--";
        focusLabelEl.textContent = "Žádný aktivní blok";
        focusRangeEl.textContent = "";
        focusProjectEl.textContent = "";
        ringFg.style.strokeDashoffset = `${RING_CIRC}`;
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
