/* ============================================================
   RESONATIA — js/engine.js
   Core game engine: screens, canvas, dice, dialogue, scenes
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   GAME STATE
   Shared across engine, story, and main modules
   ────────────────────────────────────────────── */
const GameState = {
  player: {
    class:   null,
    species: null,
    stats:   {},
    score:   0,
    flags:   {},
    battles: { won: 0, lost: 0 },
    scoreLog: [] // [{ label, delta }] — populated by updateScore()
  },
  quizAnswers:     { INT: 0, CHA_INT: 0, STR: 0, CHA: 0 },
  currentQuestion: 0,
  selectedSpecies: null,

  reset() {
    this.player      = { class: null, species: null, stats: {}, score: 0, flags: {},
                         battles: { won: 0, lost: 0 }, scoreLog: [] };
    this.quizAnswers = { INT: 0, CHA_INT: 0, STR: 0, CHA: 0 };
    this.currentQuestion = 0;
    this.selectedSpecies = null;
  }
};


/* ──────────────────────────────────────────────
   PARTICLE BACKGROUND CANVAS
   ────────────────────────────────────────────── */
const BGCanvas = (() => {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);
    particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        r:  Math.random() * 1.5 + 0.2,
        o:  Math.random() * 0.5 + 0.1,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(Math.random() * 0.2 + 0.05)
      });
    }
    loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < 0)             p.y = canvas.height;
      if (p.x < 0)             p.x = canvas.width;
      if (p.x > canvas.width)  p.x = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,168,76,${p.o * 0.6})`;
      ctx.fill();
    });
    requestAnimationFrame(loop);
  }

  return { init };
})();


/* ──────────────────────────────────────────────
   SCREEN MANAGER
   ────────────────────────────────────────────── */
const Screen = (() => {
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }
  return { show };
})();


/* ──────────────────────────────────────────────
   SCENE MANAGER
   Handles background images + emoji fallbacks
   ────────────────────────────────────────────── */
const Scene = (() => {
  const bgEl  = document.getElementById('scene-bg');
  const artEl = document.getElementById('scene-art');

  /**
   * Switch to a named scene.
   * @param {string} key — key from SCENES in assets.js
   */
  function set(key) {
    const src   = getSceneSrc(key);
    const emoji = getSceneEmoji(key);

    artEl.textContent = emoji;

    // Drop the prior per-scene class so CSS spot-masks reset cleanly.
    // Tracked on the element itself so we can't accidentally strip `scene-bg`
    // (the positioning class) or any other scene-prefixed utility class.
    const prev = bgEl.dataset.sceneKey;
    if (prev) bgEl.classList.remove(`scene-${prev}`);
    if (key) {
      bgEl.classList.add(`scene-${key}`);
      bgEl.dataset.sceneKey = key;
    } else {
      delete bgEl.dataset.sceneKey;
    }

    if (src) {
      // Preload to avoid flash
      const img = new Image();
      img.onload = () => {
        bgEl.style.backgroundImage = `url('${src}')`;
        bgEl.classList.add('has-image');
      };
      img.onerror = () => {
        // Asset file missing — fall back silently
        bgEl.style.backgroundImage = '';
        bgEl.classList.remove('has-image');
        console.warn(`[Resonatia] Scene asset not found: ${src}`);
      };
      img.src = src;
    } else {
      bgEl.style.backgroundImage = '';
      bgEl.classList.remove('has-image');
    }
  }

  return { set };
})();


/* ──────────────────────────────────────────────
   CHARACTER SPRITE MANAGER
   Shows ally/enemy sprites above the dialogue box
   ────────────────────────────────────────────── */
const CharSprite = (() => {
  const container = document.getElementById('char-sprites');
  const bgEl      = document.getElementById('scene-bg');

  // Active sprites: { id, el (img element) }[]
  let active = [];

  /**
   * Show one or more character sprites.
   * @param {Array<{key:string, state:string, side:string}>} defs
   *   key   — CHARACTERS key, e.g. 'Kiave', 'Ashrag', 'Bullywug'
   *   state — 'stance' | 'attack' | 'injured'
   *   side  — 'left' | 'center' | 'right'
   */
  function show(defs) {
    container.innerHTML = '';
    active = [];

    // Sprite overlay is live — enable per-scene spot masks (see style.css)
    if (bgEl) bgEl.classList.add('sprites-active');

    // Build slots map
    const slots = {};
    defs.forEach(d => { slots[d.side || 'left'] = d; });

    // Render left, center, right in order so flex layout is correct
    ['left', 'center', 'right'].forEach(side => {
      const def = slots[side];
      const slot = document.createElement('div');
      slot.className = `sprite-slot slot-${side}`;

      if (def) {
        const src = getCharacterSrc(def.key, def.state || 'stance');
        if (src) {
          const img = document.createElement('img');
          img.src   = src;
          img.alt   = def.key;
          img.id    = `sprite-${def.key}`;
          img.className = 'char-sprite' +
            (def.state === 'injured' ? ' state-injured' : '');
          slot.appendChild(img);
          active.push({ id: def.key, el: img, side });
        }
      }

      container.appendChild(slot);
    });
  }

  /** Remove all character sprites. */
  function hide() {
    container.innerHTML = '';
    active = [];
    if (bgEl) bgEl.classList.remove('sprites-active');
  }

  /**
   * Swap the sprite image for an already-visible character.
   * @param {string} key   — character key, e.g. 'Ashrag'
   * @param {string} state — 'stance' | 'attack' | 'injured'
   */
  function setState(key, state) {
    const entry = active.find(a => a.id === key);
    if (!entry || !entry.el) return;
    const src = getCharacterSrc(key, state);
    if (src) {
      entry.el.src = src;
      entry.el.classList.toggle('state-injured', state === 'injured');
    }
  }

  return { show, hide, setState };
})();


/* ──────────────────────────────────────────────
   PORTRAIT MANAGER
   Handles class portrait images + emoji fallbacks
   ────────────────────────────────────────────── */
const Portrait = (() => {
  /**
   * Render the portrait for a given class into #char-portrait.
   * @param {string} cls — class name
   */
  function set(cls) {
    const container  = document.getElementById('char-portrait');
    const emojiSpan  = document.getElementById('portrait-emoji');
    const src        = getPortraitSrc(cls);
    const emoji      = getPortraitEmoji(cls);
    const alt        = getPortraitAlt(cls);

    // Remove any previously injected <img>
    const existingImg = container.querySelector('img');
    if (existingImg) existingImg.remove();

    if (src) {
      emojiSpan.style.display = 'none';
      const img = document.createElement('img');
      img.alt = alt;
      img.src = src;
      img.onerror = () => {
        img.remove();
        emojiSpan.style.display = '';
        emojiSpan.textContent = emoji;
        console.warn(`[Resonatia] Portrait asset not found: ${src}`);
      };
      container.appendChild(img);
    } else {
      emojiSpan.style.display = '';
      emojiSpan.textContent = emoji;
    }
  }

  return { set };
})();


/* ──────────────────────────────────────────────
   DICE ENGINE
   d20 + attribute modifier vs DC
   ────────────────────────────────────────────── */
const Dice = (() => {
  const modal     = document.getElementById('dice-modal');
  const iconEl    = document.getElementById('dice-icon');
  const resultEl  = document.getElementById('dice-result');
  const breakEl   = document.getElementById('dice-breakdown');
  const outcomeEl = document.getElementById('dice-outcome');
  const contBtn   = document.getElementById('dice-continue');
  const labelEl   = document.getElementById('dice-label');

  function getMod(stat) {
    const v = GameState.player.stats[stat] || 10;
    return Math.floor((v - 10) / 2);
  }

  function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }

  /**
   * Animate and resolve a dice check.
   * @param {string}   stat      — 'STR' | 'INT' | 'CHA' | 'DEX'
   * @param {number}   dc        — Difficulty Class
   * @param {string}   label     — Flavour text shown above the dice
   * @param {Function} onSuccess — called with (isCrit: boolean)
   * @param {Function} onFail    — called with (isFumble: boolean)
   */
  function check(stat, dc, label, onSuccess, onFail) {
    modal.classList.add('open');
    labelEl.textContent    = label || 'Rolling the dice...';
    iconEl.textContent     = '🎲';
    resultEl.textContent   = '—';
    breakEl.textContent    = '';
    outcomeEl.textContent  = '';
    outcomeEl.className    = 'dice-outcome';
    contBtn.style.display  = 'none';

    let ticks = 0;
    const anim = setInterval(() => {
      ticks++;
      iconEl.classList.add('rolling');
      resultEl.textContent = Math.floor(Math.random() * 20) + 1;

      if (ticks > 18) {
        clearInterval(anim);
        iconEl.classList.remove('rolling');

        const roll    = rollD20();
        const mod     = getMod(stat);
        const total   = roll + mod;
        const modStr  = mod >= 0 ? `+${mod}` : `${mod}`;

        resultEl.textContent = total;
        breakEl.textContent  = `d20 (${roll}) ${modStr} ${stat} modifier = ${total}  ·  DC ${dc}`;
        contBtn.style.display = 'inline-block';

        let success = false;
        if (roll === 20) {
          outcomeEl.textContent = '✦ Critical Success!';
          outcomeEl.className   = 'dice-outcome critical';
          success = true;
        } else if (roll === 1) {
          outcomeEl.textContent = '☠ Critical Failure!';
          outcomeEl.className   = 'dice-outcome fumble';
          success = false;
        } else if (total >= dc) {
          outcomeEl.textContent = '✓ Success';
          outcomeEl.className   = 'dice-outcome success';
          success = true;
        } else {
          outcomeEl.textContent = '✗ Failure';
          outcomeEl.className   = 'dice-outcome failure';
          success = false;
        }

        contBtn.onclick = () => {
          modal.classList.remove('open');
          if (success) onSuccess(roll === 20);
          else         onFail(roll === 1);
        };
      }
    }, 80);
  }

  return { check };
})();


/* ──────────────────────────────────────────────
   DIALOGUE ENGINE
   Queue-based typewriter dialogue system
   ────────────────────────────────────────────── */
const Dialogue = (() => {
  let queue        = [];
  let onDone       = null;
  let choicesShown = false;
  let typing       = false;
  let currentText  = '';
  let typeInterval = null;

  const speakerEl  = document.getElementById('dialogue-speaker');
  const textEl     = document.getElementById('dialogue-text');
  const contEl     = document.getElementById('dialogue-continue');
  const choicesEl  = document.getElementById('choices-wrap');
  const boxEl      = document.getElementById('dialogue-box');

  /** Build a dialogue entry object */
  function line(speaker, text, cls) {
    return { speaker: speaker || 'Narrator', text, cls: cls || '' };
  }

  /** Begin a dialogue sequence */
  function show(entries, done) {
    queue        = [...entries];
    onDone       = done;
    choicesShown = false;
    _next();
  }

  function _next() {
    if (queue.length === 0) {
      if (onDone) onDone();
      return;
    }
    const entry = queue.shift();
    choicesEl.innerHTML  = '';
    contEl.style.display = 'block';
    speakerEl.textContent = entry.speaker.toUpperCase();
    textEl.className      = 'dialogue-text ' + entry.cls;
    _type(entry.text);
  }

  function _type(text) {
    if (typeInterval) clearInterval(typeInterval);
    textEl.textContent = '';
    currentText = text;
    typing = true;
    let i = 0;
    typeInterval = setInterval(() => {
      textEl.textContent += text[i++];
      if (i >= text.length) {
        clearInterval(typeInterval);
        typeInterval = null;
        typing = false;
      }
    }, 18);
  }

  function _skipType() {
    if (typeInterval) clearInterval(typeInterval);
    typeInterval = null;
    typing = false;
    textEl.textContent = currentText;
  }

  /** Tap on dialogue box — skip type or advance */
  boxEl.addEventListener('click', () => {
    if (choicesShown) return;
    if (typing) { _skipType(); return; }
    _next();
  });

  /** Present player choices */
  function showChoices(choices) {
    choicesEl.innerHTML  = '';
    contEl.style.display = 'none';
    choicesShown = true;
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn fade-in';
      btn.innerHTML = `<span>${c.text}</span>${
        c.dc
          ? `<span class="choice-dc">${c.stat} DC ${c.dc}</span>`
          : `<span class="choice-dc">Free</span>`
      }`;
      btn.onclick = () => {
        choicesEl.innerHTML = '';
        choicesShown = false;
        c.action();
      };
      choicesEl.appendChild(btn);
    });
  }

  return { line, show, showChoices };
})();


/* ──────────────────────────────────────────────
   SCORE HELPER
   ────────────────────────────────────────────── */
function updateScore(delta, label) {
  GameState.player.score += delta;
  // Log every score change so the end-of-game tally can show a breakdown
  if (Array.isArray(GameState.player.scoreLog)) {
    GameState.player.scoreLog.push({ label: label || 'Action', delta });
  }
  document.getElementById('hud-score').textContent = `Score: ${GameState.player.score}`;
}
