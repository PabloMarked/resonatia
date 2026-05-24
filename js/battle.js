/* ============================================================
   RESONATIA — js/battle.js
   Turn-based RPG battle system (JRPG-style UI, true d20)
   Call Battle.start(config) from story.js
   ============================================================ */

'use strict';

const Battle = (() => {

  /* ──────────────────────────────────────────────
     WEAPON ASSET MAP
  ────────────────────────────────────────────── */
  const WEAPON_SPRITES = {
    sword: 'assets/weapons/Untitled25_20260430115028.png',
    staff: 'assets/weapons/Untitled25_20260430115606.png',
    codex: 'assets/weapons/Untitled25_20260430115829.png',
    lute:  'assets/weapons/Untitled25_20260430120351.png'
  };

  /* ──────────────────────────────────────────────
     COMBAT STATS PER CLASS
  ────────────────────────────────────────────── */
  const COMBAT_STATS = {
    Wizard:    { hp: 55, stamina: 80, baseDamage: 8,  primaryStat: 'INT', weapon: 'staff', armorType: 'none',
                 skills: [{ name: 'Arcane Bolt',    cost: 20, dmgMult: 1.8, desc: 'A focused beam of raw magic.' },
                          { name: 'Mind Shatter',   cost: 35, dmgMult: 2.4, desc: 'Psychic assault — ignores armor.' }] },
    Cleric:    { hp: 65, stamina: 60, baseDamage: 7,  primaryStat: 'CHA', weapon: 'codex', armorType: 'leather',
                 skills: [{ name: 'Divine Strike',  cost: 20, dmgMult: 1.6, desc: 'Holy light sears the wicked.' },
                          { name: 'Smite',          cost: 30, dmgMult: 2.2, desc: 'Channels divine wrath.' },
                          { name: 'Mend Wounds',    cost: 25, isHeal: true, healAmt: 25, desc: 'Restore 25 HP to the most wounded ally.' }] },
    Barbarian: { hp: 90, stamina: 40, baseDamage: 12, primaryStat: 'STR', weapon: 'sword', armorType: 'leather',
                 skills: [{ name: 'Reckless Blow',  cost: 15, dmgMult: 2.0, desc: 'Massive swing — leaves you open.' },
                          { name: 'Berserker Rage', cost: 30, dmgMult: 2.8, desc: 'Pure fury for one turn.' }] },
    Bard:      { hp: 60, stamina: 70, baseDamage: 6,  primaryStat: 'CHA', weapon: 'lute',  armorType: 'none',
                 skills: [{ name: 'Dissonance',     cost: 20, dmgMult: 1.4, desc: 'A painful chord that disorients.' },
                          { name: 'Lullaby Curse',  cost: 35, dmgMult: 1.2, desc: 'Target loses next turn.' }] }
  };

  /* ──────────────────────────────────────────────
     ENEMY DATA
  ────────────────────────────────────────────── */
  const ENEMY_DATA = {
    Bullywug: { displayName: 'Bullywug',   hp: 40,  stamina: 30, baseDamage: 6,  primaryStat: 'STR', armorType: 'leather', DEX: 12 },
    Beast:    { displayName: 'Cave Beast', hp: 70,  stamina: 20, baseDamage: 10, primaryStat: 'STR', armorType: 'none',    DEX: 8  },
    Barkling: { displayName: 'Barkling',   hp: 30,  stamina: 40, baseDamage: 5,  primaryStat: 'DEX', armorType: 'none',    DEX: 14 },
    Ashrag:   { displayName: 'Ashrag',     hp: 500, stamina: 60, baseDamage: 8,  primaryStat: 'STR', armorType: 'heavy',   DEX: 8,
                skills: [
                  { name: 'Obsidian Cleave', cost: 25, dmgMult: 1.8, desc: 'A two-handed downward swing that splits stone.' },
                  { name: 'Runic Sundering', cost: 35, dmgMult: 2.4, desc: 'The runes on his blade flare — reality shudders.' }
                ] }
  };

  /* ──────────────────────────────────────────────
     ALLY DATA  (party NPCs who fight alongside the player)
  ────────────────────────────────────────────── */
  const ALLY_DATA = {
    Kiave:  { displayName: 'Kiave',  hp: 50, stamina: 55, baseDamage: 7,  primaryStat: 'INT', armorType: 'none',    DEX: 14, weapon: 'staff',
               canHeal: true,   // ally-cleric: heals self or party when wounded; also uses SP attacks
               skills: [
                 { name: 'Mend Wounds', cost: 25, isHeal: true, healAmt: 22, desc: 'Restores HP to the most wounded ally (including self).' },
                 { name: 'Arcane Bolt', cost: 20, dmgMult: 1.8, desc: 'A focused beam of raw magic.' }
               ],
               stats: { STR: 8,  INT: 16, CHA: 12, DEX: 14 } },
    Shaira: { displayName: 'Shaira', hp: 65, stamina: 45, baseDamage: 10, primaryStat: 'STR', armorType: 'leather', DEX: 12, weapon: 'sword', skills: [],
               stats: { STR: 15, INT: 10, CHA: 12, DEX: 12 } }
  };

  /* Flat damage reduction per armor type */
  const ARMOR_FLAT = { none: 0, leather: 4, heavy: 8 };

  /* ──────────────────────────────────────────────
     STATE
  ────────────────────────────────────────────── */
  let state = null;

  /* ──────────────────────────────────────────────
     COMBAT CALCULATOR — True d20
     roll 1–20: natural 20 = crit, natural 1 = fumble
     hit if total (roll + statMod + weaponMod) >= enemy AC
     AC = 10 + DEX mod + armor bonus
  ────────────────────────────────────────────── */
  const CombatCalc = {
    _statMod(val) { return Math.floor(((val || 10) - 10) / 2); },

    _weaponBonus(weapon) {
      return { sword: 2, staff: 1, codex: 1, lute: 0 }[weapon] || 0;
    },

    getAC(combatant) {
      const dex = combatant.stats?.DEX || combatant.combat?.DEX || 10;
      const dexMod = this._statMod(dex);
      // armorACBonusOverride lets the boss-armor-degradation system shrink AC live
      // (Ashrag's plates crack as he is wounded — see _checkBossArmor).
      const armorBonus = combatant.armorACBonusOverride
        ?? ({ none: 0, leather: 2, heavy: 6 }[combatant.combat?.armorType] || 0);
      return 10 + dexMod + armorBonus;
    },

    resolve(attacker, defender) {
      const roll     = Math.floor(Math.random() * 20) + 1; // true d20
      const isCrit   = roll === 20;
      const isFumble = roll === 1;

      const primaryStat = attacker.combat.primaryStat;
      const statVal     = attacker.stats?.[primaryStat] || 10;
      const statMod     = this._statMod(statVal);
      const weaponMod   = this._weaponBonus(attacker.combat.weapon);
      // Party buffs apply to BOTH the player and their NPC allies — the whole
      // party rallies together, otherwise allies miss/whiff disproportionately
      // in long fights (especially against the boss's high AC).
      const isPartySide = attacker.isPlayer || attacker.isAlly;
      const accBuff     = (isPartySide && state?.buffs?.accuracyBonus)
                          ? Math.round(state.buffs.accuracyBonus / 5) : 0;
      // Per-attacker hit bonus — used by boss escalation (Ashrag DESPERATE).
      // Pushes hit probability up without guaranteeing it — nat 1 still fumbles
      // and an unlucky low roll against a high AC can still miss.
      const hitBonus    = attacker.hitBonus || 0;

      const total    = roll + statMod + weaponMod + accBuff + hitBonus;
      const targetAC = this.getAC(defender);
      const hit      = isCrit || (!isFumble && total >= targetAC);

      if (!hit) return { hit: false, crit: false, fumble: isFumble, damage: 0, roll, total, targetAC };

      const baseDmg   = attacker.combat.baseDamage + statMod;

      // Boss-fight party buff: ×2 (+100 %) applied BEFORE armor subtraction
      // so the multiplier actually translates into damage. Active for the
      // ENTIRE boss fight — no HP gate — because the party always needs the
      // boost against Ashrag's 500 HP heavy frame.
      //
      // Why before-armor matters: a Bard (baseDamage 6, +3 STR = 9) against
      // Ashrag's flat-8 heavy armor produces 1 raw dmg. ×2 of 1 = 2. Still
      // pitiful. Applying ×2 to the base first: 9×2 = 18, minus 8 armor =
      // 10 dmg per hit. The boost finally feels meaningful.
      //
      // Scoped to PARTY vs ASHRAG specifically so other enemies/encounters
      // are untouched.
      const isPartyVsAshrag = isPartySide
                              && defender.key === 'Ashrag'
                              && defender.maxHp > 0;
      const partyBoostBoss  = isPartyVsAshrag ? 2.0 : 1.0;
      const buffedBase      = baseDmg * partyBoostBoss;

      // armorFlatOverride lets boss armor degrade live without mutating the
      // template — _checkBossArmor sets it as Ashrag crosses HP thresholds.
      const armorFlat = defender.armorFlatOverride
        ?? (ARMOR_FLAT[defender.combat?.armorType] || 0);
      const afterArmor= Math.max(1, buffedBase - armorFlat);
      const dmgMult   = (isPartySide && state?.buffs?.damageMultBonus)
                        ? state.buffs.damageMultBonus : 1;
      // Boss enrage multiplier — Ashrag's damage scales up as he is wounded.
      // Set in _checkBossEnrage when he crosses 30 % / 20 % HP thresholds.
      const enrageMult = attacker.enrageDmgMult || 1;
      const damage    = Math.floor((isCrit ? afterArmor * 2 : afterArmor) * dmgMult * enrageMult);

      return { hit: true, crit: isCrit, fumble: false, damage, roll, total, targetAC };
    },

    resolveSkill(attacker, defender, skill) {
      const base = this.resolve(attacker, defender);
      if (!base.hit) return base;
      return { ...base, damage: Math.floor(base.damage * skill.dmgMult) };
    }
  };

  /* ──────────────────────────────────────────────
     CHARACTER STATE MANAGER
  ────────────────────────────────────────────── */
  const CharState = {
    INJURED_THRESHOLD: 0.30,

    build(key, isPlayer, isAlly, skinTone, gender, overrides = {}) {
      let template;
      if (isPlayer) {
        template = { ...COMBAT_STATS[key], stats: { ...GameState.player.stats } };
      } else if (isAlly) {
        template = { ...ALLY_DATA[key] };
      } else {
        template = { ...ENEMY_DATA[key] };
      }

      const displayName = isPlayer ? key
                        : isAlly   ? (ALLY_DATA[key]?.displayName || key)
                        :            (ENEMY_DATA[key]?.displayName || key);

      return {
        key,
        isPlayer,
        isAlly: !!isAlly,
        skinTone,
        gender,
        displayName,
        hp:         overrides.hp      ?? template.hp,
        maxHp:      overrides.hp      ?? template.hp,
        stamina:    overrides.stamina ?? template.stamina,
        maxStamina: overrides.stamina ?? template.stamina,
        combat:     template,
        stats:      template.stats || GameState.player.stats,
        alive:      true,
        defending:  false,
        dazeNextTurn: false,
        spriteEl:   null,
        cardEl:     null,
        sidebarCardEl: null
      };
    },

    applyDamage(combatant, raw) {
      const actual = combatant.defending ? Math.floor(raw * 0.4) : raw;
      combatant.hp = Math.max(0, combatant.hp - actual);

      // BOSS AWAKENING — when Ashrag's HP first hits zero, she does NOT die.
      // Her body convulses, the runic core flares, and she rises again with
      // 50 HP, no armor (it has shattered completely), and devastating
      // damage. Runs BEFORE the alive=false check so she never registers as
      // killed for victory detection. Only triggers once per battle.
      if (combatant.key === 'Ashrag' && combatant.hp <= 0 && !combatant.awakened) {
        _triggerAshragAwakening(combatant);
      }

      if (combatant.hp <= 0) combatant.alive = false;
      combatant.defending = false;
      // Boss state checks run the instant Ashrag is wounded — armor degrades
      // (so the next attacker in the same turn benefits) AND the enrage tier
      // is announced immediately (so the player knows what's coming on his
      // turn). Both are safe no-ops for non-Ashrag combatants. Skipped after
      // awakening since those systems are intentionally locked at that point.
      if (combatant.key === 'Ashrag' && combatant.alive && !combatant.awakened) {
        _checkBossArmor(combatant);
        _checkBossEnrage(combatant);
      }
      return actual;
    },

    drainStamina(combatant, cost) {
      combatant.stamina = Math.max(0, combatant.stamina - cost);
    },

    regenStamina(combatant, amount = 8) {
      combatant.stamina = Math.min(combatant.maxStamina, combatant.stamina + amount);
    },

    autoSprite(combatant) {
      if (!combatant.alive) {
        BattleUI.setSpriteState(combatant, 'injured');
        if (combatant.spriteEl) combatant.spriteEl.classList.add('dead');
        return;
      }
      const ratio = combatant.hp / combatant.maxHp;
      BattleUI.setSpriteState(combatant, ratio <= this.INJURED_THRESHOLD ? 'injured' : 'stance');
    }
  };

  /* ──────────────────────────────────────────────
     BATTLE UI CONTROLLER — Cinematic JRPG
  ────────────────────────────────────────────── */
  const BattleUI = {
    _el(id) { return document.getElementById(id); },

    /* ── Background ── */
    setBackground(sceneKey) {
      const bgEl = this._el('btl-bg');
      const src  = typeof getSceneSrc === 'function' ? getSceneSrc(sceneKey) : null;
      if (src) bgEl.style.backgroundImage = `url('${src}')`;
      else     bgEl.style.backgroundImage = '';
    },

    /* ── HP pip renderer (party diamonds + enemy nameplates) ── */
    _renderPips(containerId, hp, maxHp, isParty) {
      const el = document.getElementById(containerId);
      if (!el) return;
      const NUM         = isParty ? 10 : 8;
      const ratio       = maxHp > 0 ? hp / maxHp : 0;
      const filledCount = Math.ceil(ratio * NUM);
      el.innerHTML = '';
      for (let i = 0; i < NUM; i++) {
        const pip     = document.createElement('div');
        const isFilled = i < filledCount;
        if (isParty) {
          pip.className = 'btl-pip' + (isFilled ? ' filled' : '');
          if (isFilled && ratio <= 0.3) pip.classList.add('low');
        } else {
          pip.className = 'combatant-pip' + (isFilled ? ' filled' : '');
          if (isFilled && ratio > 0.5) pip.classList.add('high');
        }
        el.appendChild(pip);
      }
    },

    /* ── Party diamond card (sidebar) ── */
    buildDiamondCard(combatant) {
      const card = document.createElement('div');
      card.className = 'btl-diamond-card';
      card.id = `diamond-${combatant.uid}`;
      combatant.sidebarCardEl = card;

      card.innerHTML = `
        <div class="btl-diamond-name">${combatant.displayName}</div>
        <div class="btl-diamond-sub">${combatant.combat.weapon || ''}</div>
        <div class="btl-bar-row">
          <span class="btl-bar-label">HP</span>
          <div class="btl-bar-track">
            <div class="btl-bar-fill btl-bar-fill--hp high" id="diamond-hp-${combatant.uid}" style="width:100%"></div>
          </div>
          <span class="btl-bar-val" id="diamond-hpv-${combatant.uid}">${combatant.hp}/${combatant.maxHp}</span>
        </div>
        <div class="btl-bar-row">
          <span class="btl-bar-label">SP</span>
          <div class="btl-bar-track">
            <div class="btl-bar-fill btl-bar-fill--sp" id="diamond-sp-${combatant.uid}" style="width:100%"></div>
          </div>
          <span class="btl-bar-val" id="diamond-spv-${combatant.uid}">${combatant.stamina}</span>
        </div>
      `;
      return card;
    },

    /* ── Battlefield card: party member (sprite only) ── */
    buildPlayerFieldCard(combatant) {
      const card = document.createElement('div');
      card.className = 'combatant-card';
      card.id = `card-${combatant.key}-p`;
      combatant.cardEl = card;

      const img = document.createElement('img');
      img.className = 'combatant-sprite';
      img.alt = combatant.displayName;
      img.src = this._getSpriteSrc(combatant, 'stance');
      combatant.spriteEl = img;
      card.appendChild(img);

      return card;
    },

    /* ── Battlefield card: enemy (nameplate + HP bar + sprite) ── */
    buildEnemyCard(combatant) {
      const card = document.createElement('div');
      card.className = 'combatant-card';
      card.id = `card-${combatant.uid}`;
      combatant.cardEl = card;

      const plate = document.createElement('div');
      plate.className = 'combatant-nameplate';
      plate.innerHTML = `
        <div class="combatant-name">${combatant.displayName}</div>
        <div class="combatant-plate-stats">
          <div class="combatant-hp-track">
            <div class="combatant-hp-fill" id="enemy-hpfill-${combatant.uid}" style="width:100%"></div>
          </div>
          <span class="combatant-hp-text" id="enemy-hp-${combatant.uid}">${combatant.hp}/${combatant.maxHp}</span>
        </div>
      `;

      const img = document.createElement('img');
      img.className = 'combatant-sprite';
      img.alt = combatant.displayName;
      img.src = this._getSpriteSrc(combatant, 'stance');
      combatant.spriteEl = img;

      card.appendChild(plate);
      card.appendChild(img);

      return card;
    },

    /* ── Sidebar card: enemy (name + HP bar + numeric HP) ── */
    buildEnemyDiamondCard(combatant) {
      const card = document.createElement('div');
      card.className = 'btl-diamond-card btl-diamond-card--enemy';
      card.id = `diamond-${combatant.uid}`;
      combatant.sidebarCardEl = card;

      card.innerHTML = `
        <div class="btl-diamond-name">${combatant.displayName}</div>
        <div class="btl-bar-row">
          <span class="btl-bar-label">HP</span>
          <div class="btl-bar-track">
            <div class="btl-bar-fill btl-bar-fill--hp" id="diamond-hp-${combatant.uid}" style="width:100%"></div>
          </div>
          <span class="btl-bar-val" id="diamond-hpv-${combatant.uid}">${combatant.hp}/${combatant.maxHp}</span>
        </div>
      `;
      return card;
    },

    renderField() {
      const diamonds      = this._el('btl-party-diamonds');
      const enemyDiamonds = this._el('btl-enemy-diamonds');
      const enemySide     = this._el('btl-enemy-side');
      const playerSide    = this._el('btl-player-side');
      diamonds.innerHTML      = '';
      enemyDiamonds.innerHTML = '';
      enemySide.innerHTML     = '';
      playerSide.innerHTML    = '';

      state.party.forEach(p => {
        diamonds.appendChild(this.buildDiamondCard(p));
        playerSide.appendChild(this.buildPlayerFieldCard(p));
      });

      state.enemies.forEach(e => {
        enemyDiamonds.appendChild(this.buildEnemyDiamondCard(e));
        enemySide.appendChild(this.buildEnemyCard(e));
      });
    },

    updateBars(combatant) {
      const hpPct = combatant.maxHp      > 0 ? (combatant.hp      / combatant.maxHp     ) * 100 : 0;
      const spPct = combatant.maxStamina > 0 ? (combatant.stamina / combatant.maxStamina) * 100 : 0;
      const hpLow = hpPct <= 30;
      const hpText = `${combatant.hp}/${combatant.maxHp}`;

      if (combatant.isPlayer || combatant.isAlly) {
        // Sidebar HP bar
        const hpEl  = document.getElementById(`diamond-hp-${combatant.uid}`);
        const hpvEl = document.getElementById(`diamond-hpv-${combatant.uid}`);
        if (hpEl) {
          hpEl.style.width = hpPct + '%';
          hpEl.classList.toggle('high', !hpLow);
        }
        if (hpvEl) hpvEl.textContent = hpText;

        // Sidebar SP bar
        const spEl  = document.getElementById(`diamond-sp-${combatant.uid}`);
        const spvEl = document.getElementById(`diamond-spv-${combatant.uid}`);
        if (spEl)  spEl.style.width = spPct + '%';
        if (spvEl) spvEl.textContent = combatant.stamina;

        if (combatant.sidebarCardEl) {
          combatant.sidebarCardEl.classList.toggle('dead', !combatant.alive);
        }
      } else {
        // Battlefield nameplate: HP bar + numeric HP
        const fieldFill = document.getElementById(`enemy-hpfill-${combatant.uid}`);
        const fieldTxt  = document.getElementById(`enemy-hp-${combatant.uid}`);
        if (fieldFill) {
          fieldFill.style.width = hpPct + '%';
          fieldFill.classList.toggle('low', hpLow);
        }
        if (fieldTxt) fieldTxt.textContent = hpText;

        // Sidebar enemy card: HP bar + numeric HP + dead state
        const sideFill = document.getElementById(`diamond-hp-${combatant.uid}`);
        const sideTxt  = document.getElementById(`diamond-hpv-${combatant.uid}`);
        if (sideFill) sideFill.style.width = hpPct + '%';
        if (sideTxt)  sideTxt.textContent = hpText;
        if (combatant.sidebarCardEl) {
          combatant.sidebarCardEl.classList.toggle('dead', !combatant.alive);
        }
      }
    },

    /* ── Center char-info panel (bottom) ── */
    updateCharInfo(combatant) {
      if (!combatant) return;
      const nameEl = this._el('btl-char-info-name');
      const hpBar  = this._el('btl-char-hp-bar');
      const hpVal  = this._el('btl-char-hp-val');
      const spBar  = this._el('btl-char-sp-bar');
      const spVal  = this._el('btl-char-sp-val');
      if (!nameEl) return;

      const hpPct = combatant.maxHp > 0 ? (combatant.hp / combatant.maxHp) * 100 : 0;
      const spPct = combatant.maxStamina > 0 ? (combatant.stamina / combatant.maxStamina) * 100 : 0;

      nameEl.textContent = combatant.displayName;
      if (hpBar) {
        hpBar.style.width = hpPct + '%';
        hpBar.classList.toggle('high', hpPct > 50);
      }
      if (hpVal) hpVal.textContent = `${combatant.hp}/${combatant.maxHp}`;
      if (spBar) spBar.style.width = spPct + '%';
      if (spVal) spVal.textContent = `${combatant.stamina}/${combatant.maxStamina}`;
    },

    _getSpriteSrc(combatant, stateKey) {
      if (combatant.isPlayer) {
        const skin   = combatant.skinTone || 'light';
        const gender = combatant.gender   || 'male';
        const weapon = combatant.combat.weapon || 'sword';
        if (stateKey === 'attack')  return getPlayerSprite(skin, gender, `${weapon}_attack`);
        if (stateKey === 'injured') return getPlayerSprite(skin, gender, `${weapon}_injured`);
        return getPlayerSprite(skin, gender, 'stance');
      } else {
        return getCharacterSrc(combatant.key, stateKey) || '';
      }
    },

    setSpriteState(combatant, stateKey) {
      const el = combatant.spriteEl;
      if (!el) return;
      const src = this._getSpriteSrc(combatant, stateKey);
      if (src) el.src = src;
      el.classList.toggle('state-injured', stateKey === 'injured');
      el.classList.toggle('state-attack',  stateKey === 'attack');
    },

    flashSprite(combatant) {
      const el = combatant.spriteEl;
      if (!el) return;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 400);
    },

    setActiveTurn(combatant) {
      document.querySelectorAll('.combatant-card, .btl-diamond-card').forEach(c => c.classList.remove('active-turn'));
      if (combatant?.cardEl)        combatant.cardEl.classList.add('active-turn');
      if (combatant?.sidebarCardEl) combatant.sidebarCardEl.classList.add('active-turn');
      TurnIndicator.show(combatant);
      if (combatant?.isPlayer || combatant?.isAlly) this.updateCharInfo(combatant);
    },

    showCommandMenu() {
      this._el('btl-action-bar').classList.remove('hidden');
      this._el('btl-ability-menu').classList.add('hidden');
      this._el('btl-inspect-panel').classList.add('hidden');
      this._el('btl-enemy-turn-overlay').classList.add('hidden');
      this._setCommandsEnabled(true);
    },

    hideCommandMenu() {
      this._el('btl-ability-menu').classList.add('hidden');
      this._el('btl-inspect-panel').classList.add('hidden');
      this._el('btl-enemy-turn-overlay').classList.add('hidden');
    },

    _setCommandsEnabled(enabled) {
      document.querySelectorAll('.btl-act').forEach(b => b.disabled = !enabled);
      const et = this._el('btl-end-turn');
      if (et) et.disabled = !enabled;
    },

    disableCommands() { this._setCommandsEnabled(false); },

    showEnemyTurnNotice(name) {
      this.hideCommandMenu();
      this._el('btl-action-bar').classList.add('hidden');
      const el = this._el('btl-enemy-turn-overlay');
      el.classList.remove('hidden');
      this._el('btl-enemy-turn-name').textContent = name;
    },

    setTurnIndicator(isPlayer) {
      const el = this._el('btl-turn-indicator');
      el.textContent = isPlayer ? 'YOUR TURN' : 'ENEMY TURN';
      el.classList.toggle('enemy-turn', !isPlayer);
    },

    setRound(n) {
      this._el('btl-round-counter').textContent = `Round ${n}`;
    },

    log(text, cls = '') {
      const el = this._el('btl-log');
      el.textContent = text;
      el.className   = 'btl-log ' + cls;
    },

    popDamage(combatant, amount, type = 'hit') {
      const el = combatant.spriteEl;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pop  = document.createElement('div');
      pop.className   = `dmg-popup ${type}`;
      pop.textContent = type === 'miss' ? 'MISS' : (type === 'heal' ? `+${amount}` : `-${amount}`);
      pop.style.left  = (rect.left + rect.width  / 2 - 20) + 'px';
      pop.style.top   = (rect.top  - 10) + 'px';
      document.body.appendChild(pop);
      setTimeout(() => pop.remove(), 1200);
    },

    hitFlash(type = 'red') {
      ScreenFX.flash(type);
      if (type === 'red') ScreenFX.shake();
    },

    buildSkillMenu(combatant, onSkillSelect) {
      const menu = this._el('btl-ability-menu');
      this._el('btl-action-bar').classList.add('hidden');
      menu.classList.remove('hidden');
      menu.innerHTML = '';

      (combatant.combat.skills || []).forEach(skill => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.disabled  = combatant.stamina < skill.cost;
        btn.innerHTML = `
          <span>${skill.name}</span>
          <span class="skill-cost">SP ${skill.cost}</span>
          <span class="skill-desc">${skill.desc}</span>
        `;
        btn.onclick = () => onSkillSelect(skill);
        menu.appendChild(btn);
      });

      const back = document.createElement('button');
      back.className   = 'skill-back-btn';
      back.textContent = '← Back';
      back.onclick     = () => this.showCommandMenu();
      menu.appendChild(back);
    },

    buildStatsPanel(player, enemies) {
      const panel = this._el('btl-inspect-panel');
      this._el('btl-action-bar').classList.add('hidden');
      panel.classList.remove('hidden');

      const statRows = ['STR', 'INT', 'CHA', 'DEX'].map(k => {
        const v   = player.stats[k] || 10;
        const mod = CombatCalc._statMod(v);
        return `<div class="stats-row"><span>${k}</span><span>${v} (${mod >= 0 ? '+' : ''}${mod})</span></div>`;
      }).join('');

      const ac = CombatCalc.getAC(player);
      const combatRows = `
        <div class="stats-row"><span>HP</span><span>${player.hp}/${player.maxHp}</span></div>
        <div class="stats-row"><span>SP</span><span>${player.stamina}/${player.maxStamina}</span></div>
        <div class="stats-row"><span>AC</span><span>${ac}</span></div>
        <div class="stats-row"><span>Weapon</span><span>${(player.combat.weapon || '').toUpperCase()}</span></div>
        <div class="stats-row"><span>Base Dmg</span><span>${player.combat.baseDamage}</span></div>
      `;

      const alive = enemies.filter(e => e.alive);
      const enemyRows = alive.map(e => {
        const hpPct = Math.round((e.hp / e.maxHp) * 100);
        const eAC   = CombatCalc.getAC(e);
        return `<div class="stats-row"><span>${e.displayName}</span><span>${hpPct}% · AC${eAC}</span></div>`;
      }).join('');

      panel.innerHTML = `
        <div class="stats-col">
          <div class="stats-col-title">Attributes</div>
          ${statRows}
        </div>
        <div class="stats-col">
          <div class="stats-col-title">Combat</div>
          ${combatRows}
        </div>
        <div class="stats-col">
          <div class="stats-col-title">Enemies</div>
          ${enemyRows || '<div class="stats-row"><span>None remain</span></div>'}
          <button class="stats-close-btn" id="stats-close-btn">Close</button>
        </div>
      `;

      document.getElementById('stats-close-btn').onclick = () => {
        panel.classList.add('hidden');
        this._el('btl-action-bar').classList.remove('hidden');
      };
    },

    enableTargetSelect(enemies, onSelect) {
      enemies.filter(e => e.alive).forEach(e => {
        const handler = () => {
          BattleUI.clearTargetSelect();
          onSelect(e);
        };
        if (e.cardEl) {
          e.cardEl.classList.add('target-select');
          e.cardEl.onclick = handler;
        }
        if (e.spriteEl) {
          e.spriteEl.style.cursor = 'pointer';
          e.spriteEl.onclick = handler;
        }
      });
    },

    clearTargetSelect() {
      document.querySelectorAll('.combatant-card').forEach(c => {
        c.classList.remove('target-select');
        c.onclick = null;
      });
      document.querySelectorAll('.combatant-sprite').forEach(img => {
        img.onclick = null;
        img.style.cursor = '';
      });
    }
  };

  /* ──────────────────────────────────────────────
     WEAPON ANIMATOR
  ────────────────────────────────────────────── */
  const WeaponAnimator = {
    play(attacker, target, onDone) {
      const weapon = attacker.combat.weapon || 'sword';
      const src    = WEAPON_SPRITES[weapon];
      const layer  = document.getElementById('btl-weapon-layer');
      if (!src || !layer) { onDone(); return; }

      const fromEl = attacker.spriteEl;
      const toEl   = target.spriteEl;
      if (!fromEl || !toEl) { onDone(); return; }

      const fromR  = fromEl.getBoundingClientRect();
      const toR    = toEl.getBoundingClientRect();
      const startX = fromR.left + fromR.width  / 2;
      const startY = fromR.top  + fromR.height / 2;
      const endX   = toR.left   + toR.width    / 2;
      const endY   = toR.top    + toR.height   / 2;

      const img = document.createElement('img');
      img.src   = src;
      img.className  = 'weapon-projectile';
      img.style.left = startX + 'px';
      img.style.top  = startY + 'px';

      const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
      img.style.transform = `rotate(${angle}deg)`;
      layer.appendChild(img);

      const duration  = 280;
      const startTime = performance.now();

      function step(now) {
        const t    = Math.min((now - startTime) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        img.style.left = (startX + (endX - startX) * ease) + 'px';
        img.style.top  = (startY + (endY - startY) * ease) + 'px';
        if (t < 1) { requestAnimationFrame(step); } else { img.remove(); onDone(); }
      }
      requestAnimationFrame(step);
    }
  };

  /* ──────────────────────────────────────────────
     TURN INDICATOR  — floating ▼ above active sprite
  ────────────────────────────────────────────── */
  const TurnIndicator = {
    _el() { return document.getElementById('btl-turn-triangle'); },

    show(combatant) {
      const tri = this._el();
      if (!tri) return;
      const spriteEl = combatant?.spriteEl;
      if (!spriteEl) { tri.classList.add('hidden'); return; }

      const rect = spriteEl.getBoundingClientRect();
      tri.style.left = (rect.left + rect.width / 2) + 'px';
      tri.style.top  = (rect.top - 20) + 'px';
      tri.className  = 'btl-turn-triangle';
      if (combatant.isAlly)        tri.classList.add('ally-turn');
      else if (!combatant.isPlayer) tri.classList.add('enemy-turn');
    },

    hide() {
      const tri = this._el();
      if (tri) tri.classList.add('hidden');
    }
  };

  /* ──────────────────────────────────────────────
     ACTION TEXT FX  — center flash: ATTACK! / CRITICAL! / MISS!
  ────────────────────────────────────────────── */
  const ActionTextFX = {
    _timer: null,

    show(text, type = '') {
      const el = document.getElementById('btl-action-text');
      if (!el) return;

      if (this._timer) { clearTimeout(this._timer); }
      el.classList.add('hidden');           // hide so the next remove triggers fade-in fresh
      el.className = 'btl-action-text hidden' + (type ? ` type-${type}` : '');
      el.textContent = text;

      // Force reflow so the next class change restarts the CSS animation
      void el.offsetWidth;

      el.classList.remove('hidden');
      this._timer = setTimeout(() => el.classList.add('hidden'), 800);
    }
  };

  /* ──────────────────────────────────────────────
     SCREEN FX  — shake + colored flash
  ────────────────────────────────────────────── */
  const ScreenFX = {
    shake() {
      const el = document.getElementById('screen-battle');
      if (!el) return;
      el.classList.remove('screen-shake');
      void el.offsetWidth;
      el.classList.add('screen-shake');
      setTimeout(() => el.classList.remove('screen-shake'), 400);
    },

    flash(type = 'red') {
      const el = document.getElementById('btl-flash');
      if (!el) return;
      el.classList.add(type === 'red' ? 'flash-red' : 'flash-gold');
      setTimeout(() => el.classList.remove('flash-red', 'flash-gold'), 160);
    }
  };

  /* ──────────────────────────────────────────────
     CINEMATIC ANIMATOR  — slide sprite toward enemy, then return
  ────────────────────────────────────────────── */
  const CinematicAnimator = {
    moveToEnemy(attacker, target, onContact) {
      const fromEl = attacker.spriteEl;
      const toEl   = target.spriteEl;
      if (!fromEl || !toEl) { onContact(); return; }

      const fromR  = fromEl.getBoundingClientRect();
      const toR    = toEl.getBoundingClientRect();
      const dx     = (toR.left + toR.width / 2) - (fromR.left + fromR.width / 2);
      const dy     = (toR.top  + toR.height / 2) - (fromR.top  + fromR.height / 2);

      // Move 80% of the way to the target
      const tx = dx * 0.8;
      const ty = dy * 0.8;

      fromEl.style.transition = 'transform 0.18s ease-in';
      fromEl.style.transform  = `translate(${tx}px, ${ty}px)`;

      setTimeout(() => { onContact(); }, 190);
    },

    returnToBase(attacker, onDone) {
      const el = attacker?.spriteEl;
      if (!el) { if (onDone) onDone(); return; }
      el.style.transition = 'transform 0.22s ease-out';
      el.style.transform  = 'translate(0, 0)';
      setTimeout(() => {
        el.style.transition = '';
        el.style.transform  = '';
        if (onDone) onDone();
      }, 230);
    }
  };

  /* ──────────────────────────────────────────────
     TRAIL CANVAS  — weapon-specific stroke effects
  ────────────────────────────────────────────── */
  const TrailCanvas = {
    _canvas: null,
    _ctx: null,
    _anim: null,

    _init() {
      if (this._canvas) return;
      this._canvas = document.getElementById('btl-trail-canvas');
      if (!this._canvas) return;
      this._canvas.width  = window.innerWidth;
      this._canvas.height = window.innerHeight;
      this._ctx = this._canvas.getContext('2d');
    },

    draw(weapon, attacker, target) {
      this._init();
      const ctx = this._ctx;
      if (!ctx) return;

      const fromEl = attacker.spriteEl;
      const toEl   = target.spriteEl;
      if (!fromEl || !toEl) return;

      const fromR = fromEl.getBoundingClientRect();
      const toR   = toEl.getBoundingClientRect();
      const cx    = toR.left + toR.width  / 2;
      const cy    = toR.top  + toR.height / 2;

      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

      if (weapon === 'sword') {
        // Diagonal slash arc
        ctx.save();
        ctx.strokeStyle = 'rgba(201,168,76,0.9)';
        ctx.lineWidth   = 3;
        ctx.shadowColor = 'rgba(201,168,76,0.6)';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(cx - 50, cy - 50);
        ctx.lineTo(cx + 50, cy + 50);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.moveTo(cx - 48, cy - 46);
        ctx.lineTo(cx + 48, cy + 46);
        ctx.stroke();
        ctx.restore();

      } else if (weapon === 'staff') {
        // Radial burst rings
        ctx.save();
        for (let r = 20; r <= 55; r += 17) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100,180,255,${0.8 - r * 0.01})`;
          ctx.lineWidth   = 2;
          ctx.shadowColor = 'rgba(100,180,255,0.5)';
          ctx.shadowBlur  = 10;
          ctx.stroke();
        }
        ctx.restore();

      } else if (weapon === 'codex') {
        // Vertical light columns
        ctx.save();
        [-30, 0, 30].forEach(ox => {
          const grd = ctx.createLinearGradient(cx + ox, cy - 60, cx + ox, cy + 60);
          grd.addColorStop(0,   'rgba(220,200,255,0)');
          grd.addColorStop(0.5, 'rgba(180,140,255,0.85)');
          grd.addColorStop(1,   'rgba(220,200,255,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(cx + ox - 4, cy - 60, 8, 120);
        });
        ctx.restore();

      } else if (weapon === 'lute') {
        // Sound wave rings
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const r = 25 + i * 20;
          ctx.beginPath();
          ctx.arc(cx, cy, r, -0.5, 0.5);
          ctx.strokeStyle = `rgba(255,200,100,${0.9 - i * 0.25})`;
          ctx.lineWidth   = 2 - i * 0.3;
          ctx.shadowColor = 'rgba(255,200,100,0.5)';
          ctx.shadowBlur  = 8;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Fade out over 400ms
      if (this._anim) cancelAnimationFrame(this._anim);
      const start = performance.now();
      const fade  = (now) => {
        const t = Math.min((now - start) / 420, 1);
        ctx.globalAlpha = 1 - t;
        if (t < 1) { this._anim = requestAnimationFrame(fade); }
        else { ctx.clearRect(0, 0, this._canvas.width, this._canvas.height); ctx.globalAlpha = 1; }
      };
      this._anim = requestAnimationFrame(fade);
    },

    clear() {
      if (this._ctx && this._canvas) {
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
    }
  };

  /* ──────────────────────────────────────────────
     DICE BRIDGE
     Computes true d20 result first, then patches
     Math.random so the visual animation shows the
     actual roll number — no bias, just display sync.
  ────────────────────────────────────────────── */
  const DiceBridge = {
    roll(attacker, defender, skill, onDone) {
      const result = skill
        ? CombatCalc.resolveSkill(attacker, defender, skill)
        : CombatCalc.resolve(attacker, defender);

      const stat  = attacker.combat.primaryStat;
      const label = skill ? `${skill.name} — Skill Roll` : `${attacker.displayName} Attacks!`;

      // Patch Math.random so the d20 animation lands on the real roll
      const _orig = Math.random;
      let patches  = 0;
      Math.random = function() {
        patches++;
        if (patches > 18) {
          Math.random = _orig;
          return (result.roll - 1) / 20; // maps to exact visual roll
        }
        return _orig();
      };

      // Adjust DC so Dice.check display shows success/fail matching real outcome.
      // Dice.check computes: total = roll + statMod, success if total >= DC
      // Our real condition: roll + statMod + weaponMod + accBuff >= targetAC
      // → adjustedDC = targetAC - weaponMod - accBuff
      const weaponMod = CombatCalc._weaponBonus(attacker.combat.weapon);
      const accBuff   = (attacker.isPlayer && state?.buffs?.accuracyBonus)
                        ? Math.round(state.buffs.accuracyBonus / 5) : 0;
      const adjustedDC = result.targetAC - weaponMod - accBuff;

      Dice.check(stat, adjustedDC, label,
        () => onDone(result),
        () => onDone(result)  // both callbacks pass the pre-computed result
      );
    }
  };

  /* ──────────────────────────────────────────────
     TURN MANAGER
  ────────────────────────────────────────────── */
  const TurnMgr = {
    nextTurn() {
      if (!state) return;

      const alive  = state.enemies.filter(e => e.alive);
      const player = state.party[0];

      if (alive.length === 0)         { _endBattle(true);  return; }
      // Game over is tied to the PLAYER specifically — if the main
      // character falls, the run is over even if allies are still standing.
      if (!player || !player.alive)   { _endBattle(false); return; }

      const isFirstTurn = state.turnIndex === -1;
      state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;

      let safety = 0;
      while (!state.turnOrder[state.turnIndex].alive && safety < 20) {
        state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
        safety++;
      }

      // Increment round on every wrap-around to index 0 EXCEPT the very first turn
      if (state.turnIndex === 0 && !isFirstTurn) {
        state.round++;
        BattleUI.setRound(state.round);
        [...state.party, ...state.enemies].forEach(c => {
          if (c.alive) CharState.regenStamina(c, 8);
          BattleUI.updateBars(c);
        });
      }

      const current = state.turnOrder[state.turnIndex];
      BattleUI.setActiveTurn(current);

      if (current.isPlayer)    { _playerTurn(current); }
      else if (current.isAlly) { _allyTurn(current);  }
      else                     { _enemyTurn(current); }
    },

    begin() {
      const order  = [];
      const maxLen = Math.max(state.party.length, state.enemies.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < state.party.length)   order.push(state.party[i]);
        if (i < state.enemies.length) order.push(state.enemies[i]);
      }
      state.turnOrder = order;
      state.turnIndex = -1;
      this.nextTurn();
    }
  };

  /* ──────────────────────────────────────────────
     ALLY TURN  (automated d20, no dice UI)
  ────────────────────────────────────────────── */
  function _allyTurn(ally) {
    BattleUI.log(`${ally.displayName} moves to attack!`);
    BattleUI.setActiveTurn(ally);

    setTimeout(() => {
      const targets = state.enemies.filter(e => e.alive);
      if (targets.length === 0) { TurnMgr.nextTurn(); return; }

      // Cleric-type ally: if any party member (themselves included) is below 40 % HP,
      // heal them instead of attacking. The wounded list already contains `ally`
      // because state.party includes them — so self-heal falls out naturally.
      const isClericAlly = ally.combat.weapon === 'codex' || !!ally.combat.canHeal;
      const healSkill = ally.combat.skills?.find(s => s.isHeal);

      if (isClericAlly) {
        const wounded = state.party.filter(p => p.alive && (p.hp / p.maxHp) < 0.4);
        // Only heal if we have a heal skill AND can afford it; otherwise fall through to attack.
        if (wounded.length > 0 && healSkill && ally.stamina >= healSkill.cost) {
          const healTarget = wounded.reduce((a, b) => (a.hp / a.maxHp) <= (b.hp / b.maxHp) ? a : b);
          _allyHeal(ally, healTarget, healSkill);
          return;
        }
      }

      // SP attack selection — ally picks a random affordable offensive skill ~40 % of
      // the time, otherwise basic attack. Heal skills are excluded; they only fire
      // through the wounded check above.
      const offensiveSkills = (ally.combat.skills || []).filter(s => !s.isHeal && ally.stamina >= s.cost);
      const useSkill = offensiveSkills.length > 0 && Math.random() < 0.40;
      const skill = useSkill ? offensiveSkills[Math.floor(Math.random() * offensiveSkills.length)] : null;
      if (skill) CharState.drainStamina(ally, skill.cost);

      const target = targets[Math.floor(Math.random() * targets.length)];
      const weapon = ally.combat.weapon || 'sword';

      BattleUI.setSpriteState(ally, 'attack');
      ActionTextFX.show(skill ? skill.name.toUpperCase() : `${ally.displayName} attacks!`.toUpperCase());

      setTimeout(() => {
        const result = skill
          ? CombatCalc.resolveSkill(ally, target, skill)
          : CombatCalc.resolve(ally, target);

        CinematicAnimator.moveToEnemy(ally, target, () => {
          TrailCanvas.draw(weapon, ally, target);
          WeaponAnimator.play(ally, target, () => {
            if (result.hit) {
              const actual = CharState.applyDamage(target, result.damage);
              BattleUI.setSpriteState(target, 'attack');
              BattleUI.flashSprite(target);
              BattleUI.hitFlash(result.crit ? 'gold' : 'red');
              BattleUI.popDamage(target, actual, result.crit ? 'crit' : 'hit');
              if (result.crit) ActionTextFX.show('CRITICAL!', 'crit');

              const msg = skill
                ? `${ally.displayName} unleashes ${skill.name} on ${target.displayName} for ${actual}!`
                : result.crit
                  ? `${ally.displayName} CRITS ${target.displayName} for ${actual}!`
                  : `${ally.displayName} strikes ${target.displayName} for ${actual}.`;
              BattleUI.log(msg, (skill || result.crit) ? 'crit' : '');

              CinematicAnimator.returnToBase(ally, () => {
                CharState.autoSprite(target);
                CharState.autoSprite(ally);
                BattleUI.updateBars(target);
                BattleUI.updateBars(ally);
                setTimeout(() => TurnMgr.nextTurn(), 600);
              });
            } else {
              BattleUI.popDamage(target, 0, 'miss');
              BattleUI.log(`${ally.displayName} misses!`, 'miss');
              ActionTextFX.show('MISS!', 'miss');
              CinematicAnimator.returnToBase(ally, () => {
                CharState.autoSprite(ally);
                setTimeout(() => TurnMgr.nextTurn(), 600);
              });
            }
          });
        });
      }, 500);
    }, 400);
  }

  /* ──────────────────────────────────────────────
     ALLY HEAL (Cleric NPC — auto)
  ────────────────────────────────────────────── */
  function _allyHeal(ally, target, skill) {
    // Drain SP for the heal skill — cleric must pay the cost just like the player would.
    if (skill?.cost) CharState.drainStamina(ally, skill.cost);
    const healAmt = skill?.healAmt || 20;
    target.hp = Math.min(target.maxHp, target.hp + healAmt);

    const msg = target === ally
      ? `${ally.displayName} channels divine light upon themselves, restoring ${healAmt} HP!`
      : `${ally.displayName} channels divine light, healing ${target.displayName} for ${healAmt} HP!`;
    BattleUI.log(msg, 'heal');
    BattleUI.setSpriteState(ally, 'attack');
    ActionTextFX.show('MEND!', 'heal');
    BattleUI.popDamage(target, healAmt, 'heal');

    CharState.autoSprite(ally);
    CharState.autoSprite(target);
    BattleUI.updateBars(target);
    BattleUI.updateBars(ally);
    BattleUI.updateCharInfo(target);
    BattleUI.updateCharInfo(ally);

    setTimeout(() => TurnMgr.nextTurn(), 1000);
  }

  /* ──────────────────────────────────────────────
     PLAYER TURN
  ────────────────────────────────────────────── */
  function _playerTurn(player) {
    if (player.dazeNextTurn) {
      player.dazeNextTurn = false;
      BattleUI.log(`${player.displayName} is dazed and loses their turn!`, 'miss');
      setTimeout(() => TurnMgr.nextTurn(), 1800);
      return;
    }

    BattleUI.setTurnIndicator(true);
    BattleUI.showCommandMenu();
    BattleUI.log('Choose your action.');

    // Action callbacks
    const doAttack = () => _playerAttack(player, null);
    const doAbility = () => BattleUI.buildSkillMenu(player, skill => _playerAttack(player, skill));
    const doDefend = () => {
      player.defending = true;
      BattleUI.disableCommands();
      BattleUI.log(`${player.displayName} takes a defensive stance. Incoming damage halved.`);
      setTimeout(() => TurnMgr.nextTurn(), 1200);
    };
    const doInspect = () => BattleUI.buildStatsPanel(player, state.enemies);
    const doWait = () => {
      BattleUI.disableCommands();
      BattleUI.log(`${player.displayName} waits and catches their breath.`);
      setTimeout(() => TurnMgr.nextTurn(), 1000);
    };

    // Button bindings
    document.getElementById('bact-strike').onclick  = doAttack;
    document.getElementById('bact-ability').onclick = doAbility;
    document.getElementById('bact-defend').onclick  = doDefend;
    document.getElementById('bact-inspect').onclick = doInspect;
    document.getElementById('bact-wait').onclick    = doWait;
    document.getElementById('btl-end-turn').onclick = doWait;

    // Keyboard shortcuts
    if (state._keyHandler) document.removeEventListener('keydown', state._keyHandler);
    state._keyHandler = (e) => {
      const bar = document.getElementById('btl-action-bar');
      if (!bar || bar.classList.contains('hidden')) return;
      switch (e.key.toUpperCase()) {
        case 'Q': doAttack();  break;
        case 'E': doAbility(); break;
        case 'R': doDefend();  break;
        case 'I': doInspect(); break;
        case 'F': doWait();    break;
      }
    };
    document.addEventListener('keydown', state._keyHandler);
  }

  function _playerAttack(player, skill) {
    BattleUI.disableCommands();
    BattleUI.hideCommandMenu();

    // Heal skills bypass the enemy-target flow entirely — instead the player
    // freely picks a heal target from the living party (self or any ally).
    if (skill && skill.isHeal) {
      const aliveParty = state.party.filter(p => p.alive);
      if (aliveParty.length <= 1) {
        // Only the player is alive — heal self automatically (no picker needed)
        _executePlayerHeal(player, player, skill);
      } else {
        BattleUI.log('Choose a heal target — click yourself or an ally.');
        BattleUI.enableTargetSelect(aliveParty, healTarget => {
          _executePlayerHeal(player, healTarget, skill);
        });
      }
      return;
    }

    const targets = state.enemies.filter(e => e.alive);
    if (targets.length === 0) { TurnMgr.nextTurn(); return; }

    if (targets.length === 1) {
      _executePlayerAttack(player, targets[0], skill);
    } else {
      BattleUI.log('Select a target — click an enemy.');
      BattleUI.enableTargetSelect(targets, target => {
        _executePlayerAttack(player, target, skill);
      });
    }
  }

  function _executePlayerAttack(player, target, skill) {
    if (skill) CharState.drainStamina(player, skill.cost);

    BattleUI.setSpriteState(player, 'attack');
    BattleUI.setActiveTurn(player);

    const weapon = player.combat.weapon || 'sword';
    ActionTextFX.show(skill ? skill.name.toUpperCase() : 'ATTACK!');

    const result = skill
      ? CombatCalc.resolveSkill(player, target, skill)
      : CombatCalc.resolve(player, target);

    CinematicAnimator.moveToEnemy(player, target, () => {
      TrailCanvas.draw(weapon, player, target);
      WeaponAnimator.play(player, target, () => {
        if (result.hit) {
          const actual = CharState.applyDamage(target, result.damage);
          BattleUI.setSpriteState(target, 'attack');
          BattleUI.flashSprite(target);
          BattleUI.hitFlash(result.crit ? 'gold' : 'red');
          BattleUI.popDamage(target, actual, result.crit ? 'crit' : 'hit');
          if (result.crit) ActionTextFX.show('CRITICAL!', 'crit');

          const msg = result.crit
            ? `CRITICAL HIT! ${player.displayName} deals ${actual} damage! (rolled 20)`
            : `${player.displayName} hits ${target.displayName} for ${actual} dmg. (${result.roll}+mods=${result.total} vs AC${result.targetAC})`;
          BattleUI.log(msg, result.crit ? 'crit' : '');

          CinematicAnimator.returnToBase(player, () => {
            CharState.autoSprite(target);
            CharState.autoSprite(player);
            BattleUI.updateBars(target);
            BattleUI.updateBars(player);
            BattleUI.updateCharInfo(player);
            if (skill?.name === 'Lullaby Curse') target.dazeNextTurn = true;
            setTimeout(() => TurnMgr.nextTurn(), 700);
          });
        } else {
          const reason = result.fumble
            ? `FUMBLE! ${player.displayName} trips! (rolled 1)`
            : `${player.displayName} misses! (${result.roll}+mods=${result.total} vs AC${result.targetAC})`;
          BattleUI.popDamage(target, 0, 'miss');
          BattleUI.log(reason, 'miss');
          ActionTextFX.show('MISS!', 'miss');
          CinematicAnimator.returnToBase(player, () => {
            CharState.autoSprite(player);
            BattleUI.updateBars(player);
            setTimeout(() => TurnMgr.nextTurn(), 700);
          });
        }
      });
    });
  }

  /* ──────────────────────────────────────────────
     PLAYER HEAL (Cleric — Mend Wounds)
  ────────────────────────────────────────────── */
  function _executePlayerHeal(player, healTarget, skill) {
    CharState.drainStamina(player, skill.cost);

    const healAmt = skill.healAmt || 20;
    healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmt);

    BattleUI.setSpriteState(player, 'attack');
    BattleUI.setActiveTurn(player);
    ActionTextFX.show('MEND!', 'heal');
    BattleUI.popDamage(healTarget, healAmt, 'heal');

    const msg = healTarget === player
      ? `${player.displayName} calls upon divine grace, restoring ${healAmt} HP to themselves!`
      : `${player.displayName} channels holy light, healing ${healTarget.displayName} for ${healAmt} HP!`;
    BattleUI.log(msg, 'heal');

    CharState.autoSprite(healTarget);
    CharState.autoSprite(player);
    BattleUI.updateBars(player);
    BattleUI.updateBars(healTarget);
    BattleUI.updateCharInfo(player);

    setTimeout(() => TurnMgr.nextTurn(), 1200);
  }

  /* ──────────────────────────────────────────────
     ENEMY TURN (auto — no dice visual)
  ────────────────────────────────────────────── */
  /* Boss armor degradation — Ashrag's plates crack apart as he is pounded.
     Fires the instant his HP changes (hooked into CharState.applyDamage) so the
     very next attacker — including allies during the same player phase — already
     sees the reduced armor. Lowers both AC (easier to hit) and flat damage
     reduction (each hit cuts deeper). Each tier announces itself once. */
  const ASHRAG_ARMOR_TIERS = [
    // Ordered most-broken first so we pick the deepest tier the HP qualifies for.
    { stage: 4, hpRatio: 0.30, flat: 1, ac: 0, log: "Ashrag's heavy plates SHATTER — only twisted scraps remain!", banner: 'ARMOR RUINED!' },
    { stage: 3, hpRatio: 0.40, flat: 3, ac: 2, log: 'Massive cracks split across Ashrag\'s breastplate.',          banner: 'ARMOR SHATTERED!' },
    { stage: 2, hpRatio: 0.60, flat: 5, ac: 4, log: 'Ashrag\'s armor buckles — plates hang loose.',                banner: 'ARMOR SCORED!' },
    { stage: 1, hpRatio: 0.70, flat: 7, ac: 5, log: 'A chip flies from Ashrag\'s pauldron.',                       banner: 'ARMOR CHIPPED!' }
  ];

  function _checkBossArmor(enemy) {
    if (enemy.key !== 'Ashrag' || !enemy.alive) return;
    const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    enemy.armorStage = enemy.armorStage || 0;

    // Pick the strongest qualifying tier (highest stage number).
    const tier = ASHRAG_ARMOR_TIERS.find(t => ratio < t.hpRatio);
    if (!tier || tier.stage <= enemy.armorStage) return;

    enemy.armorStage           = tier.stage;
    enemy.armorFlatOverride    = tier.flat;
    enemy.armorACBonusOverride = tier.ac;
    BattleUI.log(tier.log, 'crit');
    ActionTextFX.show(tier.banner, 'crit');
  }

  /* Boss enrage system — Ashrag's damage scales smoothly downward, with named
     thresholds for the dramatic moments. Each tier announces itself ONCE.
     Like the armor tiers, deepest-first ordering means a single big hit can
     skip Ashrag straight to a later phase without triple-announcing.

     The 12.5 % "DESPERATE" tier is the climax: hitBonus +6 to his d20 roll
     pushes his hit rate from ~60 % up to ~90 % against most party AC — he
     almost never misses, but isn't guaranteed (nat 1 still fumbles, very
     high-AC targets can still avoid). Combined with the moderate damage
     multiplier, he's terrifying but no longer one-shots low-HP classes. */
  const ASHRAG_ENRAGE_TIERS = [
    { stage: 5, hpRatio: 0.125, dmgMult: 2.80, canUseSkills: true, hitBonus: 6,
      log: 'Ashrag laughs as the runes consume him — every blow strikes with terrible precision!',
      banner: 'DESPERATE!' },
    { stage: 4, hpRatio: 0.20,  dmgMult: 2.30, canUseSkills: true,
      log: "Ashrag's wounds split the runes wide open — the blade IGNITES!",
      banner: 'RUNIC OVERLOAD!' },
    { stage: 3, hpRatio: 0.30,  dmgMult: 1.90,
      log: 'Ashrag staggers — then surges with terrible fury!',
      banner: 'ENRAGED!' },
    { stage: 2, hpRatio: 0.50,  dmgMult: 1.50,
      log: "Ashrag's grip tightens — each swing comes harder than the last.",
      banner: 'WOUNDED FURY!' },
    { stage: 1, hpRatio: 0.70,  dmgMult: 1.30,
      log: "Ashrag's breathing turns to a low, dangerous growl.",
      banner: 'BLOODLUST!' }
  ];

  /* Boss awakening — triggered the instant Ashrag's HP first reaches 0.
     She does NOT die. Instead: heals to 50 HP, sheds all armor (the plates
     have literally shattered), gains a major damage spike, and refills SP
     so she can spam her runic attacks. The maxHp is reset to 50 too so the
     HP bar reads "50/50" cleanly during the second phase instead of "50/250"
     (which would visually misrepresent how much fight she has left).

     armorStage / enrageStage are pinned to 99 so the existing tier systems
     can't re-fire armor breaks or rage banners during the awakened phase —
     this phase has its own identity and shouldn't be muddled. */
  function _triggerAshragAwakening(enemy) {
    enemy.awakened             = true;
    enemy.hp                   = 150;
    enemy.maxHp                = 150;
    enemy.armorFlatOverride    = 0;     // armor completely shattered
    enemy.armorACBonusOverride = 0;     // no AC from armor (DEX 8 → AC 9)
    enemy.enrageDmgMult        = 3.0;   // ×3 basic damage — meaningfully higher than
                                        // her pre-awakening DESPERATE (×2.8) but
                                        // calibrated so a crit basic (×2) maxes at
                                        // ~66 dmg, never one-shotting full-HP classes.
    enemy.hitBonus             = 6;     // keeps the DESPERATE accuracy boost
    enemy.canUseSkills         = false; // SP attacks DISABLED in the awakening phase:
                                        // her runic skills + ×3 + crit can spike to
                                        // 158 dmg per hit (one-shots everyone). Pure
                                        // basic attacks keep damage predictable and
                                        // survivable for a 50-HP race-to-finish phase.
    enemy.stamina              = enemy.maxStamina;
    enemy.armorStage           = 99;
    enemy.enrageStage          = 99;

    BattleUI.hitFlash('red');
    BattleUI.setSpriteState(enemy, 'attack');
    BattleUI.updateBars(enemy);

    BattleUI.log(
      "Ashrag's lifeless body convulses — the runic core flares white-hot. " +
      "She rises again, AWAKENED in her true form! All armor shed, all restraint gone!",
      'crit'
    );
    ActionTextFX.show('AWAKENING!', 'crit');
  }

  function _checkBossEnrage(enemy) {
    if (enemy.key !== 'Ashrag' || !enemy.alive) return;
    const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    enemy.enrageStage = enemy.enrageStage || 0;

    // Pick the deepest qualifying tier (lowest hpRatio he is below).
    const tier = ASHRAG_ENRAGE_TIERS.find(t => ratio < t.hpRatio);
    if (!tier || tier.stage <= enemy.enrageStage) return;

    enemy.enrageStage   = tier.stage;
    enemy.enrageDmgMult = tier.dmgMult;
    if (tier.canUseSkills) enemy.canUseSkills = true;
    if (tier.hitBonus)     enemy.hitBonus     = tier.hitBonus;
    BattleUI.log(tier.log, 'crit');
    ActionTextFX.show(tier.banner, 'crit');
  }

  function _enemyTurn(enemy) {
    BattleUI.setTurnIndicator(false);
    BattleUI.showEnemyTurnNotice(enemy.displayName);
    TurnIndicator.show(enemy);

    // Note: boss enrage/armor checks now fire inside CharState.applyDamage so
    // phase transitions appear the instant they happen — no need to re-check here.

    setTimeout(() => {
      const targets = state.party.filter(p => p.alive);
      if (targets.length === 0) { _endBattle(false); return; }

      // Enemies pick a random living party member — could be the player or an ally
      const target = targets[Math.floor(Math.random() * targets.length)];

      // Skill selection — only enemies with canUseSkills (currently just phase-3 Ashrag)
      // get to pick from their skill list. 60 % chance per turn so basic attacks still
      // happen, keeping rhythm varied. Skill cost is drained on selection.
      let skill = null;
      if (enemy.canUseSkills && enemy.combat?.skills?.length) {
        const affordable = enemy.combat.skills.filter(s => enemy.stamina >= s.cost);
        if (affordable.length && Math.random() < 0.60) {
          skill = affordable[Math.floor(Math.random() * affordable.length)];
          CharState.drainStamina(enemy, skill.cost);
        }
      }

      BattleUI.setSpriteState(enemy, 'attack');
      BattleUI.setActiveTurn(enemy);
      ActionTextFX.show(skill ? skill.name.toUpperCase() : `${enemy.displayName} attacks!`.toUpperCase());

      setTimeout(() => {
        const result = skill
          ? CombatCalc.resolveSkill(enemy, target, skill)
          : CombatCalc.resolve(enemy, target);

        CinematicAnimator.moveToEnemy(enemy, target, () => {
          if (result.hit) {
            const actual = CharState.applyDamage(target, result.damage);
            BattleUI.setSpriteState(target, 'injured');
            BattleUI.flashSprite(target);
            BattleUI.hitFlash('red');
            BattleUI.popDamage(target, actual, result.crit ? 'crit' : 'hit');
            if (result.crit) ActionTextFX.show('CRITICAL!', 'crit');

            const msg = skill
              ? `${enemy.displayName} unleashes ${skill.name} for ${actual} damage!`
              : result.crit
                ? `CRITICAL! ${enemy.displayName} strikes for ${actual}!`
                : `${enemy.displayName} attacks for ${actual} damage.`;
            BattleUI.log(msg, (skill || result.crit) ? 'crit' : '');

            CinematicAnimator.returnToBase(enemy, () => {
              CharState.autoSprite(enemy);
              CharState.autoSprite(target);
              BattleUI.updateBars(target);
              BattleUI.updateBars(enemy);
              BattleUI.updateCharInfo(target);
              setTimeout(() => TurnMgr.nextTurn(), 700);
            });
          } else {
            BattleUI.popDamage(target, 0, 'miss');
            BattleUI.log(`${enemy.displayName} misses!`, 'miss');
            ActionTextFX.show('MISS!', 'miss');
            CinematicAnimator.returnToBase(enemy, () => {
              CharState.autoSprite(enemy);
              setTimeout(() => TurnMgr.nextTurn(), 700);
            });
          }
        });
      }, 700);
    }, 600);
  }

  /* ──────────────────────────────────────────────
     END BATTLE
  ────────────────────────────────────────────── */
  function _endBattle(victory) {
    if (state._keyHandler) {
      document.removeEventListener('keydown', state._keyHandler);
      state._keyHandler = null;
    }

    BattleUI.hideCommandMenu();
    BattleUI._el('btl-action-bar').classList.add('hidden');
    BattleUI._el('btl-enemy-turn-overlay').classList.add('hidden');
    TurnIndicator.hide();
    TrailCanvas.clear();

    // Tally for end-of-game report
    if (GameState?.player?.battles) {
      if (victory) GameState.player.battles.won  += 1;
      else         GameState.player.battles.lost += 1;
    }

    if (victory) {
      BattleUI.log('Victory! The enemy has been defeated.', '');
      const enemyName = state.enemies[0]?.displayName || 'foes';
      updateScore && updateScore(60, `Victory vs ${enemyName}`);
      if (typeof AudioManager !== 'undefined')
        AudioManager.oneShot('victory', AudioManager.getLastScene());
      setTimeout(() => {
        Screen.show('screen-game');
        state.onWin();
        state = null;
      }, 1800);
    } else {
      BattleUI.log('You have fallen...', 'miss');
      if (typeof AudioManager !== 'undefined')
        AudioManager.oneShot('defeat', 'ending');
      setTimeout(() => {
        Screen.show('screen-game');
        state.onLose();
        state = null;
      }, 1800);
    }
  }

  /* ──────────────────────────────────────────────
     PRE-BATTLE CHOICE SYSTEM
  ────────────────────────────────────────────── */
  function _runPreBattle(choices, onReady) {
    Dialogue.showChoices(choices.map(c => ({
      text:   c.text,
      dc:     c.dc,
      stat:   c.stat,
      action: () => {
        const label = `${c.stat} Check — ${c.text.slice(0, 40)}`;
        Dice.check(c.stat, c.dc, label,
          (isCrit) => {
            const buff = isCrit
              ? { ...(c.successBuff || {}), accuracyBonus: ((c.successBuff?.accuracyBonus || 0) + 5) }
              : (c.successBuff || {});
            if ((c.successLines || []).length > 0) {
              Dialogue.show(c.successLines, () => onReady(buff));
            } else {
              onReady(buff);
            }
          },
          (isFumble) => {
            const debuff = isFumble
              ? { ...(c.failBuff || {}), hpPenalty: ((c.failBuff?.hpPenalty || 0) + 5) }
              : (c.failBuff || {});
            if ((c.failLines || []).length > 0) {
              Dialogue.show(c.failLines, () => onReady(debuff));
            } else {
              onReady(debuff);
            }
          }
        );
      }
    })));
  }

  function _applyBuffs(buffs) {
    state.buffs = buffs;
    const player = state.party[0];
    if (!player) return;

    if (buffs.hpPenalty) {
      const penalty = Math.min(buffs.hpPenalty, player.hp - 1);
      player.hp    = Math.max(1, player.hp    - penalty);
      player.maxHp = Math.max(1, player.maxHp - penalty);
    }

    if (buffs.staminaBonus) {
      player.stamina = Math.min(player.maxStamina, player.stamina + buffs.staminaBonus);
    }

    if (buffs.enemyHpMult && buffs.enemyHpMult < 1) {
      state.enemies.forEach(e => {
        e.hp    = Math.max(1, Math.floor(e.hp    * buffs.enemyHpMult));
        e.maxHp = Math.max(1, Math.floor(e.maxHp * buffs.enemyHpMult));
      });
    }
  }

  /* ──────────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────────── */
  function start(config) {
    // Clean up any lingering keyboard listener from a previous battle
    if (state?._keyHandler) {
      document.removeEventListener('keydown', state._keyHandler);
    }

    const cls      = GameState.player.class;
    const skinTone = config.skinTone || GameState.player.flags.skinTone || 'light';
    const gender   = config.gender   || GameState.player.flags.gender   || 'male';

    const player = CharState.build(cls, true, false, skinTone, gender);
    player.displayName = cls;

    const allies = [];
    (config.allies || []).forEach(spec => {
      const a = CharState.build(spec.key, false, true, null, null);
      allies.push(a);
    });

    const enemies = [];
    (config.enemies || []).forEach(spec => {
      const count = spec.count || 1;
      for (let i = 0; i < count; i++) {
        const e = CharState.build(spec.key, false, false, null, null);
        if (count > 1) e.displayName = `${ENEMY_DATA[spec.key]?.displayName || spec.key} ${i + 1}`;
        enemies.push(e);
      }
    });

    state = {
      party:      [player, ...allies],
      enemies,
      turnOrder:  [],
      turnIndex:  -1,
      round:      1,
      buffs:      {},
      _keyHandler: null,
      onWin:  config.onWin  || (() => {}),
      onLose: config.onLose || (() => {})
    };

    // Unique combatant ids — needed because two enemies of the same type
    // (e.g. Bullywug 1 / Bullywug 2) share `key`, which would collide on DOM ids.
    state.party.forEach(  (c, i) => c.uid = `p${i}`);
    state.enemies.forEach((c, i) => c.uid = `e${i}`);

    const _launch = () => {
      Screen.show('screen-battle');
      // Boss-fight overrides — applied when Ashrag is on the field.
      const isBossFight = state.enemies.some(e => e.key === 'Ashrag');
      if (isBossFight) {
        // Music: Screen.show fires the generic battle theme via SCREEN_MAP. For
        // the boss we immediately crossfade into the boss-specific track. The
        // generic theme has only just started fading in from 0, so the listener
        // never actually hears it — only the boss music swelling from silence.
        if (typeof AudioManager !== 'undefined') AudioManager.play('bossBattle');

        // Party buffs: Ashrag has 250 HP, heavy armor (flat 8 damage reduction),
        // and AC 16. The accuracy buff (+30 → +6 to d20 roll) is applied for the
        // whole fight so the party stops whiffing half their swings. The damage
        // buff (+200 %) is NOT set here — it kicks in dynamically once Ashrag
        // drops below 70 % HP (see "boss-wound multiplier" in CombatCalc.resolve).
        // Math.max preserves any higher pre-battle buffs from story choices.
        state.buffs.accuracyBonus   = Math.max(state.buffs.accuracyBonus   || 0, 30);
      }
      BattleUI.setBackground(config.background || 'cultist_room');
      BattleUI._el('btl-action-bar').classList.remove('hidden');

      // Resize trail canvas to match viewport on each battle start
      const tc = document.getElementById('btl-trail-canvas');
      if (tc) {
        tc.width  = window.innerWidth;
        tc.height = window.innerHeight;
      }
      TrailCanvas._canvas = null; // force re-init on next draw

      BattleUI.renderField();
      BattleUI.setRound(1);
      BattleUI.log('');
      TurnIndicator.hide();
      if (typeof CharSprite !== 'undefined') CharSprite.hide();
      setTimeout(() => TurnMgr.begin(), 400);
    };

    const _showBuffNotice = () => {
      const b = state.buffs;
      const lines = [];
      if (b.accuracyBonus  >  0) lines.push(`+${b.accuracyBonus}% Accuracy`);
      if (b.accuracyBonus  <  0) lines.push(`${b.accuracyBonus}% Accuracy`);
      if (b.damageMultBonus > 1) lines.push(`+${Math.round((b.damageMultBonus - 1) * 100)}% Damage`);
      if (b.staminaBonus   >  0) lines.push(`+${b.staminaBonus} Stamina`);
      if (b.hpPenalty      >  0) lines.push(`-${b.hpPenalty} HP`);
      if (b.enemyHpMult    <  1) lines.push('Enemies weakened');
      if (lines.length > 0) setTimeout(() => BattleUI.log(`Battle modifiers: ${lines.join(' · ')}`), 700);
    };

    // Merge always-on baseBuffs with preBattle outcome buffs.
    // accuracy/stamina/hpPenalty add; damage & enemyHp multipliers multiply.
    const _mergeBuffs = (base, extra) => {
      base  = base  || {};
      extra = extra || {};
      return {
        accuracyBonus:   (base.accuracyBonus   || 0) + (extra.accuracyBonus   || 0),
        damageMultBonus: (base.damageMultBonus || 1) * (extra.damageMultBonus || 1),
        staminaBonus:    (base.staminaBonus    || 0) + (extra.staminaBonus    || 0),
        hpPenalty:       (base.hpPenalty       || 0) + (extra.hpPenalty       || 0),
        enemyHpMult:     (base.enemyHpMult     ?? 1) * (extra.enemyHpMult     ?? 1)
      };
    };

    const _afterPreBattle = (buffs) => {
      _applyBuffs(_mergeBuffs(config.baseBuffs, buffs));
      _launch();
      _showBuffNotice();
    };

    const _runChoicesOrLaunch = () => {
      if (config.preBattle && config.preBattle.length > 0) {
        _runPreBattle(config.preBattle, _afterPreBattle);
      } else {
        _afterPreBattle({});
      }
    };

    if (config.intro && config.intro.length > 0) {
      Dialogue.show(config.intro, _runChoicesOrLaunch);
    } else {
      _runChoicesOrLaunch();
    }
  }

  return { start };

})();
