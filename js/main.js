/* ============================================================
   RESONATIA — js/main.js
   Quiz, character creation, HUD, global event listeners
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   QUIZ
   ────────────────────────────────────────────── */
function renderQuiz() {
  const q   = QUIZ[GameState.currentQuestion];
  const num = GameState.currentQuestion + 1;

  document.getElementById('quiz-progress').textContent  = `Question ${num} of ${QUIZ.length}`;
  document.getElementById('quiz-question').textContent  = q.q;

  const optsDiv = document.getElementById('quiz-options');
  optsDiv.innerHTML = '';

  q.opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className   = 'quiz-opt fade-in';
    btn.textContent = opt.text;
    btn.onclick = () => {
      GameState.quizAnswers[opt.val]++;
      GameState.currentQuestion++;
      if (GameState.currentQuestion >= QUIZ.length) showCharScreen();
      else renderQuiz();
    };
    optsDiv.appendChild(btn);
  });
}

/* ──────────────────────────────────────────────
   CHARACTER SCREEN
   ────────────────────────────────────────────── */
function showCharScreen() {
  const cls = determineClass();
  GameState.player.class = cls;

  Portrait.set(cls);
  document.getElementById('char-name').textContent     = cls;
  document.getElementById('char-subtitle').textContent = `The ${cls} — Class Determined`;
  document.getElementById('char-flavor').textContent   = CLASSES[cls].flavor;
  document.getElementById('char-stats').innerHTML      = '';
  document.getElementById('species-badges').innerHTML  = '';

  // Gender + appearance: show actual stance sprites as live previews
  const GENDERS = [
    { key: 'male',   label: 'Male'   },
    { key: 'female', label: 'Female' }
  ];
  const SKINS = [
    { key: 'light', label: 'Light' },
    { key: 'tan',   label: 'Tan'   },
    { key: 'dark',  label: 'Dark'  }
  ];

  // Default gender so the skin previews have something to render immediately.
  // The user still has to click to confirm (selected highlight only appears on click).
  if (!GameState.player.flags.gender) GameState.player.flags.gender = 'male';

  const genderGrid = document.getElementById('gender-grid');
  const skinGrid   = document.getElementById('skin-grid');

  function refreshSkinPreviews() {
    const gender = GameState.player.flags.gender || 'male';
    skinGrid.innerHTML = '';
    SKINS.forEach(s => {
      const stanceSrc = getPlayerSprite(s.key, gender, 'stance');
      const card = document.createElement('div');
      const isSelected = GameState.player.flags.skinTone === s.key;
      card.className = 'skin-card' + (isSelected ? ' selected' : '');
      card.innerHTML = `
        <div class="skin-sprite-wrap">
          ${stanceSrc
            ? `<img class="skin-sprite" src="${stanceSrc}" alt="${s.label} ${gender}" />`
            : `<div class="skin-sprite-missing">?</div>`}
        </div>
        <div class="skin-label">${s.label}</div>
      `;
      card.onclick = () => {
        document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        GameState.player.flags.skinTone = s.key;
      };
      skinGrid.appendChild(card);
    });
  }

  genderGrid.innerHTML = '';
  GENDERS.forEach(g => {
    const card = document.createElement('div');
    const isSelected = GameState.player.flags.gender === g.key;
    card.className = 'gender-card' + (isSelected ? ' selected' : '');
    card.innerHTML = `<div class="gender-label">${g.label}</div>`;
    card.onclick = () => {
      document.querySelectorAll('.gender-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      GameState.player.flags.gender = g.key;
      // Repaint skin sprites so the row reflects the chosen gender immediately
      refreshSkinPreviews();
    };
    genderGrid.appendChild(card);
  });

  refreshSkinPreviews();

  // Build species selection grid
  const grid = document.getElementById('species-grid');
  grid.innerHTML = '';

  Object.entries(SPECIES).forEach(([name, sp]) => {
    const card = document.createElement('div');
    card.className = 'species-card';
    card.innerHTML = `
      <span class="species-icon">${sp.icon}</span>
      <div class="species-name">${name}</div>
      <div class="species-bonus">${sp.bonusText}</div>
      <div class="species-desc">${sp.desc}</div>
    `;
    card.onclick = () => {
      document.querySelectorAll('.species-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      GameState.selectedSpecies = name;
      applySpeciesAndRenderStats(cls, name);
    };
    grid.appendChild(card);
  });

  Screen.show('screen-char');
}

function applySpeciesAndRenderStats(cls, species) {
  const final = computeStats(cls, species);
  GameState.player.stats   = final;
  GameState.player.species = species;

  const labels = { STR: 'Strength', INT: 'Intelligence', CHA: 'Charisma', DEX: 'Dexterity' };
  const statsDiv = document.getElementById('char-stats');
  statsDiv.innerHTML = '';

  Object.entries(final).forEach(([k, v]) => {
    const mod    = getModifier(v);
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const block  = document.createElement('div');
    block.className = 'stat-block';
    block.innerHTML = `
      <div class="stat-label">${labels[k]}</div>
      <div class="stat-val">${v} <span class="stat-mod">${modStr}</span></div>
    `;
    statsDiv.appendChild(block);
  });

  const badges = document.getElementById('species-badges');
  badges.innerHTML = `
    <span class="badge active">${SPECIES[species].icon} ${species}</span>
    <span class="badge active">${GameState.player.class}</span>
  `;
}

/* ──────────────────────────────────────────────
   GAME START
   ────────────────────────────────────────────── */
function startGame() {
  const { class: cls, species } = GameState.player;
  const portrait = getPortraitEmoji(cls);
  const spIcon   = SPECIES[species].icon;

  document.getElementById('hud-char').textContent  = `${portrait} ${cls}  ·  ${spIcon} ${species}`;
  document.getElementById('hud-score').textContent = 'Score: 0';

  Screen.show('screen-game');
  act0_monologue();
}

/* ──────────────────────────────────────────────
   EVENT LISTENERS
   ────────────────────────────────────────────── */

// Title → Quiz
document.getElementById('btn-begin').addEventListener('click', () => {
  AudioManager.stop();
  GameState.reset();
  Screen.show('screen-quiz');
  renderQuiz();
});

/* ──────────────────────────────────────────────
   USER MANUAL  (Wanderer's Codex)
   Accessible from the title screen and via H anywhere
   ────────────────────────────────────────────── */
const Manual = (() => {
  const modal     = document.getElementById('manual-modal');
  const openBtn   = document.getElementById('btn-how-to-play');
  const closeBtn  = document.getElementById('btn-manual-close');
  const backdrop  = document.getElementById('manual-backdrop');

  function open() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    // Reset scroll so a user reopening at chapter 7 doesn't start mid-page
    const wrap = modal.querySelector('.manual-wrap');
    if (wrap) wrap.scrollTop = 0;
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function isOpen() { return modal.classList.contains('open'); }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  // Global key bindings — H opens, Esc closes
  document.addEventListener('keydown', (e) => {
    // Don't hijack typing in inputs/textareas if any get added later
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close();
      return;
    }
    if ((e.key === 'h' || e.key === 'H') && !isOpen()) {
      // Skip if a battle is mid-action — avoid colliding with battle keybinds.
      // The H key isn't used by battle.js, so safe in general.
      e.preventDefault();
      open();
    }
  });

  return { open, close, isOpen };
})();

// Character screen → Game
document.getElementById('btn-enter-world').addEventListener('click', () => {
  if (!GameState.selectedSpecies) {
    alert('Please choose your species before entering Jurnaheim.');
    return;
  }
  if (!GameState.player.flags.gender) {
    alert('Please choose your gender before entering Jurnaheim.');
    return;
  }
  if (!GameState.player.flags.skinTone) {
    alert('Please choose your appearance before entering Jurnaheim.');
    return;
  }
  startGame();
});

// Ending → Title (restart)
document.getElementById('btn-restart').addEventListener('click', () => {
  GameState.reset();
  Screen.show('screen-title');
});

/* ──────────────────────────────────────────────
   GAME OVER MODAL
   Shown when the player character falls in battle —
   replaces the end-of-game assessment report.
   Story callers invoke GameOver.show(flavor?) on player death.
   ────────────────────────────────────────────── */
const GameOver = (() => {
  const modal    = document.getElementById('gameover-modal');
  const flavorEl = document.getElementById('gameover-flavor');
  const restartBtn = document.getElementById('btn-gameover-restart');

  // Pool of flavor lines — random selection adds variety on repeat deaths.
  const FLAVORS = [
    'Your story ends here, in cold silence. The runes whisper your name one last time, then forget it forever.',
    'The blade falls. The world keeps turning — but without you in it.',
    'Darkness takes you gently, as it has taken so many before. The Echo claims another name.',
    'Your journey ends in shadow. The forest of Osovia grows a little quieter tonight.',
    'You close your eyes for the last time. Somewhere, a rune flickers and goes dark.'
  ];

  function show(customFlavor) {
    flavorEl.textContent = customFlavor || FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  restartBtn.addEventListener('click', () => {
    close();
    // Stop any lingering battle/defeat music before returning to the lobby.
    if (typeof AudioManager !== 'undefined') AudioManager.stop();
    GameState.reset();
    Screen.show('screen-title');
  });

  return { show, close };
})();

/* ──────────────────────────────────────────────
   MULTIPLAYER LOBBY  (Phase 1 — connection foundation)
   Opens from the title screen "Play with Friends" button.
   Hands off connection to the Network module — no game-state
   sync yet (that's phase 2).
   ────────────────────────────────────────────── */
const Lobby = (() => {
  const modal       = document.getElementById('lobby-modal');
  const backdrop    = document.getElementById('lobby-backdrop');
  const closeBtn    = document.getElementById('btn-lobby-close');

  const choicePanel = document.getElementById('lobby-choice');
  const joinPanel   = document.getElementById('lobby-join');
  const roomPanel   = document.getElementById('lobby-room');

  const nameInput   = document.getElementById('lobby-name');
  const codeInput   = document.getElementById('lobby-code');
  const playersList = document.getElementById('lobby-players');
  const roomCodeEl  = document.getElementById('lobby-roomcode');
  const statusEl    = document.getElementById('lobby-status');

  const btnHost     = document.getElementById('btn-host-room');
  const btnJoin     = document.getElementById('btn-join-room');
  const btnConnect  = document.getElementById('btn-connect');
  const btnBack     = document.getElementById('btn-back');
  const btnLeave    = document.getElementById('btn-leave');
  const btnStartCoop = document.getElementById('btn-start-coop');

  function _showPanel(panelEl) {
    [choicePanel, joinPanel, roomPanel].forEach(p => p.classList.add('hidden'));
    panelEl.classList.remove('hidden');
  }

  function _setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function open() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    // Remember the player's name across sessions for convenience.
    nameInput.value = localStorage.getItem('resonatia-name') || '';
    codeInput.value = '';
    _setStatus('');
    // If already in a room (re-opened lobby), jump back to room panel.
    if (Network.isOnline()) {
      roomCodeEl.textContent = Network.getRoomCode() || '—';
      _refreshPlayers(Network.getPlayers());
      _showPanel(roomPanel);
    } else {
      _showPanel(choicePanel);
    }
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function _refreshPlayers(players) {
    playersList.innerHTML = '';
    players.forEach(p => {
      const li = document.createElement('li');
      if (p.isHost) li.classList.add('is-host');
      const crown = p.isHost ? ' 👑' : '';
      li.innerHTML = `<span>${p.name}${crown}</span><span class="slot-badge">SLOT ${p.slot + 1}</span>`;
      playersList.appendChild(li);
    });

    // Show "Start Adventure" only to the host AND only if there are 2+ players.
    const showStart = Network.isHost() && players.length >= 2;
    btnStartCoop.classList.toggle('hidden', !showStart);
  }

  /* ── Wire buttons ── */
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  btnHost.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { _setStatus('Enter your name first.'); nameInput.focus(); return; }
    localStorage.setItem('resonatia-name', name);
    btnHost.disabled = true;
    try {
      const code = await Network.host(name);
      roomCodeEl.textContent = code;
      _showPanel(roomPanel);
    } catch (e) {
      _setStatus('Could not create room: ' + (e.message || e));
    } finally {
      btnHost.disabled = false;
    }
  });

  btnJoin.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { _setStatus('Enter your name first.'); nameInput.focus(); return; }
    localStorage.setItem('resonatia-name', name);
    _setStatus('');
    _showPanel(joinPanel);
    setTimeout(() => codeInput.focus(), 50);
  });

  btnConnect.addEventListener('click', async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) { _setStatus('Room codes are 4 letters.'); return; }
    btnConnect.disabled = true;
    try {
      await Network.join(code, nameInput.value.trim());
      roomCodeEl.textContent = code;
      _showPanel(roomPanel);
    } catch (e) {
      _setStatus(e.message || 'Could not join.');
    } finally {
      btnConnect.disabled = false;
    }
  });

  // Enter key in code field = Connect
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnConnect.click();
  });

  btnBack.addEventListener('click', () => {
    _setStatus('');
    _showPanel(choicePanel);
  });

  btnLeave.addEventListener('click', () => {
    Network.disconnect();
    _setStatus('Left the room.');
    _showPanel(choicePanel);
  });

  btnStartCoop.addEventListener('click', () => {
    // Phase 2: host kicks off the adventure. Clients receive the start-game
    // message via Multiplayer's network hook and jump into spectator mode.
    if (!Network.isHost()) {
      _setStatus('Only the host can start the adventure.');
      return;
    }
    if (typeof Multiplayer === 'undefined') {
      _setStatus('Multiplayer module not loaded.');
      return;
    }
    Multiplayer.startGame();
  });

  /* ── Subscribe to Network events ── */
  Network.onPlayers(_refreshPlayers);
  Network.onStatus((s) => { _setStatus(s.message); });

  return { open, close };
})();

// Title screen → Lobby
document.getElementById('btn-multiplayer').addEventListener('click', () => {
  Lobby.open();
});

/* ──────────────────────────────────────────────
   BOOT
   ────────────────────────────────────────────── */
BGCanvas.init();
AudioManager.init();
// Multiplayer.init() is called from the bottom of multiplayer.js itself,
// after this script (and every other dependency) has fully loaded —
// otherwise its monkey-patches on updateScore() would be a no-op.
// Title music starts on the player's first click/keypress (browser autoplay policy
// prevents audio before any user interaction). See AudioManager._onFirstInteraction.
