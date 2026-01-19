# Callík – Call Centrum Tracking

**Web:** [www.callik.fun](https://www.callik.fun)  
**Provozovatel:** Pavlína Šteiglová  
**Kontakt:** [info@callik.fun](mailto:info@callik.fun)  
**Verze:** 2.0.0

---

## 🚀 Funkce

- ⏱️ Denní plánování bloků (work/break)
- 📊 KPI tracking (hovory, odměna, leady)
- 📈 Statistiky (den/týden/měsíc + metriky na hodinu)
- ⏰ Focus timer s notifikacemi
- 👤 Anonymní profily pro leaderboard
- 📤 Export/Import dat (CSV, JSON)
- 🔧 Modulární architektura připravená na rozšíření

---

## 🛠️ Setup

### 1. Supabase

1. Vytvoř projekt na [supabase.com](https://supabase.com)
2. Zkopíruj **Project URL** a **anon public key**
3. Vytvoř soubor `js/config.js` a nastav:

```javascript
const CONFIG = {
  // ...
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
  // ...
};
```

4. Spusť SQL migraci:
   - Otevři Supabase Dashboard → SQL Editor
   - Zkopíruj obsah `schema.sql` a spusť

### 2. Avatary

- Nahraj 30 avatarů do složky `/assets/avatars/`
- Pojmenuj je: `01.png`, `02.png`, ..., `30.png`

### 3. Supabase Auth nastavení

- Dashboard → Authentication → Providers
- Email provider: **Zapnuto** ✓
- Confirm email: **Vypnuto** (pro jednodušší UX)

### 4. Deploy na [www.callik.fun](https://www.callik.fun)

**Vercel:**
```bash
vercel --prod --domain www.callik.fun
```

**Netlify:**
```bash
netlify deploy --prod --alias www.callik.fun
```

---

## 📂 Struktura projektu

```
/
├── index.html          # Redirect na landing
├── landing.html        # Vstupní stránka
├── app.html            # Hlavní aplikace
├── js/
│   ├── config.js        # ⚙️ Konfigurace (upravuj zde!)
│   ├── supabaseClient.js
│   ├── auth.js
│   ├── db.js
│   ├── profiles.js
│   ├── migration.js
│   ├── validation.js
│   ├── templates.js
│   ├── export.js
│   ├── import.js
│   ├── stats.js
│   ├── realtime.js
│   ├── notifications.js
│   └── app.js
├── css/
│   ├── style.css
│   ├── landing.css
│   └── responsive.css
├── assets/
│   ├── avatars/
│   ├── callik-logo.jpg
│   ├── favicon.jpg
│   └── notification.mp3
├── schema.sql
└── README.md
```

---

## 🔧 Konfigurace (config.js)

Pro úpravu nastavení aplikace edituj `js/config.js`:

- `APP_NAME`, `APP_URL` - základní info
- `OPERATOR_NAME`, `OPERATOR_EMAIL` - kontakt
- `WORKDAY_START_HOUR`, `WORKDAY_END_HOUR` - pracovní doba
- `BREAK_REASONS` - důvody pauz
- `FEATURES` - zapnutí/vypnutí funkcí (leaderboard, atd.)

---

## 🎯 Budoucí rozšíření

V `config.js` jsou připravené feature flags:

```javascript
FEATURES: {
  LEADERBOARD: false,      // ⏳ anonymní leaderboard
  TEAM_STATS: false,       // ⏳ týmové statistiky
  ADMIN_DASHBOARD: false,  // ⏳ admin panel
  PWA: false,              // ⏳ progressive web app
  OFFLINE_MODE: false      // ⏳ offline režim
}
```

Pro aktivaci změň `false` → `true`.

---

## 🔐 Bezpečnost & GDPR

- Email je viditelný pouze pro administrátora
- RLS policies zajišťují izolaci dat mezi uživateli
- Anonymní přezdívky pro leaderboard
- GDPR compliance: [www.callik.fun/gdpr.html](https://www.callik.fun/gdpr.html)

---

## 📧 Podpora

**Email:** [info@callik.fun](mailto:info@callik.fun)  
**Provozovatel:** Pavlína Šteiglová

© 2026 Callík. Všechna práva vyhrazena.
