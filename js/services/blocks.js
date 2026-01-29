// services/blocks.js - Správa bloků

import {
  dbInsertBlock, dbLoadBlocksForDay, dbDeleteBlock,
  dbUpdateBlock, dbUpdateBlockProject
} from '../db.js';
import {
  WORKDAY_START_HOUR, WORKDAY_END_HOUR,
  DEFAULT_WORK_BLOCK_LENGTH, DEFAULT_BREAK_BLOCK_LENGTH
} from '../core/constants.js';
import { minutesToTimeString, timeStringToMinutes, sortBlocksByStart } from '../utils/formatters.js';
import { getOrCreateCurrentDay } from './days.js';

/**
 * Přidá nový blok (work nebo break)
 */
export async function addBlock(type) {
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
    return null;
  }

  const defaultLength = type === "work" ? DEFAULT_WORK_BLOCK_LENGTH : DEFAULT_BREAK_BLOCK_LENGTH;
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
    return await dbLoadBlocksForDay(day.id);
  } catch (e) {
    console.error('Chyba při vkládání bloku', e);
    alert('Nepodařilo se přidat blok.');
    return null;
  }
}

/**
 * Smaže blok
 */
export async function deleteBlock(blockId) {
  if (!confirm("Opravdu smazat tento blok?")) return null;
  await dbDeleteBlock(blockId);
  const day = await getOrCreateCurrentDay();
  return await dbLoadBlocksForDay(day.id);
}

/**
 * Aktualizuje pole bloku
 */
export async function updateBlockField(blockId, field, value) {
  const updates = {};
  if (value === "") updates[field] = null;
  else if (field === "reason" || field === "current_kpi") updates[field] = String(value);
  else updates[field] = Number(value);

  await dbUpdateBlock(blockId, updates);
  const day = await getOrCreateCurrentDay();
  return await dbLoadBlocksForDay(day.id);
}

/**
 * Aktualizuje projekt bloku
 */
export async function updateBlockProject(blockId, projectId) {
  await dbUpdateBlockProject(blockId, projectId || null);
  const day = await getOrCreateCurrentDay();
  return await dbLoadBlocksForDay(day.id);
}

/**
 * Aktualizuje časy bloku
 */
export async function updateBlockTimes(blockId, updates) {
  await dbUpdateBlock(blockId, updates);
  const day = await getOrCreateCurrentDay();
  return await dbLoadBlocksForDay(day.id);
}

/**
 * Smaže všechny bloky dne
 */
export async function clearAllBlocks() {
  if (!confirm("Opravdu vymazat všechny bloky tohoto dne?")) return null;
  const day = await getOrCreateCurrentDay();
  const blocks = await dbLoadBlocksForDay(day.id);
  for (const block of blocks) {
    await dbDeleteBlock(block.id);
  }
  return await dbLoadBlocksForDay(day.id);
}

/**
 * Načte bloky pro aktuální den
 */
export async function loadBlocksForCurrentDay() {
  const day = await getOrCreateCurrentDay();
  return await dbLoadBlocksForDay(day.id);
}

/**
 * Spočítá mezisoučty předchozích bloků stejného projektu
 */
export function getPreviousProjectSums(blocks, currentBlock) {
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
