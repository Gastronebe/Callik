// ui/components.js - Renderování UI komponent

import {
  sortBlocksByStart, timeStringToMinutes, minutesToTimeString,
  getDurationMinutes, parseCzNumber
} from '../utils/formatters.js';
import { getQuoteForBlock } from '../utils/quotes.js';
import { buildProjectSelect, getProjectById } from '../services/projects.js';
import { dbUpdateBlock, dbLoadBlocksForDay } from '../db.js';
import { getOrCreateCurrentDay } from '../services/days.js';

/**
 * Renderuje tabulku bloků
 */
export async function renderBlocks(blocks, blocksTbody, callbacks) {
  const {
    onBlockFieldChange,
    onBlockProjectChange,
    onBlockDelete,
    onBlockTimeChange,
    openProjectDialog,
    openEditModal
  } = callbacks;

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

    // 1. Index
    const tdIndex = document.createElement("td");
    tdIndex.textContent = index + 1;
    tr.appendChild(tdIndex);

    // 2. Projekt / Důvod pauzy
    const tdName = document.createElement("td");

    if (block.type === "break") {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "table-input break-input";
      nameInput.value = block.reason || "Pauza";
      nameInput.placeholder = "Důvod pauzy";
      nameInput.addEventListener("change", e => onBlockFieldChange(block.id, "reason", e.target.value));
      tdName.appendChild(nameInput);
    } else {
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
      addBtn.addEventListener("click", () => openProjectDialog(block.id));
      wrap.appendChild(addBtn);
      tdName.appendChild(wrap);
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
      await onBlockTimeChange(block.id, updates);
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
      await onBlockTimeChange(block.id, { end: newEnd });
    });
    tdEnd.appendChild(endInput);
    tr.appendChild(tdEnd);

    // 5. Délka
    const tdLen = document.createElement("td");
    tdLen.textContent = getDurationMinutes(block) + " min";
    tr.appendChild(tdLen);

    if (block.type === "break") {
      // Pro pauzu: citát přes 6 sloupců
      const tdQuote = document.createElement("td");
      tdQuote.setAttribute("colspan", "6");
      tdQuote.style.textAlign = "center";
      tdQuote.style.fontStyle = "italic";
      tdQuote.style.color = "#64748b";
      tdQuote.style.padding = "12px 20px";
      const quoteText = getQuoteForBlock(block.id);
      tdQuote.textContent = `"${quoteText}"`;
      tr.appendChild(tdQuote);
    } else {
      // Pro work: standardní sloupce
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

    // 12. Akce
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
    delBtn.onclick = () => onBlockDelete(block.id);
    actionWrapper.appendChild(delBtn);

    tdActions.appendChild(actionWrapper);
    tr.appendChild(tdActions);

    blocksTbody.appendChild(tr);
  }
}
