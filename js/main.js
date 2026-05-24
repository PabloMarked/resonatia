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

// Character screen → Game (or — in multiplayer — lock in character for assembly)
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
  // Multiplayer: send our character to the party assembler and wait for others.
  // Single-player: launch the adventure normally.
  if (typeof Multiplayer !== 'undefined' && Multiplayer.isPerPlayerMode()) {
    Multiplayer.lockInCharacter();
  } else {
    startGame();
  }
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
   MULTIPLAYER LOBBY  (Phase 4 — full UX with room browser)
   Six panels: name → choice → create / join / browse → in-room.
   Username is mandatory; entry is gated on a non-empty name.
   Public rooms are registered with a P2P broker for browsing.
   ────────────────────────────────────────────── */
const Lobby = (() => {
  const modal       = document.getElementById('lobby-modal');
  const backdrop    = document.getElementById('lobby-backdrop');
  const closeBtn    = document.getElementById('btn-lobby-close');

  const namePanel   = document.getElementById('lobby-name-panel');
  const choicePanel = document.getElementById('lobby-choice');
  const createPanel = document.getElementById('lobby-create');
  const joinPanel   = document.getElementById('lobby-join');
  const browsePanel = document.getElementById('lobby-browse');
  const roomPanel   = document.getElementById('lobby-room');
  const ALL_PANELS  = [namePanel, choicePanel, createPanel, joinPanel, browsePanel, roomPanel];

  const nameInput   = document.getElementById('lobby-name');
  const codeInput   = document.getElementById('lobby-code');
  const playersList = document.getElementById('lobby-players');
  const roomCodeEl  = document.getElementById('lobby-roomcode');
  const visBadgeEl  = document.getElementById('lobby-room-vis-badge');
  const greetingEl  = document.getElementById('lobby-greeting');
  const browseList  = document.getElementById('lobby-browse-list');
  const statusEl    = document.getElementById('lobby-status');

  // Buttons
  const btnNameContinue  = document.getElementById('btn-name-continue');
  const btnCreateFlow    = document.getElementById('btn-create-flow');
  const btnJoinFlow      = document.getElementById('btn-join-flow');
  const btnBrowseFlow    = document.getElementById('btn-browse-flow');
  const btnChangeName    = document.getElementById('btn-change-name');
  const btnCreateBack    = document.getElementById('btn-create-back');
  const btnCreateConfirm = document.getElementById('btn-create-confirm');
  const btnJoinBack      = document.getElementById('btn-join-back');
  const btnConnect       = document.getElementById('btn-connect');
  const btnBrowseBack    = document.getElementById('btn-browse-back');
  const btnRefreshBrowse = document.getElementById('btn-refresh-browse');
  const btnLeave         = document.getElementById('btn-leave');
  const btnStartCoop     = document.getElementById('btn-start-coop');
  const visPublicBtn     = document.getElementById('vis-public');
  const visPrivateBtn    = document.getElementById('vis-private');

  let chosenVisibility = 'public';   // default selection on create panel

  function _showPanel(panelEl) {
    ALL_PANELS.forEach(p => p.classList.add('hidden'));
    panelEl.classList.remove('hidden');
  }

  function _setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function _getStoredName() {
    return (localStorage.getItem('resonatia-name') || '').trim();
  }

  function open() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    _setStatus('');
    // If already in a room (re-opened lobby), jump back to room panel.
    if (Network.isOnline()) {
      roomCodeEl.textContent = Network.getRoomCode() || '—';
      visBadgeEl.textContent = Network.isPublic() ? 'Public' : 'Private';
      visBadgeEl.className   = 'lobby-vis-badge ' + (Network.isPublic() ? 'is-public' : 'is-private');
      _refreshPlayers(Network.getPlayers());
      _showPanel(roomPanel);
      return;
    }
    // Otherwise gate on username
    const stored = _getStoredName();
    if (stored) {
      nameInput.value = stored;
      _showGreeting(stored);
      _showPanel(choicePanel);
    } else {
      nameInput.value = '';
      _showPanel(namePanel);
      setTimeout(() => nameInput.focus(), 80);
    }
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function _showGreeting(name) {
    greetingEl.textContent = `Welcome, ${name}.`;
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
    // Host sees "Start Adventure" as soon as the room exists (min 1 = just
    // the host themselves). The max is 4, enforced server-side in network.js
    // by rejecting the 5th joiner.
    const showStart = Network.isHost() && players.length >= 1;
    btnStartCoop.classList.toggle('hidden', !showStart);
  }

  /* ── Browse: query broker and render the public-room list ── */
  async function _refreshBrowseList() {
    browseList.innerHTML = '<div class="lobby-browse-empty">Searching for public rooms…</div>';
    const rooms = await Network.listPublicRooms();
    if (!rooms || rooms.length === 0) {
      browseList.innerHTML = '<div class="lobby-browse-empty">No public rooms found yet. Be the first to host one!</div>';
      return;
    }
    browseList.innerHTML = '';
    rooms.forEach(r => {
      const card = document.createElement('button');
      card.className = 'lobby-browse-card';
      card.innerHTML = `
        <div class="lobby-browse-name">${r.name}'s Room</div>
        <div class="lobby-browse-meta">
          <span class="lobby-browse-code">${r.code}</span>
          <span class="lobby-browse-players">${r.players}/${r.max}</span>
        </div>
      `;
      card.disabled = r.players >= r.max;
      card.onclick = () => _joinRoom(r.code);
      browseList.appendChild(card);
    });
  }

  async function _joinRoom(code) {
    btnConnect.disabled = true;
    _setStatus('');
    try {
      await Network.join(code, _getStoredName());
      roomCodeEl.textContent = code;
      visBadgeEl.textContent = Network.isPublic() ? 'Public' : 'Private';
      visBadgeEl.className   = 'lobby-vis-badge ' + (Network.isPublic() ? 'is-public' : 'is-private');
      _showPanel(roomPanel);
      // Defensive: force-refresh the player list right after panel becomes visible
      _refreshPlayers(Network.getPlayers());
    } catch (e) {
      _setStatus(e.message || 'Could not join.');
    } finally {
      btnConnect.disabled = false;
    }
  }

  /* ── Wire buttons ── */
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  // Step 1: Name entry (mandatory)
  btnNameContinue.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      _setStatus('Please enter a name to continue.');
      nameInput.focus();
      return;
    }
    if (name.length < 2) {
      _setStatus('Name must be at least 2 characters.');
      return;
    }
    localStorage.setItem('resonatia-name', name);
    _setStatus('');
    _showGreeting(name);
    _showPanel(choicePanel);
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnNameContinue.click();
  });

  // Step 2: Choice panel
  btnChangeName.addEventListener('click', () => { _setStatus(''); _showPanel(namePanel); });
  btnCreateFlow.addEventListener('click', () => { _setStatus(''); _showPanel(createPanel); });
  btnJoinFlow.addEventListener('click', () => {
    _setStatus('');
    codeInput.value = '';
    _showPanel(joinPanel);
    setTimeout(() => codeInput.focus(), 50);
  });
  btnBrowseFlow.addEventListener('click', () => {
    _setStatus('');
    _showPanel(browsePanel);
    _refreshBrowseList();
  });

  // Step 3a: Create — public/private toggle
  visPublicBtn.addEventListener('click', () => {
    chosenVisibility = 'public';
    visPublicBtn.classList.add('selected');
    visPrivateBtn.classList.remove('selected');
  });
  visPrivateBtn.addEventListener('click', () => {
    chosenVisibility = 'private';
    visPrivateBtn.classList.add('selected');
    visPublicBtn.classList.remove('selected');
  });
  btnCreateBack.addEventListener('click', () => { _setStatus(''); _showPanel(choicePanel); });
  btnCreateConfirm.addEventListener('click', async () => {
    const name = _getStoredName();
    if (!name) { _showPanel(namePanel); return; }
    btnCreateConfirm.disabled = true;
    try {
      const { code, isPublic } = await Network.host(name, { public: chosenVisibility === 'public' });
      roomCodeEl.textContent = code;
      visBadgeEl.textContent = isPublic ? 'Public' : 'Private';
      visBadgeEl.className   = 'lobby-vis-badge ' + (isPublic ? 'is-public' : 'is-private');
      _showPanel(roomPanel);
      // Defensive: force-refresh the player list right after the panel becomes
      // visible. Listener-driven updates can race against panel visibility.
      _refreshPlayers(Network.getPlayers());
    } catch (e) {
      _setStatus('Could not create room: ' + (e.message || e));
    } finally {
      btnCreateConfirm.disabled = false;
    }
  });

  // Step 3b: Join with code
  btnJoinBack.addEventListener('click', () => { _setStatus(''); _showPanel(choicePanel); });
  btnConnect.addEventListener('click', () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) { _setStatus('Room codes are 4 letters.'); return; }
    _joinRoom(code);
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnConnect.click();
  });

  // Step 3c: Browse
  btnBrowseBack.addEventListener('click', () => { _setStatus(''); _showPanel(choicePanel); });
  btnRefreshBrowse.addEventListener('click', _refreshBrowseList);

  // In-room actions
  btnLeave.addEventListener('click', () => {
    Network.disconnect();
    _setStatus('Left the room.');
    _showPanel(choicePanel);
  });
  btnStartCoop.addEventListener('click', () => {
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
