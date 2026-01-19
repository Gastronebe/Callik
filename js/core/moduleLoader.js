export class ModuleLoader {
    constructor() {
      this.modules = new Map();
    }
  
    register(name, module) {
      console.log(`📦 Registruji modul: ${name}`);
      this.modules.set(name, module);
    }
  
    async init() {
      console.log('🚀 Inicializuji všechny moduly...');
  
      for (const [name, module] of this.modules) {
        try {
          if (module.init) {
            console.log(`  ✓ Startuji ${name}...`);
            await module.init();
          }
        } catch (error) {
          console.error(`  ✗ Chyba při inicializaci ${name}:`, error);
        }
      }
  
      console.log('✅ Všechny moduly načteny!');
    }
  
    get(name) {
      return this.modules.get(name);
    }
  }
  