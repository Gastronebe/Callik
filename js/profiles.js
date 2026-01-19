// profiles.js - Načtení profilu uživatele do hlavičky

import { supabase } from './supabaseClient.js';
import { CONFIG } from './config.js';

export async function loadCurrentProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn('Nemohu načíst uživatele:', userError);
    return;
  }

  const { data, error, status } = await supabase
    .from('profiles')
    .select('display_name, avatar_number')
    .eq('id', user.id)
    .maybeSingle();

  const nameEl = document.getElementById('profileName');
  const avatarEl = document.getElementById('profileAvatar');

  if (error) {
    console.error('Chyba při načítání profilu:', { status, error });
    if (nameEl) nameEl.textContent = 'Uživatel';
    return;
  }

  if (!data) {
    console.warn('Profil pro uživatele nebyl nalezen.');
    if (nameEl) nameEl.textContent = 'Uživatel';
    return;
  }

  if (nameEl) {
    nameEl.textContent = data.display_name;
  }

  if (avatarEl) {
    const num = String(data.avatar_number).padStart(2, '0');
    avatarEl.src = `${CONFIG.AVATAR_PATH}${num}.png`;
  }
}

// připoj odhlášení na tlačítko v hlavičce
export function initProfileHeader() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/landing.html';
    });
  }
}