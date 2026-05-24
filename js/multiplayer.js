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
    // SCREEN: broadcast every screen transition + a fresh GameState snapshot
    const _origScreenShow = Screen.show;
    Screen.show = function(id) {
      _origScreenShow(id);
      _hostSend({ type: 'screen', id, gameState: _snapshotGameState() });
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
          if (msg.gameState) _restoreGameState(msg.gameState);
          Lobby.close();
          _showSpectatorBadge();
          break;

        case 'screen':
          if (msg.gameState) _restoreGameState(msg.gameState);
          Screen.show(msg.id);
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

  /** Host: kick off the co-op adventure for all connected players. */
  function startGame() {
    if (!Network.isHost()) return;
    _started = true;
    // Send a fresh snapshot so clients start with identical state.
    // GameState.reset() will be called by btn-begin handler too on host side.
    if (typeof GameState !== 'undefined') GameState.reset();
    Network.send({ type: 'start-game', gameState: _snapshotGameState() });
    Lobby.close();
    // Host now runs the existing single-player flow — quiz, char select,
    // story, etc. — and every transition gets broadcast via the hooks.
    Screen.show('screen-quiz');
    renderQuiz();
  }

  function isStarted() { return _started; }

  function init() {
    // Hook engine functions for broadcast (host) AND apply (client).
    _installHostHooks();
    _installClientLocks();
    // Route incoming messages from peers to our applier.
    Network.onMessage(_applyMessage);
  }

  return { init, startGame, isStarted };
})();

// Self-init — runs after every other script has loaded (this file is last
// in the index.html script order). Safe to monkey-patch everything now.
Multiplayer.init();
