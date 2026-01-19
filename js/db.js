// db.js – práce s databází (projekty)

import { supabase } from './supabaseClient.js';

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error('Nelze získat aktuálního uživatele:', error);
    throw new Error('Uživatel není přihlášen');
  }

  return user.id;
}

// ===== Projekty =====

export async function dbGetProjects() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, target_kpi')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Chyba při načítání projektů:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    targetKpi: Number(row.target_kpi)
  }));
}

export async function dbAddProject(name, targetKpi) {
  const userId = await getCurrentUserId();
  const id = String(Date.now()); // stejné ID jako původně
  const { error } = await supabase
    .from('projects')
    .insert({
      id,
      user_id: userId,
      name,
      target_kpi: targetKpi
    });

  if (error) {
    console.error('Chyba při vytváření projektu:', error);
    throw error;
  }

  return id;
}

// ===== Days + blocks =====
// Tabulka: days (user_id, date, goal_minutes, goal_pay, goal_calls)

export async function dbGetDay(dateStr) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('days')
    .select('id, date, goals_minutes, goals_pay, goals_calls')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Chyba při načítání dne:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    date: data.date,
    goals: {
      minutes: data.goals_minutes ?? 0,
      pay: data.goals_pay ?? 0,
      calls: data.goals_calls ?? 0
    }
  };
}

export async function dbUpsertDay(dayObj) {
  const userId = await getCurrentUserId();
  const payload = {
    user_id: userId,
    date: dayObj.date,
    goals_minutes: dayObj.goals?.minutes ?? 0,
    goals_pay: dayObj.goals?.pay ?? 0,
    goals_calls: dayObj.goals?.calls ?? 0
  };

  const { error } = await supabase
    .from('days')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('Chyba při ukládání dne:', error);
    throw error;
  }
}

export async function dbGetAllDays() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('days')
    .select('id, date, goals_minutes, goals_pay, goals_calls')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Chyba při načítání všech dnů:', error);
    throw error;
  }

  // Načteme bloky pro každý den
  const daysWithBlocks = await Promise.all(
    (data || []).map(async row => {
      const blocks = await dbLoadBlocksForDay(row.id);
      return {
        id: row.id,
        date: row.date,
        goals: {
          minutes: row.goals_minutes ?? 0,
          pay: row.goals_pay ?? 0,
          calls: row.goals_calls ?? 0
        },
        blocks: blocks || []
      };
    })
  );

  return daysWithBlocks;
}

// ===== Blocks =====
// Vložit nový blok do databáze

export async function dbInsertBlock(blockData) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('blocks')
    .insert({
      user_id: userId,
      day_id: blockData.dayId,
      type: blockData.type,
      start: blockData.start,
      end: blockData.end,
      talk_minutes: blockData.talkMinutes || null,
      pay: blockData.pay || null,
      calls: blockData.calls || null,
      leads: blockData.leads || null,
      current_kpi: blockData.currentKpi || null,
      reason: blockData.reason || null,
      project_id: blockData.projectId || null
    });

  if (error) {
    console.error('Chyba při vkládání bloku:', error);
    throw error;
  }
}

// Načíst všechny bloky pro daný day_id
export async function dbLoadBlocksForDay(dayId) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('day_id', dayId)
    .order('start', { ascending: true });

  if (error) {
    console.error('Chyba při načítání bloků:', error);
    throw error;
  }

  return data || [];
}

// Aktualizovat blok
export async function dbUpdateBlock(blockId, updates) {
  const { error } = await supabase
    .from('blocks')
    .update(updates)
    .eq('id', blockId);

  if (error) {
    console.error('Chyba při aktualizaci bloku:', error);
    throw error;
  }
}

// Smazat blok
export async function dbDeleteBlock(blockId) {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('id', blockId);

  if (error) {
    console.error('Chyba při mazání bloku:', error);
    throw error;
  }
}

// Aktualizovat project_id bloku
export async function dbUpdateBlockProject(blockId, projectId) {
  const { error } = await supabase
    .from('blocks')
    .update({ project_id: projectId })
    .eq('id', blockId);

  if (error) {
    console.error('Chyba při aktualizaci projektu bloku:', error);
    throw error;
  }
}
