// services/projects.js - Správa projektů

import { dbGetProjects, dbAddProject } from '../db.js';
import { PROJECTS_KEY } from '../core/constants.js';
import { loadJSON, saveJSON } from '../utils/storage.js';

/**
 * Načte projekty z DB nebo localStorage
 */
export async function loadProjects() {
  try {
    return await dbGetProjects();
  } catch (e) {
    console.warn("DB projekty nedostupné, používám localStorage", e);
    return loadJSON(PROJECTS_KEY, []);
  }
}

/**
 * Přidá projekt do DB nebo localStorage
 */
export async function addProjectToDbOrLocal(name, targetKpi) {
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

/**
 * Najde projekt podle ID
 */
export async function getProjectById(projectId) {
  const projects = await loadProjects();
  return projects.find(p => String(p.id) === String(projectId)) || null;
}

/**
 * Vytvoří select element pro výběr projektu
 */
export async function buildProjectSelect(selectedId) {
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
