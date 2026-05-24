# Resonatia

> *"Before you lies Jurnaheim. Its spires reach for the heavens, yet its shadows stretch much further."*

**Resonatia** is a browser-based fantasy visual novel with tabletop RPG mechanics. Take a personality quiz, choose your species, roll a d20, and navigate a branching story through the city of Jurnaheim — a place where your decisions and dice rolls determine whether you become a legend or a warning.

---

## Play

Open `index.html` in any modern browser. No server required, no install needed.

```
resonatia/
└── index.html   ← open this
```

Works on desktop and mobile.

---

## Features

- **Personality quiz** — 5 questions determine your class automatically
- **4 playable classes** — Wizard, Cleric, Barbarian, Bard (each with distinct stat distributions)
- **4 playable species** — Tiefling, Dwarf, Human, Elf (each grants stat bonuses)
- **d20 dice engine** — every major decision involves a dice roll with attribute modifiers vs Difficulty Classes
  - Natural 20 → Critical Success
  - Natural 1 → Critical Fumble
- **Branching narrative** — Acts 1–4 with multiple paths per act
- **4 endings** — Good, Partial, Bad, and Worst, calculated from cumulative score
- **Asset-ready** — drop in your own scene backgrounds and class portraits (see below)

---

## Attribute System

| Stat          | Used for                                  |
|---------------|-------------------------------------------|
| STR (Strength)     | Combat, physical confrontation       |
| INT (Intelligence) | Arcane knowledge, traps, studying    |
| CHA (Charisma)     | Persuasion, bluffing, social checks  |
| DEX (Dexterity)    | Stealth, catching, evading           |

Dice formula: **d20 roll + attribute modifier ≥ DC = success**

Modifiers follow the standard RPG formula: `floor((stat − 10) / 2)`

---

## Adding Your Own Assets

### Scene Backgrounds

1. Drop your image into `assets/scenes/`
2. Open `js/assets.js`
3. Find the matching scene key and set `src`:

```js
tavern: {
  src:   "assets/scenes/tavern.jpg",  // ← was null
  emoji: '🍺',
  label: 'Jurnaheim Tavern Interior'
},
```

4. Reload. Done. A dark gradient overlay is applied automatically.

**Recommended:** 1280 × 720 px, JPG or PNG, under 500 KB.

Full list of scene keys → see `assets/scenes/README.md`

---

### Class Portraits

1. Drop your image into `assets/portraits/`
2. Open `js/assets.js`
3. Find the matching class and set `src`:

```js
Wizard: {
  src:   "assets/portraits/wizard.png",  // ← was null
  emoji: '🧙',
  alt:   'Wizard class portrait'
},
```

4. Reload. Done. The emoji disappears when the image loads.

**Recommended:** 300 × 400 px (portrait ratio), PNG or JPG, under 200 KB.

Full list of portrait keys → see `assets/portraits/README.md`

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Structure | HTML5                             |
| Style     | CSS3 (custom properties, keyframes, grid) |
| Logic     | Vanilla JavaScript (ES6+)         |
| Fonts     | Google Fonts (Cinzel, Crimson Text, UnifrakturMaguntia) |
| Backend   | None                              |
| Database  | None — session only               |

No frameworks. No build step. No dependencies beyond Google Fonts.

---

## Project Structure

```
resonatia/
├── index.html              Main HTML — screens and asset slot comments
├── css/
│   └── style.css           All styles and animations
├── js/
│   ├── assets.js           Asset registry — edit here to add images
│   ├── engine.js           Core engine: canvas, screens, dice, dialogue, scene/portrait rendering
│   ├── story.js            All narrative content: acts, dialogue, branches, endings
│   └── main.js             Quiz logic, character creation, HUD, event listeners
└── assets/
    ├── scenes/             Drop scene background images here
    │   └── README.md
    ├── portraits/          Drop class portrait images here
    │   └── README.md
    └── ui/                 Reserved for future UI assets
        └── README.md
```

---

## Endings

| Ending  | Score Threshold | Description                                      |
|---------|-----------------|--------------------------------------------------|
| Good    | ≥ 180           | The Choir is scattered. The seal resolved.       |
| Partial | ≥ 100           | You held the line — but questions remain.        |
| Bad     | ≥ 30            | You survived, but the city paid for your errors. |
| Worst   | < 30            | The seal breaks. Jurnaheim burns.                |

---

## Based On

Original DnD campaign script — revised March 12, 2026.
Developed as a capstone project for the Computer Science Department,
Adamson University, under Prof. Jessie C. Alamil, MIT.

---

## Team

- Alecxandria E. Baltazar
- Jann Raphael D. Gonzales
- Rodlan Ruzz C. Lanuzo
- Gabriel Fernan G. Razon
- Arnold Harvee T. Masaoay
