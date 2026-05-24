# Contributing to Resonatia

This guide is for developers working on the codebase — adding scenes, portraits, new story branches, classes, or mechanics.

---

## Table of Contents

1. [File Responsibilities](#file-responsibilities)
2. [Adding a Scene Background](#adding-a-scene-background)
3. [Adding a Class Portrait](#adding-a-class-portrait)
4. [Adding a New Scene Key](#adding-a-new-scene-key)
5. [Writing New Dialogue](#writing-new-dialogue)
6. [Adding a New Story Branch](#adding-a-new-story-branch)
7. [Adding a New Class or Species](#adding-a-new-class-or-species)
8. [Modifying the Dice System](#modifying-the-dice-system)
9. [Score and Ending Thresholds](#score-and-ending-thresholds)
10. [Load Order](#load-order)
11. [Naming Conventions](#naming-conventions)
12. [Browser Testing](#browser-testing)

---

## File Responsibilities

| File             | What it owns                                                        |
|------------------|---------------------------------------------------------------------|
| `js/assets.js`   | All image paths (scenes + portraits). **Edit here to add assets.**  |
| `js/engine.js`   | GameState, canvas, screens, dice, dialogue, scene/portrait manager  |
| `js/story.js`    | All narrative: acts, dialogue lines, branches, endings, classes, species, quiz |
| `js/main.js`     | Quiz renderer, character screen, HUD init, top-level event listeners |
| `css/style.css`  | All visual styling                                                  |
| `index.html`     | DOM structure only — no logic                                       |

**The rule:** narrative content lives in `story.js`. Engine mechanics live in `engine.js`. Asset paths live in `assets.js`. Keep these separate.

---

## Adding a Scene Background

### Step 1 — Drop the image

Place your file inside `assets/scenes/`. Use lowercase filenames with hyphens, no spaces:
```
assets/scenes/tavern.jpg
assets/scenes/sunken-ward.jpg
```

### Step 2 — Register in assets.js

Find the matching key in the `SCENES` object and set `src`:

```js
tavern: {
  src:   "assets/scenes/tavern.jpg",   // ← was null
  emoji: '🍺',
  label: 'Jurnaheim Tavern Interior'
},
```

### Step 3 — Done

Reload. The engine reads `getSceneSrc(key)` automatically before each scene loads.
If the image fails to load (wrong path, missing file), the emoji fallback shows silently — no crash.

### How the overlay works

`css/style.css` renders a `::after` pseudo-element over `.scene-bg` with a gradient that:
- Fades the top of the image slightly
- Heavily darkens the bottom 40% (where dialogue sits)
- Adds subtle color tints

This means your images don't need to be pre-darkened. Natural/slightly dark images work best.

---

## Adding a Class Portrait

### Step 1 — Drop the image

```
assets/portraits/wizard.png
```

Use the exact class name in lowercase as the filename.

### Step 2 — Register in assets.js

```js
Wizard: {
  src:   "assets/portraits/wizard.png",   // ← was null
  emoji: '🧙',
  alt:   'Wizard class portrait'
},
```

### Step 3 — Done

`Portrait.set(cls)` in `engine.js` handles the rest. It injects an `<img>` element into `#char-portrait`, hides the emoji span, and falls back gracefully on load error.

---

## Adding a New Scene Key

If you write a new act or location and need a new background slot:

### 1. Add the key to `SCENES` in `assets.js`:

```js
innerSanctum: {
  src:   null,                              // fill in later
  emoji: '🕍',
  label: 'Inner Sanctum of the Choir'
},
```

### 2. Call it from your story function:

```js
function act5_sanctum() {
  Scene.set('innerSanctum');   // ← matches the key above
  Dialogue.show([...], () => { ... });
}
```

That's it. The engine resolves the path or fallback automatically.

---

## Writing New Dialogue

Use the shorthand helpers defined at the top of `story.js`:

```js
const N = (text) => Dialogue.line('Narrator', text, 'narrator');   // italic narrator
const S = (speaker, text) => Dialogue.line(speaker, text, '');     // named character
const Y = (text) => Dialogue.line('You', text, '');                // player line
```

Pass an array to `Dialogue.show()`:

```js
Dialogue.show([
  N('The dungeon smells of old blood and older magic.'),
  S('Oswald', 'Do not touch anything. Do you hear me? Nothing.'),
  Y('Understood.'),
  N('You touch something immediately.')
], () => nextFunction());
```

The second argument is the callback fired after the last line is clicked through.

### Showing choices after dialogue

Use `Dialogue.showChoices()` inside the callback:

```js
Dialogue.show([ N('What will you do?') ], () => {
  Dialogue.showChoices([
    { text: 'Option A', dc: 12, stat: 'CHA', action: () => handleA() },
    { text: 'Option B', dc: 15, stat: 'STR', action: () => handleB() },
    { text: 'Option C — no roll needed',      action: () => handleC() }
  ]);
});
```

- `dc` and `stat` are optional. If omitted, the choice shows "Free" and fires `action()` directly (no dice roll).
- `stat` must be one of: `'STR'`, `'INT'`, `'CHA'`, `'DEX'`

---

## Adding a New Story Branch

### Pattern for a dice-gated branch:

```js
function act5_climbTower() {
  Dice.check(
    'DEX',                          // stat
    15,                             // DC
    'Dexterity — Climb the Tower (DC 15)',  // label shown in dice modal
    (isCrit) => {
      updateScore(40);
      Dialogue.show([
        N('You reach the top. The view is breathtaking.'),
        isCrit ? N('And somehow — you weren\'t even winded.') : N('Barely.')
      ], () => act5_rooftop());
    },
    (isFumble) => {
      updateScore(-15);
      Dialogue.show([
        N('You fall. It isn\'t elegant.'),
        isFumble ? N('You land directly on a guard.') : N('You land in a bush.')
      ], () => act5_ground());
    }
  );
}
```

`onSuccess` receives `isCrit` (true if natural 20).
`onFail` receives `isFumble` (true if natural 1).
Use these for extra flavour text if you want — they don't have to affect the branch.

---

## Adding a New Class or Species

### New Class — in `story.js`, add to `CLASSES`:

```js
Ranger: {
  stats:     { STR: 13, INT: 11, CHA: 10, DEX: 16 },
  flavor:    'The wilderness is your home. The city is your hunt.',
  archetype: 'DEX'   // determines which quiz answer bucket scores toward this class
},
```

Then add a quiz answer value in the `quizAnswers` object in `GameState.reset()` inside `engine.js`:
```js
quizAnswers: { INT: 0, CHA_INT: 0, STR: 0, CHA: 0, DEX: 0 }
```

And add a `determineClass()` entry in `story.js`:
```js
const map = {
  Wizard:    GameState.quizAnswers.INT,
  Cleric:    GameState.quizAnswers.CHA_INT,
  Barbarian: GameState.quizAnswers.STR,
  Bard:      GameState.quizAnswers.CHA,
  Ranger:    GameState.quizAnswers.DEX    // ← new
};
```

Also add a portrait slot in `assets.js`:
```js
Ranger: {
  src:   null,
  emoji: '🏹',
  alt:   'Ranger class portrait'
},
```

### New Species — in `story.js`, add to `SPECIES`:

```js
Gnome: {
  icon:      '🍄',
  bonus:     { INT: 2 },
  bonusText: '+2 INT',
  desc:      'Small in stature. Enormous in curiosity.'
},
```

The character screen renders all SPECIES entries automatically.

---

## Modifying the Dice System

The dice engine lives in `Dice.check()` in `engine.js`.

### Changing DC thresholds

There are no global DC constants — each call sets its own DC. Search `Dice.check` calls in `story.js` to adjust individual checks.

General guidance used in the current build:
| Difficulty | DC |
|------------|----|
| Easy       | 8–10 |
| Medium     | 12–13 |
| Hard       | 14–16 |
| Very Hard  | 18–20 |

### Changing modifier formula

Currently: `floor((stat − 10) / 2)` — standard D&D 5e formula.

To change it, edit `getMod()` inside the `Dice` IIFE in `engine.js`:

```js
function getMod(stat) {
  const v = GameState.player.stats[stat] || 10;
  return Math.floor((v - 10) / 2);   // ← change this
}
```

---

## Score and Ending Thresholds

Scores accumulate via `updateScore(delta)` throughout the story.
Ending is determined at the end of Act 4 in `calculateEnding()` inside `story.js`:

```js
if      (s >= 180) { /* Good    */ }
else if (s >= 100) { /* Partial */ }
else if (s >= 30)  { /* Bad     */ }
else               { /* Worst   */ }
```

Adjust thresholds here after adding new score-affecting decisions.

Rough score budget from the current build:
- Act 1 choices: +20 to +50 per path
- Act 2 choices: +30 to +50 per path, −10 to −15 on failure
- Act 3 entry:   +30 to +50 per path
- Act 4 finale:  +30 to +80 on success, −20 to −60 on failure

---

## Load Order

Scripts in `index.html` must load in this order — each depends on the previous:

```html
<script src="js/assets.js"></script>   <!-- defines SCENES, PORTRAITS, helper fns -->
<script src="js/engine.js"></script>   <!-- defines GameState, BGCanvas, Screen, Scene, Portrait, Dice, Dialogue, updateScore -->
<script src="js/story.js"></script>    <!-- defines CLASSES, SPECIES, QUIZ, all act functions -->
<script src="js/main.js"></script>     <!-- uses everything above; boots the game -->
```

Do not reorder these.

---

## Naming Conventions

| Thing              | Convention                            | Example                    |
|--------------------|---------------------------------------|----------------------------|
| Act functions      | `act{N}_{description}()`             | `act2_confront()`          |
| Sub-branch fns     | `{parent}_{choice}()`                | `tiefling_duel()`          |
| Scene keys         | camelCase, no spaces                  | `sunkenward`, `endingGood` |
| Asset filenames    | lowercase-hyphen                      | `sunken-ward.jpg`          |
| Class names        | PascalCase matching CLASSES keys      | `Wizard`, `Barbarian`      |
| Species names      | PascalCase matching SPECIES keys      | `Tiefling`, `Elf`          |
| GameState flags    | camelCase boolean                     | `tieflingWarned: true`     |

---

## Browser Testing

Target environments:
- Chrome / Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Chrome / Safari (360 × 640 minimum)

The particle canvas, CSS animations, and font loads are the most likely sources of jank on older or low-power devices. Test on mobile early.

Google Fonts requires an internet connection. For offline builds, download the fonts and serve them locally from `assets/fonts/`.
