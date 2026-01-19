// auth.js - Autentizace pro Callík
import { supabase } from './supabaseClient.js';

// Přidáno slovo export, aby šlo funkci importovat jinde
export async function register(email, password, passwordConfirm) { 
  if (password !== passwordConfirm) {
    alert('Hesla se neshodují!');
    return;
  }
  if (password.length < 6) {
    alert('Heslo musí mít minimálně 6 znaků.');
    return;
  }
  const { error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    alert('Chyba při registraci: ' + error.message);
  } else {
    alert('Registrace úspěšná! Přihlašujeme vás...');
    window.location.href = '/app.html';
  }
}

export async function login(email, password) { // <--- PŘIDÁNO EXPORT
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    alert('Chyba při přihlášení: ' + error.message);
  } else {
    window.location.href = '/app.html';
  }
}

export async function logout() { // <--- PŘIDÁNO EXPORT
  await supabase.auth.signOut();
  window.location.href = '/landing.html';
}

export async function checkAuth() { // <--- PŘIDÁNO EXPORT
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/landing.html';
  }
  return session;
}

export async function getCurrentUser() { // <--- PŘIDÁNO EXPORT
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Zpřístupnění pro ne-modulový skript na landing.html
window.CallikAuth = { register, login, logout, checkAuth, getCurrentUser };
