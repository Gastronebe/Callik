// === import modulů ===
import { ModuleLoader } from './core/moduleLoader.js';
import { eventBus } from './core/eventBus.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';

const moduleLoader = new ModuleLoader();
moduleLoader.register('quotes', new QuotesModule());

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Startuji aplikaci Callik...');
  await moduleLoader.init();
});

// app.js - Hlavní logika aplikace (Refaktorováno - bez inline stylů)
import {
  dbGetProjects,
  dbAddProject,
  dbUpsertDay,
  dbGetAllDays,
  dbInsertBlock,
  dbLoadBlocksForDay,
  dbDeleteBlock,
  dbUpdateBlock,
  dbUpdateBlockProject,
  dbGetDay
} from './db.js';
import { quotes } from './quotes.js';


// Pomocná funkce pro získání citátu z importovaného pole
function getQuoteForBlock(blockId) {
  if (!quotes || quotes.length === 0) return "Odpočívej."; 
  const idNum = blockId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = idNum % quotes.length;
  return quotes[index];
}

// Globální proměnná pro ukládání mezisoučtů při editaci
let currentEditPrevSums = null;

// --- Konstanty ---
const STORAGE_KEY = "cc-tracker-days";
const PROJECTS_KEY = "cc-tracker-projects";
const SETTINGS_KEY = "cc-tracker-settings";
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 20;

// --- LocalStorage helpers ---
function loadJSON(key, defaultValue) {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Settings ---
function loadSettings() {
  return loadJSON(SETTINGS_KEY, { cumulativeMode: false });
}
function saveSettings(settings) {
  saveJSON(SETTINGS_KEY, settings);
}

// --- Projects (Supabase + fallback) ---
async function loadProjects() {
  try {
    return await dbGetProjects();
  } catch (e) {
    console.warn("DB projekty nedostupné, používám localStorage", e);
    return loadJSON(PROJECTS_KEY, []);
  }
}

async function addProjectToDbOrLocal(name, targetKpi) {
  try {
    const id = await dbAddProject(name, targetKpi);
    return id;
  } catch (e) {
    console.warn("DB projekt nelze uložit, ukládám do localStorage", e);
    const projects = loadJSON(PROJECTS_KEY, []);
    const id = String(Date.now());
    projects.push({ id, name, targetKpi: targetKpi });
    saveJSON(PROJECTS_KEY, projects);
    return id;
  }
}

async function getProjectById(projectId) {
  const projects = await loadProjects();
  return projects.find(p => String(p.id) === String(projectId)) || null;
}

// --- Čísla s čárkou (KPI) ---
function parseCzNumber(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  return parseFloat(s.replace(/\s/g, '').replace(',', '.'));
}

// --- Time helpers ---
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function minutesToTimeString(totalMinutesFromMidnight) {
  const h = Math.floor(totalMinutesFromMidnight / 60);
  const m = totalMinutesFromMidnight % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function timeStringToMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}
function getDurationMinutes(block) {
  const startMins = timeStringToMinutes(block.start);
  const endMins = timeStringToMinutes(block.end);
  return Math.max(endMins - startMins, 0);
}
function sortBlocksByStart(blocks) {
  if (!blocks || !Array.isArray(blocks)) return [];
  return blocks.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
}

// --- Focus ring helpers ---
function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}
function getCurrentWorkBlock(blocks, nowMs) {
  const workBlocks = blocks.filter(b => b.type === "work");
  workBlocks.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));

  for (const b of workBlocks) {
    const startMs = timeStringToMinutes(b.start) * 60 * 1000;
    const endMs = timeStringToMinutes(b.end) * 60 * 1000;
    if (nowMs >= startMs && nowMs < endMs) return b;
  }
  return null;
}

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

// Dialog
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
const RING_RADIUS = 92;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

if (ringFg) {
  ringFg.style.strokeDasharray = `${RING_CIRC}`;
  ringFg.style.strokeDashoffset = `${RING_CIRC}`;
}

// Stav
let currentDateStr = "";
let cachedCurrentDay = null;
let currentRange = "day";
let countdownInterval = null;
let pendingProjectSelectBlockId = null;

// --- Projects UI builder ---
async function buildProjectSelect(selectedId) {
  const select = document.createElement("select");
  select.className = "project-select";
  
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "-- Nezařazeno --";
  select.appendChild(optEmpty);

  const projects = await loadProjects();
  projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (cíl ${String(p.targetKpi).replace('.', ',')}%)`;
    select.appendChild(opt);
  });
  select.value = selectedId || "";
  return select;
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
    currentDateStr = dayDateInput.value;
    await loadDayIntoUI();
  });

  saveGoalsBtn.addEventListener("click", async () => {
    await saveGoalsFromUI();
  });

  addWorkBlockBtn.addEventListener("click", async () => await addBlock("work"));
  addBreakBlockBtn.addEventListener("click", async () => await addBlock("break"));

  clearBlocksBtn.addEventListener("click", async () => {
    if (confirm("Opravdu vymazat všechny bloky tohoto dne?")) {
      const day = await getOrCreateCurrentDay();
      const blocks = await dbLoadBlocksForDay(day.id);
      for (const block of blocks) {
        await dbDeleteBlock(block.id);
      }
      const emptyBlocks = await dbLoadBlocksForDay(day.id);
      await renderBlocks(emptyBlocks);
      await updateStatsAndProgress();
    }
  });

  rangeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeButtons.forEach(b => b.classList.remove("rangeBtn-active"));
      btn.classList.add("rangeBtn-active");
      currentRange = btn.dataset.range;
      renderStatsRange();
    });
  });

  // Dialog nového projektu
  if (projectDialogForm) {
    projectDialogForm.addEventListener("submit", async (e) => {
      const action = document.activeElement?.value; 
      if (action !== "save") return;
      e.preventDefault();

      const name = (dlgProjectName.value || "").trim();
      const target = parseCzNumber(dlgProjectTargetKpi.value);

      if (!name) { alert("Zadej název projektu."); return; }
      if (target == null || Number.isNaN(target)) { alert("Zadej cílové KPI jako číslo (např. 12,5)."); return; }

      const newId = await addProjectToDbOrLocal(name, target);

      const projects = loadJSON(PROJECTS_KEY, []);
      if (!projects.find(p => p.id === newId)) {
        projects.push({ id: newId, name, targetKpi: target });
        saveJSON(PROJECTS_KEY, projects);
      }

      projectDialog.close();

      let day = await getOrCreateCurrentDay();
      if (pendingProjectSelectBlockId) {
        await dbUpdateBlockProject(pendingProjectSelectBlockId, newId);
        pendingProjectSelectBlockId = null;
      }
      const blocks = await dbLoadBlocksForDay(day.id);
      await renderBlocks(blocks);
      await updateStatsAndProgress();
    });
  }

  // Dialog editace bloku
  const editForm = document.getElementById('blockEditForm');
  const editDialog = document.getElementById('blockEditDialog');
  const editCancelBtn = document.getElementById('blockEditCancelBtn');
  const editCumulativeChk = document.getElementById('editCumulativeMode');

  if (editCancelBtn && editDialog) {
    editCancelBtn.addEventListener('click', () => editDialog.close());
  }

  if (editCumulativeChk) {
    editCumulativeChk.addEventListener('change', () => {
      let talk = document.getElementById('editTalkMinutes').value === "" ? 0 : Number(document.getElementById('editTalkMinutes').value);
      let pay = document.getElementById('editPay').value === "" ? 0 : Number(document.getElementById('editPay').value);
      let calls = document.getElementById('editCalls').value === "" ? 0 : Number(document.getElementById('editCalls').value);
      let leads = document.getElementById('editLeads').value === "" ? 0 : Number(document.getElementById('editLeads').value);

      const sums = currentEditPrevSums || { talk: 0, pay: 0, calls: 0, leads: 0 };

      if (editCumulativeChk.checked) {
        document.getElementById('editTalkMinutes').value = talk + sums.talk;
        document.getElementById('editPay').value = pay + sums.pay;
        document.getElementById('editCalls').value = calls + sums.calls;
        document.getElementById('editLeads').value = leads + sums.leads;
      } else {
        document.getElementById('editTalkMinutes').value = Math.max(0, talk - sums.talk);
        document.getElementById('editPay').value = Math.max(0, pay - sums.pay);
        document.getElementById('editCalls').value = Math.max(0, calls - sums.calls);
        document.getElementById('editLeads').value = Math.max(0, leads - sums.leads);
      }
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const blockId = document.getElementById('editBlockId').value;
      const isCumulative = editCumulativeChk ? editCumulativeChk.checked : false;
      const sums = currentEditPrevSums || { talk: 0, pay: 0, calls: 0, leads: 0 };

      const getVal = (id) => {
        const val = document.getElementById(id).value;
        return val === "" ? null : Number(val);
      };

      let valTalk = getVal('editTalkMinutes');
      let valPay = getVal('editPay');
      let valCalls = getVal('editCalls');
      let valLeads = getVal('editLeads');

      if (isCumulative) {
        if (valTalk !== null) valTalk = Math.max(0, valTalk - sums.talk);
        if (valPay !== null) valPay = Math.max(0, valPay - sums.pay);
        if (valCalls !== null) valCalls = Math.max(0, valCalls - sums.calls);
        if (valLeads !== null) valLeads = Math.max(0, valLeads - sums.leads);
      }

      const updates = {
        talk_minutes: valTalk,
        pay: valPay,
        calls: valCalls,
        leads: valLeads,
        current_kpi: document.getElementById('editCurrentKpi').value
      };

      try {
        await dbUpdateBlock(blockId, updates);
        document.getElementById('blockEditDialog').close();
        
        const day = await getOrCreateCurrentDay();
        const blocks = await dbLoadBlocksForDay(day.id);
        await renderBlocks(blocks);
        await updateStatsAndProgress();
      } catch (err) {
        console.error("Chyba při ukládání:", err);
        alert("Chyba při ukládání dat.");
      }
    });
  }

  await loadDayIntoUI();
  startCountdownLoop();
}

export { init };

// --- Další funkce ---

function setToday() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = pad2(today.getMonth() + 1);
  const dd = pad2(today.getDate());
  currentDateStr = `${yyyy}-${mm}-${dd}`;
  dayDateInput.value = currentDateStr;
}

function initDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  const toggle = document.getElementById('profileToggle');
  
  if (!dropdown || !toggle) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('open');
    }
  });
}

async function getOrCreateCurrentDay() {
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

let goalsDebounceTimer = null;
function debouncedSaveGoals() {
  if (goalsDebounceTimer) clearTimeout(goalsDebounceTimer);
  goalsDebounceTimer = setTimeout(() => { saveGoalsFromUI(); }, 1000);
}
window.debouncedSaveGoals = debouncedSaveGoals;

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

  const blocks = await dbLoadBlocksForDay(day.id);
  await renderBlocks(blocks);
  await updateStatsAndProgress();
}

async function saveGoalsFromUI() {
  const day = await getOrCreateCurrentDay();
  day.goals.minutes = Number(goalMinutesInput.value) || 0;
  day.goals.pay = Number(goalPayInput.value) || 0;
  day.goals.calls = Number(goalCallsInput.value) || 0;
  
  try {
    await dbUpsertDay(day);
  } catch (e) {
    console.warn('DB upsert day error', e);
  }
  
  await updateStatsAndProgress();
  
  const hasGoals = day.goals.minutes > 0 || day.goals.pay > 0 || day.goals.calls > 0;
  const showGoalsBtn = document.getElementById("showGoalsBtn");
  
  if (hasGoals) {
    goalsForm.classList.add("hidden");
    if (showGoalsBtn) showGoalsBtn.style.display = "block";
  }
}

async function addBlock(type) {
  const day = await getOrCreateCurrentDay();
  const existingBlocks = await dbLoadBlocksForDay(day.id);
  const sortedBlocks = sortBlocksByStart(existingBlocks);

  const getNextBlockStartMinutes = (blocks) => {
    if (!blocks || blocks.length === 0) return WORKDAY_START_HOUR * 60;
    const lastBlock = blocks[blocks.length - 1];
    return timeStringToMinutes(lastBlock.end);
  };

  const nextStartMins = getNextBlockStartMinutes(sortedBlocks);
  const workdayEndMins = WORKDAY_END_HOUR * 60;

  if (nextStartMins >= workdayEndMins) {
    alert("Další blok by přesáhl konec pracovního dne (20:00).");
    return;
  }

  const defaultLength = type === "work" ? 30 : 15;
  const endMins = Math.min(nextStartMins + defaultLength, workdayEndMins);

  const blockData = {
    dayId: day.id,
    type: type,
    start: minutesToTimeString(nextStartMins),
    end: minutesToTimeString(endMins),
    talkMinutes: null, pay: null, calls: null, leads: null, currentKpi: null, reason: null, projectId: null
  };

  try {
    await dbInsertBlock(blockData);
    const updatedBlocks = await dbLoadBlocksForDay(day.id);
    await renderBlocks(updatedBlocks);
    await updateStatsAndProgress();
  } catch (e) {
    console.error('Chyba při vkládání bloku', e);
    alert('Nepodařilo se přidat blok.');
  }
}

async function onBlockFieldChange(blockId, field, value) {
  try {
    const day = await getOrCreateCurrentDay();
    const blocks = await dbLoadBlocksForDay(day.id);
    const block = blocks.find(b => String(b.id) === String(blockId));
    if (!block) return;

    const updates = {};
    if (value === "") updates[field] = null;
    else if (field === "reason" || field === "current_kpi") updates[field] = String(value);
    else updates[field] = Number(value);

    await dbUpdateBlock(blockId, updates);
    const updatedBlocks = await dbLoadBlocksForDay(day.id);
    await updateStatsAndProgress();
  } catch (e) {
    console.warn('Update failed', e);
  }
}
window.onBlockFieldChange = onBlockFieldChange;

async function onBlockProjectChange(blockId, projectId) {
  await dbUpdateBlockProject(blockId, projectId || null);
  const day = await getOrCreateCurrentDay();
  const blocks = await dbLoadBlocksForDay(day.id);
  await renderBlocks(blocks); 
  await updateStatsAndProgress();
}
window.onBlockProjectChange = onBlockProjectChange;

async function deleteBlock(blockId) {
  if(!confirm("Opravdu smazat tento blok?")) return;
  await dbDeleteBlock(blockId);
  const day = await getOrCreateCurrentDay();
  const blocks = await dbLoadBlocksForDay(day.id);
  await renderBlocks(blocks);
  await updateStatsAndProgress();
}

// --- RENDER BLOCKS (REFAKTOROVÁNO) ---
async function renderBlocks(blocks = []) {
  blocksTbody.innerHTML = "";
  blocks = sortBlocksByStart(blocks);

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const tr = document.createElement("tr");
    tr.classList.add("block-row");
    
    if (block.type === "break") tr.classList.add("break");

    const now = new Date();
    const startMins = timeStringToMinutes(block.start);
    const endMins = timeStringToMinutes(block.end);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    
    if (nowMins >= startMins && nowMins < endMins && block.type === "work") {
        tr.classList.add("current");
    } else if (nowMins >= endMins) {
        tr.classList.add("finished");
    }

    // 1. Index (VŽDY PRVNÍ - pro work i break)
    const tdIndex = document.createElement("td");
    tdIndex.textContent = index + 1;
    tr.appendChild(tdIndex);

   // 2. Projekt / Důvod pauzy
const tdName = document.createElement("td");

console.log("Block type:", block.type, "Block ID:", block.id); // DEBUG

if (block.type === "break") {
    // PAUZA: Input pro důvod
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "table-input break-input";
    nameInput.value = block.reason || "Pauza";
    nameInput.placeholder = "Důvod pauzy";
    nameInput.addEventListener("change", e => onBlockFieldChange(block.id, "reason", e.target.value));
    tdName.appendChild(nameInput);
    console.log("Created BREAK input"); // DEBUG
    
} else {
    // WORK: Project select
    const wrap = document.createElement("div");
    wrap.className = "project-cell";
    const select = await buildProjectSelect(block.project_id);
    select.className = "table-select";
    select.addEventListener("change", e => onBlockProjectChange(block.id, e.target.value));
    wrap.appendChild(select);
    
    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.title = "Nový projekt";
    addBtn.className = "add-project-btn";
    addBtn.addEventListener("click", () => {
        pendingProjectSelectBlockId = block.id;
        if(dlgProjectName) dlgProjectName.value = "";
        if(dlgProjectTargetKpi) dlgProjectTargetKpi.value = "";
        projectDialog.showModal();
    });
    wrap.appendChild(addBtn);
    tdName.appendChild(wrap);
    console.log("Created WORK select"); // DEBUG
}

tr.appendChild(tdName);



    // 3. Start
    const tdStart = document.createElement("td");
    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.value = block.start;
    startInput.className = "table-input time-input-centered";
    startInput.addEventListener("change", async (e) => {
        if (!e.target.value) return;
        const newStart = e.target.value;
        const updates = { start: newStart };
        if (timeStringToMinutes(block.end) <= timeStringToMinutes(newStart)) {
            updates.end = minutesToTimeString(timeStringToMinutes(newStart) + 30);
        }
        await dbUpdateBlock(block.id, updates);
        const day = await getOrCreateCurrentDay();
        const updatedBlocks = await dbLoadBlocksForDay(day.id);
        await renderBlocks(updatedBlocks);
        await updateStatsAndProgress();
    });
    tdStart.appendChild(startInput);
    tr.appendChild(tdStart);

    // 4. Konec
    const tdEnd = document.createElement("td");
    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.value = block.end;
    endInput.className = "table-input time-input-centered";
    endInput.addEventListener("change", async (e) => {
        if (!e.target.value) return;
        let newEnd = e.target.value;
        if (timeStringToMinutes(newEnd) <= timeStringToMinutes(block.start)) {
            alert("Konec nemůže být dříve než začátek.");
            e.target.value = block.end;
            return;
        }
        await dbUpdateBlock(block.id, { end: newEnd });
        const day = await getOrCreateCurrentDay();
        const updatedBlocks = await dbLoadBlocksForDay(day.id);
        await renderBlocks(updatedBlocks);
        await updateStatsAndProgress();
    });
    tdEnd.appendChild(endInput);
    tr.appendChild(tdEnd);

    // 5. Délka
const tdLen = document.createElement("td");
tdLen.textContent = getDurationMinutes(block) + " min";
tr.appendChild(tdLen);

if (block.type === "break") {
    // Pro PAUZU: colspan=6 pokrývá sloupce 6,7,8,9,10,11
    const tdQuote = document.createElement("td");
    tdQuote.setAttribute("colspan", "6");  // Použijte setAttribute místo colSpan
    tdQuote.style.textAlign = "center";
    tdQuote.style.fontStyle = "italic";
    tdQuote.style.color = "#64748b";
    tdQuote.style.padding = "12px 20px";
    const quoteText = getQuoteForBlock(block.id);
    tdQuote.textContent = `✨ "${quoteText}"`;
    tr.appendChild(tdQuote);
    
} else {
    // Pro WORK: standardní sloupce 6-11
    const tdTalk = document.createElement("td");
    tdTalk.textContent = block.talk_minutes ?? "-";
    tr.appendChild(tdTalk);

    const tdPay = document.createElement("td");
    tdPay.textContent = block.pay ? `${block.pay} Kč` : "-";
    tr.appendChild(tdPay);

    const tdCalls = document.createElement("td");
    tdCalls.textContent = block.calls ?? "-";
    tr.appendChild(tdCalls);

    const tdLeads = document.createElement("td");
    tdLeads.textContent = block.leads ?? "-";
    tr.appendChild(tdLeads);

    const tdKpi = document.createElement("td");
    const kpiVal = block.current_kpi;
    tdKpi.textContent = kpiVal ? `${kpiVal} %` : "-";
    const proj = block.project_id ? await getProjectById(block.project_id) : null;
    const target = proj ? proj.targetKpi : null;
    const current = parseCzNumber(kpiVal);
    if (target != null && current != null && !Number.isNaN(current)) {
        if (current >= target) {
            tdKpi.style.color = "var(--success)";
            tdKpi.style.fontWeight = "bold";
        } else {
            tdKpi.style.color = "var(--danger)";
            tdKpi.style.fontWeight = "bold";
        }
    }
    tr.appendChild(tdKpi);

    const tdPercent = document.createElement("td");
    tdPercent.classList.add("percent-cell");
    const durationMinutes = getDurationMinutes(block);
    const talkVal = block.talk_minutes || 0;
    if (talkVal > 0 && durationMinutes > 0) {
        const ratio = (talkVal / durationMinutes) * 100;
        const ratioRounded = Math.round(ratio);
        tdPercent.textContent = ratioRounded + " %";
        if (ratio >= 70) tdPercent.classList.add("percent-good");
        else if (ratio >= 50) tdPercent.classList.add("percent-mid");
        else tdPercent.classList.add("percent-bad");
    } else {
        tdPercent.textContent = "-";
    }
    tr.appendChild(tdPercent);
}

// 12. Akce - VŽDY jako poslední sloupec
const tdActions = document.createElement("td");
const actionWrapper = document.createElement("div");
actionWrapper.className = "action-buttons-wrapper";

if (block.type === "work") {
    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.title = "Upravit";
    editBtn.className = "btn-edit";
    editBtn.onclick = () => openEditModal(block);
    actionWrapper.appendChild(editBtn);
}

const delBtn = document.createElement("button");
delBtn.textContent = "🗑️";
delBtn.title = "Smazat";
delBtn.className = "btn-delete";
delBtn.onclick = () => deleteBlock(block.id);
actionWrapper.appendChild(delBtn);

tdActions.appendChild(actionWrapper);
tr.appendChild(tdActions);

blocksTbody.appendChild(tr);


  }
}

// --- OPEN EDIT MODAL ---
async function openEditModal(block) {
  const dialog = document.getElementById('blockEditDialog');
  const day = await getOrCreateCurrentDay();
  const blocks = await dbLoadBlocksForDay(day.id);
  
  currentEditPrevSums = getPreviousProjectSums(blocks, block);

  document.getElementById('editBlockId').value = block.id;

  const chk = document.getElementById('editCumulativeMode');
  if(chk) chk.checked = false;

  document.getElementById('editTalkMinutes').value = block.talk_minutes ?? '';
  document.getElementById('editPay').value = block.pay ?? '';
  document.getElementById('editCalls').value = block.calls ?? '';
  document.getElementById('editLeads').value = block.leads ?? '';
  document.getElementById('editCurrentKpi').value = block.current_kpi ?? '';

  dialog.showModal();
}

function getPreviousProjectSums(blocks, currentBlock) {
  let sumTalk = 0, sumPay = 0, sumCalls = 0, sumLeads = 0;
  
  if (!currentBlock.project_id) return { talk: 0, pay: 0, calls: 0, leads: 0 };

  const sortedBlocks = [...blocks].sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
  
  for (const b of sortedBlocks) {
    if (String(b.id) === String(currentBlock.id)) break;
    
    if (b.type === 'work' && String(b.project_id) === String(currentBlock.project_id)) {
      sumTalk += (b.talk_minutes || 0);
      sumPay += (b.pay || 0);
      sumCalls += (b.calls || 0);
      sumLeads += (b.leads || 0);
    }
  }
  
  return { talk: sumTalk, pay: sumPay, calls: sumCalls, leads: sumLeads };
}

// --- STATISTIKY ---
function computeDaySums(blocks) {
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

async function updateStatsAndProgress() {
  const day = await getOrCreateCurrentDay();
  const blocks = await dbLoadBlocksForDay(day.id);
  const sums = computeDaySums(blocks);

  const minutesGoal = day.goals.minutes || 0;
  let minutesPct = minutesGoal ? (sums.minutes / minutesGoal) * 100 : 0;
  minutesPct = Math.min(minutesPct, 100);
  progressMinutesBar.style.width = minutesPct + "%";
  progressMinutesText.textContent = minutesGoal ? `${sums.minutes} / ${minutesGoal} min` : `${sums.minutes} min`;

  const payGoal = day.goals.pay || 0;
  let payPct = payGoal ? (sums.pay / payGoal) * 100 : 0;
  payPct = Math.min(payPct, 100);
  progressPayBar.style.width = payPct + "%";
  progressPayText.textContent = payGoal ? `${sums.pay} / ${payGoal} Kč` : `${sums.pay} Kč`;

  const callsGoal = day.goals.calls || 0;
  let callsPct = callsGoal ? (sums.calls / callsGoal) * 100 : 0;
  callsPct = Math.min(callsPct, 100);
  progressCallsBar.style.width = callsPct + "%";
  progressCallsText.textContent = callsGoal ? `${sums.calls} / ${callsGoal} hovorů` : `${sums.calls} hovorů`;

  renderStatsRange();
}

async function renderStatsRange() {
  const all = await dbGetAllDays();
  if (!all || !all.length) {
    if (statsContent) statsContent.innerHTML = "Žádná data.";
    return;
  }

  if (currentRange === "day") {
    const day = await getOrCreateCurrentDay();
    const blocks = await dbLoadBlocksForDay(day.id);
    const sums = computeDaySums(blocks);

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
    return;
  }
}

function startCountdownLoop() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(async () => {
    const day = await getOrCreateCurrentDay();
    const blocks = await dbLoadBlocksForDay(day.id);
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