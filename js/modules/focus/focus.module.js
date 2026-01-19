// Focus modul - stará se o focus timer a kruhový ukazatel

export class FocusModule {
    constructor() {
      // sem později přesuneme stav (např. interval, zbývající čas)
    }
  
    async init() {
      console.log('⏱️ Inicializuji Focus modul...');
      // sem později dáme napojení na DOM a start timeru
    }
      // Pomocná funkce pro formátování času M:SS
  formatMMSS(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ss = String(seconds).padStart(2, '0');
    return `${minutes}:${ss}`;
  }
  }
  