/* ============================================================
   RESONATIA — js/multiplayer.js
   Phase 2: State synchronization layer

   Bridges the single-player engine (Screen, Scene, Dialogue, etc.)
   to the multiplayer network. HOST-AUTHORITATIVE:

   - HOST runs the game normally. Every transition (screen change,
     scene change, dialogue line, score update, etc.) is broadcast
     to all connected clients via Network.send().

   - CLIENTS render whatever the host broadcasts. Their inputs are
     suppressed during the story portion — they're spectators in
     Phase 2. (Phase 3 adds combat controls, Phase 4 adds dialogue
     voting.)

   The bridging is done by *monkey-patching* the existing engine
   functions, not modifying them. This keeps the single-player
   code path untouched and the multiplayer code surgically
   contained in this one file.

   Loop prevention: when a client applies a remote message (e.g.,
   calls Screen.show locally because the host told it to), the
   patched function would normally re-broadcast that change. The
   _applying flag suppresses the re-broadcast for the duration
   of the remote-driven call.
   ============================================================ */

'use strict';

const Multiplayer = (() => {

  let _applying = false;  // true while we're applying a remote message
  let _started  = false;  // has the co-op adventure started?

  /* Phase 5 — Per-player quiz/charselect runs in PER_PLAYER_MODE.
     During this phase, each player's screen drives independent quiz +
     character-select UI. The host stops broadcasting GameState (which
     would otherwise overwrite each client's local quiz progress).
     When all players have locked in their characters (or AFK-timer
     fires), the host assembles the party and broadcasts 'start-story'
     so everyone enters the narrative together. */
  let _perPlayerMode = false;
  const PER_PLAYER_SCREENS = ['screen-quiz', 'screen-char'];

  function _isPerPlayerScreen(id) {
    return PER_PLAYER_SCREENS.includes(id);
  }

  /* ── Broadcast helpers ─────────────────────────────────── */
  /** Only the host broadcasts state; clients only listen. */
  function _hostSend(msg) {
    if (!Network.isOnline() || !Network.isHost() || _applying) return;
    Network.send(msg);
  }

  /** Client → host: send a player action (used in later phases). */
  function _clientSend(msg) {
    if (!Network.isOnline() || !Network.isClient() || _applying) return;
    Network.send(msg);
  }

  /* ── Monkey-patch engine functions to broadcast on host ── */
  function _installHostHooks() {
    // SCREEN: broadcast every screen transition + a fresh GameState snapshot.
    // SPECIAL CASE: when entering screen-battle, also include the battle config
    // so clients can spawn the same combatants in spectator mode.
    const _origScreenShow = Screen.show;
    Screen.show = function(id) {
      _origScreenShow(id);
      if (id === 'screen-battle' && typeof Battle !== 'undefined') {
        const battleConfig = Battle.getActiveConfig?.();
        _hostSend({
          type: 'battle-start',
          id, gameState: _snapshotGameState(),
          config: battleConfig
        });
      } else if (_isPerPlayerScreen(id) && _perPlayerMode) {
        // Per-player phase: DO NOT broadcast screen changes for the quiz
        // or char-select. Each player drives their own progression and
        // arrives at the next screen on their own clock. A broadcast here
        // would force clients onto screens they haven't built locally.
      } else {
        _hostSend({ type: 'screen', id, gameState: _snapshotGameState() });
      }
    };

    // SCENE: broadcast scene/background changes
    const _origSceneSet = Scene.set;
    Scene.set = function(key) {
      _origSceneSet(key);
      _hostSend({ type: 'scene', key });
    };

    // DIALOGUE: broadcast both the entry list and any advance/skip
    const _origDialogShow    = Dialogue.show;
    const _origDialogChoices = Dialogue.showChoices;
    Dialogue.show = function(entries, done) {
      // Done callback can't be serialized; we record it locally so the host
      // can finish the sequence on its end. Clients just see the entries.
      _origDialogShow(entries, done);
      _hostSend({ type: 'dialogue-show', entries: _serializeEntries(entries) });
    };
    Dialogue.showChoices = function(choices) {
      _origDialogChoices(choices);
      _hostSend({ type: 'dialogue-choices', choices: _serializeChoices(choices) });
    };

    // PORTRAIT: broadcast portrait changes (character select etc.)
    const _origPortraitSet = Portrait.set;
    Portrait.set = function(cls) {
      _origPortraitSet(cls);
      _hostSend({ type: 'portrait', cls });
    };

    // SCORE: piggyback on the existing updateScore() function
    const _origUpdateScore = window.updateScore;
    if (typeof _origUpdateScore === 'function') {
      window.updateScore = function(delta, label) {
        _origUpdateScore(delta, label);
        _hostSend({
          type:  'score',
          score: GameState?.player?.score,
          delta, label
        });
      };
    }

    // Click on dialogue box → advance. Wrap the existing handler so the
    // host broadcasts "advance" and clients see the same step.
    const boxEl = document.getElementById('dialogue-box');
    if (boxEl) {
      boxEl.addEventListener('click', () => {
        // Only broadcast if the host triggered this — clients have their
        // clicks suppressed by _installClientLocks below.
        _hostSend({ type: 'dialogue-click' });
      });
    }

    /* ── COMBAT SYNC (host side) ─────────────────────────────
       Listen for the battle-update events dispatched by battle.js
       and broadcast snapshots to spectators. Throttled: at most
       one broadcast per ~80 ms so rapid mid-animation updates
       don't flood the network. */
    let _lastSnapTime = 0;
    document.addEventListener('battle-update', () => {
      if (!Network.isHost() || !Network.isOnline()) return;
      const now = Date.now();
      if (now - _lastSnapTime < 80) return;
      _lastSnapTime = now;
      const snap = Battle.snapshot?.();
      if (snap) _hostSend({ type: 'battle-state', snap });
    });

    document.addEventListener('battle-end', (e) => {
      if (!Network.isHost() || !Network.isOnline()) return;
      _hostSend({ type: 'battle-end', victory: !!e.detail?.victory });
    });

    // Wrap BattleUI.log so spectator log scrolls in lockstep with the host
    if (typeof BattleUI !== 'undefined' && BattleUI.log) {
      const _origLog = BattleUI.log;
      BattleUI.log = function(text, cls) {
        _origLog.call(BattleUI, text, cls);
        _hostSend({ type: 'battle-log', text, cls: cls || '' });
      };
    }

    // Wrap ActionTextFX.show so spectator sees the same banners
    if (typeof ActionTextFX !== 'undefined' && ActionTextFX.show) {
      const _origFx = ActionTextFX.show;
      ActionTextFX.show = function(text, type) {
        _origFx.call(ActionTextFX, text, type);
        _hostSend({ type: 'battle-fx', text, kind: type || '' });
      };
    }
  }

  /* ── Install client-side input locks + message router ──── */
  function _installClientLocks() {
    // Clients have their dialogue box click bypassed (host drives advancement).
    // We hook capture-phase so we run BEFORE the engine's own click handler.
    const boxEl = document.getElementById('dialogue-box');
    if (boxEl) {
      boxEl.addEventListener('click', (e) => {
        if (Network.isClient() && _started) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      }, true /* capture */);
    }

    // Block ALL choice buttons on client side (they show but don't trigger).
    document.addEventListener('click', (e) => {
      if (!Network.isClient() || !_started) return;
      const choiceBtn = e.target.closest('.choice-btn');
      if (choiceBtn) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  }

  /* ── Apply messages received from the host (client side) ── */
  function _applyMessage(msg /*, fromPeerId */) {
    if (!msg || !msg.type) return;

    // Wrap each application in _applying so the patched engine functions
    // don't try to re-broadcast our local re-application.
    _applying = true;
    try {
      switch (msg.type) {
        case 'start-game':
          _started = true;
          _perPlayerMode = true;
          // Reset MY game state and run the quiz LOCALLY.
          if (typeof GameState !== 'undefined') GameState.reset();
          GameState.player.flags = GameState.player.flags || {};
          Lobby.close();
          _hideSpectatorBadge();   // spectator badge shouldn't appear during per-player phase
          // Each player renders their own quiz independently.
          Screen.show('screen-quiz');
          if (typeof renderQuiz === 'function') renderQuiz();
          Phase5.beginQuizTimer();
          break;

        case 'screen':
          if (msg.gameState) _restoreGameState(msg.gameState);
          Screen.show(msg.id);
          // After the per-player phase ends, story screens come synced.
          // When the spectator badge applies (post-assembly), show it.
          if (msg.id === 'screen-game' && _started && Network.isClient()) {
            _showSpectatorBadge();
          }
          break;

        case 'screen-perplayer':
          // Host signals all clients to advance to their own per-player screen
          Screen.show(msg.id);
          if (msg.id === 'screen-quiz' && typeof renderQuiz === 'function') {
            renderQuiz();
            Phase5.beginQuizTimer();
          }
          break;

        /* ── PHASE 5 — Per-player party assembly ─────────── */
        case 'player-ready':
          Phase5.receivePlayerReady(msg.peerId, msg.character);
          break;

        case 'player-ai':
          // A player went AI/disconnected — host informs everyone
          Phase5.markAsAI(msg.peerId);
          break;

        case 'start-story':
          Phase5.applyAssembledParty(msg.party);
          _perPlayerMode = false;
          // Restore spectator badge for non-host players (story is host-driven for now)
          if (Network.isClient()) _showSpectatorBadge();
          break;

        case 'scene':
          Scene.set(msg.key);
          break;

        case 'dialogue-show':
          // Reconstruct entries from the serialized form
          Dialogue.show(msg.entries, /* done */ () => {});
          break;

        case 'dialogue-choices':
          // We pass action: () => {} since clients don't drive choices in P2.
          Dialogue.showChoices(msg.choices.map(c => ({ ...c, action: () => {} })));
          break;

        case 'dialogue-click':
          // Simulate a click on the dialogue box to advance.
          document.getElementById('dialogue-box')?.click();
          break;

        case 'portrait':
          Portrait.set(msg.cls);
          break;

        case 'score':
          if (typeof msg.score === 'number' && GameState?.player) {
            GameState.player.score = msg.score;
            const hudScore = document.getElementById('hud-score');
            if (hudScore) hudScore.textContent = `Score: ${msg.score}`;
          }
          break;

        /* ── COMBAT (spectator) ──────────────────────────── */
        case 'battle-start':
          if (msg.gameState) _restoreGameState(msg.gameState);
          if (msg.config && Battle?.startAsSpectator) {
            Battle.startAsSpectator(msg.config);
          } else {
            // Fallback if config wasn't sent — at least switch screens
            Screen.show(msg.id || 'screen-battle');
          }
          break;

        case 'battle-state':
          if (Battle?.applySnapshot) Battle.applySnapshot(msg.snap);
          break;

        case 'battle-log':
          if (typeof BattleUI !== 'undefined' && BattleUI.log) {
            BattleUI.log(msg.text, msg.cls);
          }
          break;

        case 'battle-fx':
          if (typeof ActionTextFX !== 'undefined' && ActionTextFX.show) {
            ActionTextFX.show(msg.text, msg.kind);
          }
          break;

        case 'battle-end':
          // Host's next Screen.show (back to screen-game) will arrive via
          // the regular 'screen' message and switch us out of spectator UI.
          break;
      }
    } catch (err) {
      console.warn('[multiplayer] failed to apply', msg.type, err);
    } finally {
      _applying = false;
    }
  }

  /* ── State (de)serialization ───────────────────────────── */
  /** Snapshot the bits of GameState worth syncing.
      Skips DOM refs and circular structures; safe for JSON. */
  function _snapshotGameState() {
    if (typeof GameState === 'undefined' || !GameState) return null;
    return {
      currentQuestion:  GameState.currentQuestion,
      quizAnswers:      { ...GameState.quizAnswers },
      selectedSpecies:  GameState.selectedSpecies,
      player: GameState.player ? {
        class:   GameState.player.class,
        species: GameState.player.species,
        stats:   { ...(GameState.player.stats || {}) },
        flags:   { ...(GameState.player.flags || {}) },
        score:   GameState.player.score,
        battles: { ...(GameState.player.battles || {}) }
      } : null
    };
  }

  function _restoreGameState(snap) {
    if (!snap || typeof GameState === 'undefined') return;
    if ('currentQuestion'  in snap) GameState.currentQuestion = snap.currentQuestion;
    if (snap.quizAnswers)            GameState.quizAnswers     = snap.quizAnswers;
    if ('selectedSpecies'  in snap) GameState.selectedSpecies = snap.selectedSpecies;
    if (snap.player && GameState.player) {
      Object.assign(GameState.player, snap.player);
    }
  }

  /** Dialogue entries are plain objects already — but strip anything weird. */
  function _serializeEntries(entries) {
    return (entries || []).map(e => ({
      speaker: e.speaker, text: e.text, cls: e.cls || ''
    }));
  }

  /** Choices include a function (action) that can't be sent. Strip it. */
  function _serializeChoices(choices) {
    return (choices || []).map(c => ({
      text: c.text, dc: c.dc, stat: c.stat
    }));
  }

  /* ── Spectator badge — visible reminder you're a client ── */
  function _showSpectatorBadge() {
    if (document.getElementById('mp-spectator-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'mp-spectator-badge';
    badge.textContent = '👁  SPECTATOR — host is driving the story';
    badge.style.cssText = `
      position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
      z-index: 9500; padding: 6px 14px;
      background: rgba(20, 30, 50, 0.92);
      color: #b8c8e0; font-family: 'Cinzel', serif;
      font-size: 0.72rem; letter-spacing: 0.25em; text-transform: uppercase;
      border: 1px solid rgba(140, 170, 220, 0.5);
      box-shadow: 0 4px 18px rgba(0,0,0,0.6);
      pointer-events: none;
    `;
    document.body.appendChild(badge);
  }

  function _hideSpectatorBadge() {
    document.getElementById('mp-spectator-badge')?.remove();
  }

  /* ── Public API ────────────────────────────────────────── */

  /** Host: kick off the co-op adventure for all connected players.
      Phase 5: enters PER_PLAYER_MODE — each player runs their own
      quiz and char-select locally. Once everyone is ready (or AFK
      timer fires), the assembled party launches the story. */
  function startGame() {
    if (!Network.isHost()) return;
    _started = true;
    _perPlayerMode = true;
    if (typeof GameState !== 'undefined') GameState.reset();
    // Initialize Phase 5 tracker for the host
    Phase5.beginAssembly();
    // Tell every connected client to start their own quiz
    Network.send({ type: 'start-game' });
    Lobby.close();
    // Host also runs the quiz locally — same flow as a client
    Screen.show('screen-quiz');
    renderQuiz();
    Phase5.beginQuizTimer();
  }

  function isStarted() { return _started; }

  /* ══════════════════════════════════════════════════════════
     PHASE 5 — PARTY ASSEMBLY
     Tracks each connected player's quiz/character progress and
     coordinates the transition from per-player setup → host-driven
     shared story. Handles AFK auto-pick + disconnect → AI fallback.
     ══════════════════════════════════════════════════════════ */
  const Phase5 = (() => {
    let assembled = {};          // peerId → character data (locked-in)
    let aiPlayers = {};          // peerId → true (disconnected or timed-out)
    let activeTimer = null;      // {handle, deadline, kind}
    let assemblyTimer = null;    // hard fallback: assemble after N seconds regardless

    const QUIZ_TIMEOUT_MS    = 45000;   // total time to finish the quiz
    const CHAR_TIMEOUT_MS    = 60000;   // total time to finish char select
    const ASSEMBLY_TIMEOUT_MS = 120000; // hard cap — start story even if some haven't readied

    function beginAssembly() {
      assembled = {};
      aiPlayers = {};
      // Hard timeout — even if some players never click, story launches
      // with whatever we have (rest become AI).
      if (assemblyTimer) clearTimeout(assemblyTimer);
      assemblyTimer = setTimeout(() => {
        if (Network.isHost()) _hostForceLaunch();
      }, ASSEMBLY_TIMEOUT_MS);
    }

    /* ── Local AFK timer (drives auto-pick on this player's screen) ── */
    function beginQuizTimer() {
      _startTimer(QUIZ_TIMEOUT_MS, 'Auto-finish quiz in', () => {
        _autoFinishQuiz();
      });
    }

    function beginCharTimer() {
      _startTimer(CHAR_TIMEOUT_MS, 'Auto-confirm character in', () => {
        _autoFinishChar();
      });
    }

    function _startTimer(durationMs, label, onExpire) {
      _clearTimer();
      const startTime = Date.now();
      const deadline  = startTime + durationMs;
      const timerEl   = document.getElementById('mp-timer');
      const labelEl   = document.getElementById('mp-timer-text');
      const secsEl    = document.getElementById('mp-timer-secs');
      const barEl     = document.getElementById('mp-timer-bar');
      if (!timerEl) return;

      timerEl.classList.remove('hidden', 'urgent');
      labelEl.textContent = label;
      const tick = () => {
        const remaining = Math.max(0, deadline - Date.now());
        const secs = Math.ceil(remaining / 1000);
        secsEl.textContent = secs;
        const pct = (remaining / durationMs) * 100;
        barEl.style.width = pct + '%';
        if (remaining <= 8000) timerEl.classList.add('urgent');
        if (remaining <= 0) {
          _clearTimer();
          if (onExpire) onExpire();
        }
      };
      tick();
      activeTimer = setInterval(tick, 250);
    }

    function _clearTimer() {
      if (activeTimer) { clearInterval(activeTimer); activeTimer = null; }
      const timerEl = document.getElementById('mp-timer');
      if (timerEl) { timerEl.classList.add('hidden'); timerEl.classList.remove('urgent'); }
    }

    function _autoFinishQuiz() {
      // Fill remaining questions with first option (val=0 picks first opt's val)
      while (GameState.currentQuestion < QUIZ.length) {
        const q = QUIZ[GameState.currentQuestion];
        if (q && q.opts && q.opts[0]) {
          GameState.quizAnswers[q.opts[0].val]++;
        }
        GameState.currentQuestion++;
      }
      if (typeof showCharScreen === 'function') showCharScreen();
      beginCharTimer();
    }

    function _autoFinishChar() {
      // Default character: male / light / first species if not chosen
      if (!GameState.player.flags) GameState.player.flags = {};
      if (!GameState.player.flags.gender)   GameState.player.flags.gender   = 'male';
      if (!GameState.player.flags.skinTone) GameState.player.flags.skinTone = 'light';
      if (!GameState.selectedSpecies) {
        const firstSpecies = Object.keys(SPECIES)[0];
        GameState.selectedSpecies = firstSpecies;
        if (typeof applySpeciesAndRenderStats === 'function' && GameState.player.class) {
          applySpeciesAndRenderStats(GameState.player.class, firstSpecies);
        }
      }
      lockInCharacter();
    }

    /* ── Called when local player clicks "Enter World" ── */
    function lockInCharacter() {
      _clearTimer();
      const character = {
        class:   GameState.player.class,
        species: GameState.player.species,
        flags:   { ...GameState.player.flags },
        stats:   { ...GameState.player.stats }
      };
      const myId = Network.getMyId();
      assembled[myId] = character;
      // Broadcast our readiness to everyone
      Network.send({ type: 'player-ready', peerId: myId, character });
      // Show waiting room
      _showWaitingRoom();
      // Host: check if everyone's in
      if (Network.isHost()) _checkAllReady();
    }

    function receivePlayerReady(peerId, character) {
      assembled[peerId] = character;
      _refreshWaitingRoom();
      if (Network.isHost()) _checkAllReady();
    }

    function markAsAI(peerId) {
      aiPlayers[peerId] = true;
      _refreshWaitingRoom();
      if (Network.isHost()) _checkAllReady();
    }

    function _checkAllReady() {
      const players = Network.getPlayers();
      const everyone = players.every(p => assembled[p.id] || aiPlayers[p.id]);
      if (everyone) _hostLaunchStory();
    }

    function _hostForceLaunch() {
      // Timeout: mark anyone not ready as AI, then launch
      const players = Network.getPlayers();
      players.forEach(p => {
        if (!assembled[p.id]) aiPlayers[p.id] = true;
      });
      Network.send({ type: 'player-ai', peerId: 'TIMEOUT_ALL' });
      _hostLaunchStory();
    }

    function _hostLaunchStory() {
      if (assemblyTimer) { clearTimeout(assemblyTimer); assemblyTimer = null; }
      const players = Network.getPlayers().sort((a,b) => a.slot - b.slot);
      const party = players.map(p => ({
        peerId: p.id,
        slot:   p.slot,
        name:   p.name,
        isAI:   !!aiPlayers[p.id],
        ...(assembled[p.id] || _aiCharacter())
      }));
      Network.send({ type: 'start-story', party });
      applyAssembledParty(party);
    }

    function _aiCharacter() {
      // Sensible defaults for AFK/disconnected players: balanced Cleric
      const cls = 'Cleric';
      const species = 'Human';
      const stats = (typeof computeStats === 'function')
        ? computeStats(cls, species)
        : { STR: 10, INT: 12, CHA: 14, DEX: 12 };
      return {
        class: cls,
        species: species,
        flags: { gender: 'male', skinTone: 'light' },
        stats
      };
    }

    /** All players: apply the assembled party (set my char, store party).
        Only the HOST actually calls startGame() — clients receive the
        narrative through Phase 2's screen/scene/dialogue sync. This avoids
        the broadcast loop that would happen if every player ran the story
        locally. Phase 6 will add per-player dialogue navigation. */
    function applyAssembledParty(party) {
      _clearTimer();
      _hideWaitingRoom();
      _perPlayerMode = false;
      // Set MY local character to my slot's data
      const myId = Network.getMyId();
      const me = party.find(p => p.peerId === myId);
      if (me && typeof GameState !== 'undefined') {
        GameState.player.class   = me.class;
        GameState.player.species = me.species;
        GameState.player.flags   = me.flags;
        GameState.player.stats   = me.stats;
      }
      if (typeof GameState !== 'undefined') GameState.multiplayerParty = party;
      if (Network.isHost()) {
        // IMPORTANT: use window.startGame to escape this IIFE's local scope.
        // Without `window.`, JavaScript resolves `startGame` to the LOCAL
        // Multiplayer.startGame defined a few lines above — which would
        // re-broadcast 'start-game' and snap everyone BACK to the quiz.
        // That was the "after enter world, loops back to quiz" bug.
        if (typeof window.startGame === 'function') window.startGame();
      } else {
        // Clients become spectators for the shared story (until Phase 6)
        _showSpectatorBadge();
      }
    }

    /* ── Waiting room UI ── */
    function _showWaitingRoom() {
      const el = document.getElementById('mp-waiting');
      if (el) el.classList.remove('hidden');
      _refreshWaitingRoom();
    }

    function _hideWaitingRoom() {
      const el = document.getElementById('mp-waiting');
      if (el) el.classList.add('hidden');
    }

    function _refreshWaitingRoom() {
      const list = document.getElementById('mp-waiting-players');
      if (!list) return;
      list.innerHTML = '';
      const players = Network.isOnline() ? Network.getPlayers() : [];
      players.forEach(p => {
        const li = document.createElement('li');
        const isReady = !!assembled[p.id];
        const isAI    = !!aiPlayers[p.id];
        if (isReady) li.classList.add('is-ready');
        else if (isAI) li.classList.add('is-ai');
        const status = isReady ? '✓ READY' : (isAI ? '◌ AI' : '… choosing');
        li.innerHTML = `<span>${p.name}</span><span class="mp-waiting-status">${status}</span>`;
        list.appendChild(li);
      });
    }

    return {
      beginAssembly, beginQuizTimer, beginCharTimer,
      lockInCharacter, receivePlayerReady, markAsAI,
      applyAssembledParty,
      _refreshWaitingRoom
    };
  })();

  /* Disconnect detection — when the Network roster shrinks, mark missing
     players as AI. Each player runs this listener; only the host's
     decision matters for assembly, but other clients see the AI tag too. */
  Network.onPlayers((players) => {
    if (!_started) return;
    // Compare against assembled keys — any peerId in assembled but missing from
    // players list means they disconnected. Mark them AI.
    // We need a baseline: track previously-known IDs.
    const known = Phase5._knownIds = Phase5._knownIds || new Set();
    players.forEach(p => known.add(p.id));
    known.forEach(id => {
      const stillHere = players.some(p => p.id === id);
      if (!stillHere) {
        Phase5.markAsAI(id);
        if (Network.isHost()) Network.send({ type: 'player-ai', peerId: id });
      }
    });
  });

  function init() {
    // Hook engine functions for broadcast (host) AND apply (client).
    _installHostHooks();
    _installClientLocks();
    // Route incoming messages from peers to our applier.
    Network.onMessage(_applyMessage);
  }

  /** Public hook: called from main.js btn-enter-world when in multiplayer. */
  function lockInCharacter() {
    Phase5.lockInCharacter();
  }

  /** Are we currently in the per-player setup phase (quiz/charselect)? */
  function isPerPlayerMode() { return _perPlayerMode; }

  return { init, startGame, isStarted, lockInCharacter, isPerPlayerMode };
})();

// Self-init — runs after every other script has loaded (this file is last
// in the index.html script order). Safe to monkey-patch everything now.
Multiplayer.init();
