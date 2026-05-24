/* ============================================================
   RESONATIA — js/assets.js
   ============================================================
   ASSET REGISTRY — edit this file to plug in your images.

   HOW IT WORKS
   ─────────────
   1. Drop your image files into the correct subfolder:
        assets/scenes/           ← scene backgrounds
        assets/characters/allies/   ← Kiave, Shaira
        assets/characters/enemies/  ← Ashrag, Bullywug, Beast, Barkling
        assets/characters/player/   ← player sprites by skin/gender
        assets/weapons/             ← weapon sprites

   2. The SCENES, CHARACTERS, and PLAYER_SPRITES maps below
      are pre-filled with all sprite filenames from Sprites.zip.
      Paths are relative to index.html.

   3. Save. Reload the browser. Your images appear automatically.

   No other file needs to be edited.
   ============================================================ */


/* ------------------------------------------------------------
   SCENE BACKGROUNDS
   ------------------------------------------------------------
   Each key matches the string passed to Scene.set() in story.js.
   Fields:
     src    — path relative to index.html, or null to keep emoji
     emoji  — fallback if src is null or fails to load
     label  — human-readable name (for reference only)

   RECOMMENDED IMAGE SPECS
     Resolution : 1280 × 720 px minimum  (16:9)
     Format     : JPG for photos, PNG for illustrated art
     File size  : keep under 500 KB per image for fast loading
   ------------------------------------------------------------ */
const SCENES = {

  /* -- Title / intro ---------------------------------------- */
  title: {
    src:   'assets/scenes/Title_Screen.png',
    emoji: '🌌',
    label: 'Title Screen'
  },

  /* -- Act 1: Jurnaheim city -------------------------------- */
  city: {
    src:   'assets/scenes/Jurnaheim_Gates.png',
    emoji: '🏙️',
    label: 'Jurnaheim City Gates'
  },

  /* -- Act 1: The Tavern ------------------------------------ */
  tavern: {
    src:   'assets/scenes/Tavern.png',
    emoji: '🍺',
    label: 'Jurnaheim Tavern Interior'
  },

  /* -- Act 1: Tiefling encounter ---------------------------- */
  tiefling: {
    src:   'assets/scenes/Tavern.png',
    emoji: '😈',
    label: 'Tiefling Rogue — Corner Booth'
  },

  /* -- Act 1: Waitress encounter ---------------------------- */
  waitress: {
    src:   'assets/scenes/Tavern.png',
    emoji: '🕯️',
    label: 'Tavern — Candlelit Counter'
  },

  /* -- Act 2: Adventurer's Guild ---------------------------- */
  guild: {
    src:   'assets/scenes/Guild_Interior.png',
    emoji: '⚔️',
    label: "Jurnaheim Adventurer's Guild"
  },

  /* -- Act 3: Osovia Forest --------------------------------- */
  forest: {
    src:   'assets/scenes/Forest.png',
    emoji: '🌲',
    label: 'The Whispering Wilds of Osovia'
  },

  /* -- Act 3: Cave Entrance --------------------------------- */
  cave_entrance: {
    src:   'assets/scenes/Cave_Entrance.png',
    emoji: '🪨',
    label: 'Osovia Hollows — Cave Entrance'
  },

  /* -- Act 3.5: Inside the Cave ----------------------------- */
  inside_cave: {
    src:   'assets/scenes/Inside_Cave.png',
    emoji: '🕯️',
    label: 'The Descent — Inside the Cave'
  },

  /* -- Act 4 / 4.5 / 5: Cultist Room ----------------------- */
  cultist_room: {
    src:   'assets/scenes/Cultist_Room.png',
    emoji: '🔮',
    label: 'The Room of Whispers — Cultist Chamber'
  },

  /* -- Ending: Good ----------------------------------------- */
  endingGood: {
    src:   'assets/scenes/Ending_Good.png',
    emoji: '🌅',
    label: 'Ending — A Legend Is Born'
  },

  /* -- Ending: Worst ---------------------------------------- */
  endingWorst: {
    src:   'assets/scenes/Ending_Worst.png',
    emoji: '🌑',
    label: 'Ending — The Warning'
  }
};


/* ------------------------------------------------------------
   CLASS PORTRAITS
   ------------------------------------------------------------
   Each key matches a class name returned by the quiz engine.
   Fields:
     src    — path relative to index.html, or null for emoji fallback
     emoji  — shown when src is null or the image fails to load
     alt    — accessibility alt text for the <img> element

   RECOMMENDED IMAGE SPECS
     Resolution : 300 × 400 px  (portrait / 3:4 ratio)
     Format     : PNG (supports transparency) or JPG
     File size  : keep under 200 KB per portrait
   ------------------------------------------------------------ */
const PORTRAITS = {

  Wizard: {
    src:   null,
    emoji: '🧙',
    alt:   'Wizard class portrait'
  },

  Cleric: {
    src:   null,
    emoji: '⚜️',
    alt:   'Cleric class portrait'
  },

  Barbarian: {
    src:   null,
    emoji: '⚔️',
    alt:   'Barbarian class portrait'
  },

  Bard: {
    src:   null,
    emoji: '🎭',
    alt:   'Bard class portrait'
  }
};


/* ------------------------------------------------------------
   CHARACTER SPRITES
   ------------------------------------------------------------
   Ally and Enemy sprites used during encounters and combat.
   Each entry has three states: stance, attack, injured.
   Fields:
     stance   — idle/default pose
     attack   — attacking pose
     injured  — damaged/hurt pose
     alt      — accessibility alt text
   ------------------------------------------------------------ */
const CHARACTERS = {

  /* -- ALLIES ----------------------------------------------- */
  Kiave: {
    stance:  'assets/characters/allies/Kiave_Stance.png',
    attack:  'assets/characters/allies/Kiave_Attack.png',
    injured: 'assets/characters/allies/Kiave_Injured.png',
    alt:     'Kiave — Elven Scholar'
  },

  Shaira: {
    stance:  'assets/characters/allies/Shaira_Stance.png',
    attack:  'assets/characters/allies/Shaira_Attack.png',
    injured: 'assets/characters/allies/Shaira_Injured.png',
    alt:     'Shaira — Elven Fighter'
  },

  /* -- ENEMIES ---------------------------------------------- */
  Ashrag: {
    stance:  'assets/characters/enemies/Ashrag_Stance.png',
    attack:  'assets/characters/enemies/Ashrag_Attack_Stance.png',
    injured: 'assets/characters/enemies/Ashrag_Injured.png',
    alt:     'Ashrag — The God Enemy'
  },

  Bullywug: {
    stance:  'assets/characters/enemies/Bully_Stance.png',
    attack:  'assets/characters/enemies/Bully_Attack.png',
    injured: 'assets/characters/enemies/Bully_Injured.png',
    alt:     'Bullywug Enemy'
  },

  Beast: {
    stance:  'assets/characters/enemies/Beast_Stance.png',
    attack:  'assets/characters/enemies/Beast_Attack.png',
    injured: 'assets/characters/enemies/Beast_Injured.png',
    alt:     'Beast Enemy'
  },

  Barkling: {
    stance:  'assets/characters/enemies/Barkling_Stance.png',
    attack:  'assets/characters/enemies/Barkling_Attack.png',
    injured: 'assets/characters/enemies/Barkling_Injured.png',
    alt:     'Barkling Enemy'
  }
};


/* ------------------------------------------------------------
   PLAYER SPRITES
   ------------------------------------------------------------
   Organized by skin tone and gender.
   Weapon suffixes map to class:
     Sword  → Barbarian
     Staff  → Wizard / Cleric
     Codex  → Cleric / Wizard
     Lute   → Bard

   Skin tone keys: 'dark' | 'light' | 'tan'
   Gender keys:    'male' | 'female'
   ------------------------------------------------------------ */
const PLAYER_SPRITES = {

  dark: {
    male: {
      stance:         'assets/characters/player/dark/male/MalBla_Stance.png',
      sword_attack:   'assets/characters/player/dark/male/MalBla_Sword_Attack (1).png',
      sword_injured:  'assets/characters/player/dark/male/MalBla_Sword_Injured.png',
      staff_attack:   'assets/characters/player/dark/male/MalBla_Staff_Attack.png',
      staff_injured:  'assets/characters/player/dark/male/MalBla_Staff_Injured.png',
      codex_attack:   'assets/characters/player/dark/male/MalBla_Codex_Attack.png',
      codex_injured:  'assets/characters/player/dark/male/MalBla_Codex_Injured.png',
      lute_attack:    'assets/characters/player/dark/male/MalBla_Lute_Attack.png',
      lute_injured:   'assets/characters/player/dark/male/MalBla_Lute_Injured.png'
    },
    female: {
      stance:         'assets/characters/player/dark/female/FemBla_Stance.png',
      sword_attack:   'assets/characters/player/dark/female/FemBla_Sword_Attack.png',
      sword_injured:  'assets/characters/player/dark/female/FemBla_Sword_Injured.png',
      staff_attack:   'assets/characters/player/dark/female/FemBla_Staff_Attack.png',
      staff_injured:  'assets/characters/player/dark/female/FemBla_Staff_Injured.png',
      codex_attack:   'assets/characters/player/dark/female/FemBla_Codex_Attack.png',
      codex_injured:  'assets/characters/player/dark/female/FemBla_Codex_Injured.png',
      lute_attack:    'assets/characters/player/dark/female/FemBla_Lute_Attack.png',
      lute_injured:   'assets/characters/player/dark/female/FemBla_Lute_Injured.png'
    }
  },

  light: {
    male: {
      stance:         'assets/characters/player/light/male/MalLi_Stance.png',
      sword_attack:   'assets/characters/player/light/male/MalLi_Sword_Attack.png',
      sword_injured:  'assets/characters/player/light/male/MalLi_Sword_Injured.png',
      staff_attack:   'assets/characters/player/light/male/MalLi_Staff_Attack.png',
      staff_injured:  'assets/characters/player/light/male/MalLi_Staff_Injured.png',
      codex_attack:   'assets/characters/player/light/male/MalLi_Codex_Attack.png',
      codex_injured:  'assets/characters/player/light/male/MalLi_Codex_Injured.png',
      lute_attack:    'assets/characters/player/light/male/MalLi_Lute_Attack.png',
      lute_injured:   'assets/characters/player/light/male/MalLi_Lute_Injured.png'
    },
    female: {
      stance:         'assets/characters/player/light/female/FemLi_Stance.png',
      sword_attack:   'assets/characters/player/light/female/FemLi_Sword_Attack.png',
      sword_injured:  'assets/characters/player/light/female/FemLi_Sword_Injured.png',
      staff_attack:   'assets/characters/player/light/female/FemLi_Staff_Attack.png',
      staff_injured:  'assets/characters/player/light/female/FemLi_Staff_Injured.png',
      codex_attack:   'assets/characters/player/light/female/FemLi_Codex_Attack.png',
      codex_injured:  'assets/characters/player/light/female/FemLi_Codex_Injured.png',
      lute_attack:    'assets/characters/player/light/female/FemLi_Lute_Attack.png',
      lute_injured:   'assets/characters/player/light/female/FemLi_Lute_Injured.png'
    }
  },

  tan: {
    male: {
      stance:         'assets/characters/player/tan/male/MalTan_Stance.png',
      sword_attack:   'assets/characters/player/tan/male/MalTan_Sword_Attack.png',
      sword_injured:  'assets/characters/player/tan/male/MalTan_Sword_Injured.png',
      staff_attack:   'assets/characters/player/tan/male/MalTan_Staff_Attack.png',
      staff_injured:  'assets/characters/player/tan/male/MalTan_Staff_Injured.png',
      codex_attack:   'assets/characters/player/tan/male/MalTan_Codex_Attack.png',
      codex_injured:  'assets/characters/player/tan/male/MalTan_Codex_Injured.png',
      lute_attack:    'assets/characters/player/tan/male/MalTan_Lute_Attack.png',
      lute_injured:   'assets/characters/player/tan/male/MalTan_Lute_Injured.png'
    },
    female: {
      stance:         'assets/characters/player/tan/female/FemTan_Stance.png',
      sword_attack:   'assets/characters/player/tan/female/FemTan_Sword_Attack.png',
      sword_injured:  'assets/characters/player/tan/female/FemTan_Sword_Injured.png',
      staff_attack:   'assets/characters/player/tan/female/FemTan_Staff_Attack.png',
      staff_injured:  'assets/characters/player/tan/female/FemTan_Staff_Injured.png',
      codex_attack:   'assets/characters/player/tan/female/FemTan_Codex_Attack.png',
      codex_injured:  'assets/characters/player/tan/female/FemTan_Codex_Injured.png',
      lute_attack:    'assets/characters/player/tan/female/FemTan_Lute_Attack.png',
      lute_injured:   'assets/characters/player/tan/female/FemTan_Lute_Injured.png'
    }
  }
};


/* ------------------------------------------------------------
   DO NOT EDIT BELOW THIS LINE
   Helper functions consumed by engine.js
   ------------------------------------------------------------ */

/**
 * Returns the scene background src for a given scene key.
 * Returns null if no asset has been configured yet.
 * @param {string} key — key from SCENES map
 */
function getSceneSrc(key) {
  return (SCENES[key] && SCENES[key].src) ? SCENES[key].src : null;
}

/**
 * Returns the emoji fallback for a given scene key.
 * @param {string} key — key from SCENES map
 */
function getSceneEmoji(key) {
  return (SCENES[key] && SCENES[key].emoji) ? SCENES[key].emoji : '🏰';
}

/**
 * Returns the portrait src for a given class name.
 * Returns null if no asset has been configured yet.
 * @param {string} cls — class name: 'Wizard' | 'Cleric' | 'Barbarian' | 'Bard'
 */
function getPortraitSrc(cls) {
  return (PORTRAITS[cls] && PORTRAITS[cls].src) ? PORTRAITS[cls].src : null;
}

/**
 * Returns the emoji fallback for a given class.
 * @param {string} cls — class name
 */
function getPortraitEmoji(cls) {
  return (PORTRAITS[cls] && PORTRAITS[cls].emoji) ? PORTRAITS[cls].emoji : '⚔️';
}

/**
 * Returns the alt text for a given class portrait.
 * @param {string} cls — class name
 */
function getPortraitAlt(cls) {
  return (PORTRAITS[cls] && PORTRAITS[cls].alt) ? PORTRAITS[cls].alt : cls + ' portrait';
}

/**
 * Returns a character sprite src for a given character key and state.
 * @param {string} key   — key from CHARACTERS map (e.g. 'Kiave', 'Ashrag')
 * @param {string} state — 'stance' | 'attack' | 'injured'
 */
function getCharacterSrc(key, state) {
  return (CHARACTERS[key] && CHARACTERS[key][state]) ? CHARACTERS[key][state] : null;
}

/**
 * Returns a player sprite src for a given skin tone, gender, and action.
 * @param {string} skin   — 'dark' | 'light' | 'tan'
 * @param {string} gender — 'male' | 'female'
 * @param {string} action — e.g. 'stance', 'sword_attack', 'lute_injured'
 */
function getPlayerSprite(skin, gender, action) {
  const group = PLAYER_SPRITES[skin] && PLAYER_SPRITES[skin][gender];
  return (group && group[action]) ? group[action] : null;
}
