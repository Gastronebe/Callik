// ui/dialogs.js - Správa dialogů

import { parseCzNumber } from '../utils/formatters.js';
import { addProjectToDbOrLocal } from '../services/projects.js';
import { dbUpdateBlockProject, dbLoadBlocksForDay } from '../db.js';
import { getOrCreateCurrentDay } from '../services/days.js';
import { PROJECTS_KEY } from '../core/constants.js';
import { loadJSON, saveJSON } from '../utils/storage.js';
import { getPreviousProjectSums } from '../services/blocks.js';

// State pro dialogy
let pendingProjectSelectBlockId = null;
let currentEditPrevSums = null;

/**
 * Inicializuje dialog pro přidání projektu
 */
export function initProjectDialog(elements, onRefresh) {
  const { projectDialog, projectDialogForm, dlgProjectName, dlgProjectTargetKpi } = elements;

  if (!projectDialogForm) return;

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

    if (pendingProjectSelectBlockId) {
      await dbUpdateBlockProject(pendingProjectSelectBlockId, newId);
      pendingProjectSelectBlockId = null;
    }

    await onRefresh();
  });
}

/**
 * Otevře dialog pro přidání projektu
 */
export function openProjectDialog(blockId, elements) {
  const { projectDialog, dlgProjectName, dlgProjectTargetKpi } = elements;
  pendingProjectSelectBlockId = blockId;
  if (dlgProjectName) dlgProjectName.value = "";
  if (dlgProjectTargetKpi) dlgProjectTargetKpi.value = "";
  projectDialog.showModal();
}

/**
 * Inicializuje dialog pro editaci bloku
 */
export function initEditDialog(onSave) {
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

      await onSave(blockId, updates);
      document.getElementById('blockEditDialog').close();
    });
  }
}

/**
 * Otevře modal pro editaci bloku
 */
export async function openEditModal(block, blocks) {
  const dialog = document.getElementById('blockEditDialog');

  currentEditPrevSums = getPreviousProjectSums(blocks, block);

  document.getElementById('editBlockId').value = block.id;

  const chk = document.getElementById('editCumulativeMode');
  if (chk) chk.checked = false;

  document.getElementById('editTalkMinutes').value = block.talk_minutes ?? '';
  document.getElementById('editPay').value = block.pay ?? '';
  document.getElementById('editCalls').value = block.calls ?? '';
  document.getElementById('editLeads').value = block.leads ?? '';
  document.getElementById('editCurrentKpi').value = block.current_kpi ?? '';

  dialog.showModal();
}
