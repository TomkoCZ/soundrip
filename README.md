# SoundRip — Render.com (100% zdarma)

---

## Jak nasadit na Render.com (zdarma, bez kreditní karty)

### 1. Nahrajte kód na GitHub

```bash
git init
git add .
git commit -m "SoundRip"
# Vytvořte nový repozitář na github.com, pak:
git remote add origin https://github.com/VAS_NICK/soundrip.git
git push -u origin main
```

### 2. Vytvořte účet na Render.com

Jděte na https://render.com → Sign up (přes GitHub)

### 3. Nová služba

- Klikněte **New → Web Service**
- Připojte váš GitHub repozitář
- Render automaticky detekuje `render.yaml` a nastaví vše sám

### 4. Deploy

Klikněte **Deploy** — za ~2 minuty máte živou URL:
`https://soundrip.onrender.com`

---

## Lokální spuštění

```bash
npm install
npm start
# → http://localhost:3000
```

---

## Omezení free plánu Render

| Věc | Limit |
|-----|-------|
| Cena | Zdarma |
| Kreditní karta | Není potřeba |
| Uspání po nečinnosti | 15 minut (první požadavek trvá ~30s) |
| Měsíční hodiny | 750 h/měsíc |
| RAM | 512 MB |
| CPU | Sdílené |

Pro osobní použití je free plán naprosto dostačující.
