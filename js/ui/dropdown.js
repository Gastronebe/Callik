// ui/dropdown.js - Profile dropdown

/**
 * Inicializuje profile dropdown menu
 */
export function initDropdown() {
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
