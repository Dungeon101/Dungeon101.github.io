// Game tables: classes, skills, talents, enemies, items, floors, sanctuary upgrades, relics.
// Everything here is plain data; the rules that use it live in game.js.

// one act every three floors, each with its own look, generator and bestiary. The last floor of an act is its boss.
export const ACTS = [
  { id: 'crypt', name: { en: 'The Crypt', it: 'La Cripta' }, gen: 'rooms', pool: ['rat', 'skeleton', 'ghoul', 'cultist'], boss: 'boneKing' },
  { id: 'caves', name: { en: 'The Fungal Caves', it: 'Le Grotte Fungine' }, gen: 'caves', pool: ['bat', 'goblin', 'spider', 'slime'], boss: 'broodmother' },
  { id: 'abyss', name: { en: 'The Abyss', it: 'L\'Abisso' }, gen: 'abyss', pool: ['imp', 'wraith', 'golem', 'cultist'], boss: 'lich' },
  { id: 'forge', name: { en: 'The Cinder Forge', it: 'La Fornace di Brace' }, gen: 'abyss', pool: ['cinderHound', 'magmaSlime', 'ashWraith', 'forgeGolem'], boss: 'chainLord' },
  { id: 'cathedral', name: { en: 'The Drowned Cathedral', it: 'La Cattedrale Sommersa' }, gen: 'caves', pool: ['drowned', 'frostWisp', 'tidePriest', 'paleGolem'], boss: 'frostQueen' },
  { id: 'throne', name: { en: 'The Empty Throne', it: 'Il Trono Vuoto' }, gen: 'rooms', pool: ['imp', 'wraith', 'golem', 'frostWisp'], boss: 'firstKing' },
];

// how many floors one act lasts; the whole dungeon is this times the number of acts
export const ACT_LEN = 3;
export const FLOORS = ACTS.length * ACT_LEN;

// xp needed to go from lvl to lvl+1, in the k-th act of the dungeon (0-based).
// The dungeon doubles in length halfway, so the late acts pay more xp, but slower than the enemies hit harder:
// a full run lands around level 15 instead of 10, which is what the fourth talent tier needs.
export const XP_ACT = [1, 1, 1, 1.7, 2.2, 2.6];
export const xpNext = (lvl, act = 0) => Math.round((12 * lvl + 7 * lvl * lvl) * (XP_ACT[act] ?? XP_ACT[XP_ACT.length - 1]));

// index of the act a floor belongs to, clamped so a floor past the end still answers something
export const actIndex = (floor) => Math.max(0, Math.min(ACTS.length - 1, Math.floor((floor - 1) / ACT_LEN)));
export const actOf = (floor) => ACTS[actIndex(floor)];
export const actStart = (floor) => actIndex(floor) * ACT_LEN + 1;
export const isBossFloor = (floor) => floor % ACT_LEN === 0;
export const isLastBoss = (floor) => isBossFloor(floor) && actIndex(floor) === ACTS.length - 1;

export const CLASSES = {
  warrior: {
    name: { en: 'Warrior', it: 'Guerriero' }, art: 'hero-warrior', color: '#f0a03c',
    blurb: { en: 'Heavy armor, a long sword and no plan B.', it: 'Armatura pesante, spada lunga e nessun piano B.' },
    hp: 36, hpLvl: 8, ac: 15, hit: 4, dmg: [2, 7], crit: 20, skills: ['cleave', 'bash', 'charge'],
    weapons: ['sword', 'axe', 'mace'], armor: 'plate',
    talentIcons: ['shield', 'swords', 'zap'],
    // the talents that only this class can use, by the effects they turn on (see talentBonus in game.js)
    talentFlags: { A1: 'ac2', A2: 'hp15', A3: 'unbreakable', A4: 'lastStand', B3: 'rage', B4: 'trance', C2: 'bloodlust', C3: 'executioner', C4: 'secondwind' },
  },
  mage: {
    name: { en: 'Mage', it: 'Maga' }, art: 'hero-mage', color: '#5cc8ff',
    blurb: { en: 'Fragile, far away and very much on fire.', it: 'Fragile, lontana e decisamente in fiamme.' },
    hp: 24, hpLvl: 5, ac: 12, hit: 4, dmg: [2, 5], crit: 20, skills: ['firebolt', 'nova', 'blink'],
    weapons: ['staff', 'wand', 'orb'], armor: 'robe',
    talentIcons: ['flame', 'snowflake', 'sparkles'],
    talentFlags: { A4: 'kindled', B2: 'ac3', B3: 'shatter', B4: 'deepfreeze', C2: 'fastskills', C3: 'ward', C4: 'mastery' },
  },
  rogue: {
    name: { en: 'Rogue', it: 'Ladro' }, art: 'hero-rogue', color: '#5ee08a',
    blurb: { en: 'Strikes first, strikes twice, is gone before the third.', it: 'Colpisce per primo, colpisce due volte, al terzo è già sparito.' },
    hp: 28, hpLvl: 7, ac: 14, hit: 6, dmg: [3, 6], crit: 19, skills: ['shadowstep', 'venom', 'smoke'],
    weapons: ['dagger', 'kris', 'blade'], armor: 'leather',
    talentIcons: ['footprints', 'droplet', 'wind'],
    talentFlags: { A1: 'ac2', A2: 'ambush', A3: 'assassin', A4: 'deadlyaim', B3: 'virulence', B4: 'twinfangs', C2: 'lucky', C3: 'secondwind', C4: 'ghost' },
  },
  cleric: {
    name: { en: 'Cleric', it: 'Chierico' }, art: 'hero-cleric', color: '#ffd76b',
    blurb: { en: 'Keeps the party breathing, mostly itself.', it: 'Tiene in vita la compagnia, soprattutto sé stesso.' },
    hp: 32, hpLvl: 8, ac: 14, hit: 5, dmg: [3, 5], crit: 20, skills: ['smite', 'mend', 'sanctuary'],
    weapons: ['mace', 'sword'], armor: 'plate',
    talentIcons: ['sparkles', 'heart', 'shield'],
    talentFlags: { A1: 'ac2', A2: 'hp15', A3: 'consecrated', B3: 'zeal', C3: 'blessing', C4: 'lastStand' },
  },
  paladin: {
    name: { en: 'Paladin', it: 'Paladino' }, art: 'hero-paladin', color: '#e8e2c8',
    blurb: { en: 'Slow, loud, and very hard to move.', it: 'Lento, rumoroso e molto difficile da spostare.' },
    hp: 42, hpLvl: 9, ac: 17, hit: 5, dmg: [3, 7], crit: 20, skills: ['aegis', 'hammer', 'consecrate'],
    weapons: ['sword', 'mace', 'axe'], armor: 'plate',
    talentIcons: ['shield', 'hammer', 'flame'],
    talentFlags: { A1: 'ac3', A2: 'hp15', A3: 'unbreakable', B3: 'shatter', C2: 'bulwark', C4: 'lastStand' },
  },
  hunter: {
    name: { en: 'Hunter', it: 'Cacciatore' }, art: 'hero-hunter', color: '#8fd14f',
    blurb: { en: 'Shoots from three rooms away and lets the wolf do the talking.', it: 'Spara da tre stanze di distanza e lascia parlare il lupo.' },
    hp: 30, hpLvl: 7, ac: 13, hit: 6, dmg: [3, 6], crit: 19, skills: ['volley', 'snare', 'beast'],
    weapons: ['dagger', 'kris', 'blade'], armor: 'leather',
    talentIcons: ['arrow-up-right', 'target', 'paw-print'],
    talentFlags: { A1: 'ac2', A2: 'marksman', A3: 'assassin', B3: 'virulence', C3: 'packbond', C4: 'ghost' },
  },
};

// target: null (instant), 'adjacent' (enemy next to you), 'enemy' (visible enemy in range), 'tile' (visible free tile in range)
export const SKILLS = {
  cleave: { icon: 'axe', cd: 4, target: null, name: { en: 'Cleave', it: 'Fendente' },
    desc: { en: 'Strike every adjacent enemy with +3 damage.', it: 'Colpisce tutti i nemici vicini con +3 danni.' } },
  bash: { icon: 'shield', cd: 5, target: 'adjacent', name: { en: 'Shield Bash', it: 'Colpo di scudo' },
    desc: { en: 'A sure hit that stuns the enemy for 2 turns.', it: 'Colpo sicuro che stordisce il nemico per 2 turni.' } },
  charge: { icon: 'zap', cd: 6, target: 'enemy', range: 5, name: { en: 'Charge', it: 'Carica' },
    desc: { en: 'Rush an enemy up to 5 tiles away, hit it with +3 damage and stun it for 1 turn.', it: 'Ti lanci su un nemico fino a 5 caselle, lo colpisci con +3 danni e lo stordisci per 1 turno.' } },
  firebolt: { icon: 'flame', cd: 3, target: 'enemy', range: 7, name: { en: 'Firebolt', it: 'Dardo di fuoco' },
    desc: { en: 'A bolt of fire that never misses.', it: 'Un dardo di fuoco che non manca mai.' } },
  nova: { icon: 'snowflake', cd: 7, target: null, name: { en: 'Frost Nova', it: 'Nova di gelo' },
    desc: { en: 'Damage and freeze every enemy within 2 tiles for 2 turns.', it: 'Danneggia e congela per 2 turni ogni nemico entro 2 caselle.' } },
  blink: { icon: 'sparkles', cd: 8, target: 'tile', range: 6, name: { en: 'Blink', it: 'Traslazione' },
    desc: { en: 'Teleport to a visible tile up to 6 away.', it: 'Ti teletrasporti su una casella visibile fino a 6 di distanza.' } },
  shadowstep: { icon: 'footprints', cd: 5, target: 'enemy', range: 5, name: { en: 'Shadowstep', it: 'Passo d\'ombra' },
    desc: { en: 'Appear behind an enemy and strike twice as hard.', it: 'Appari alle spalle di un nemico e colpisci il doppio.' } },
  venom: { icon: 'droplet', cd: 8, target: null, name: { en: 'Poison Blade', it: 'Lama avvelenata' },
    desc: { en: 'Your next 3 hits poison the enemy.', it: 'I prossimi 3 colpi avvelenano il nemico.' } },
  smoke: { icon: 'wind', cd: 12, target: null, name: { en: 'Smoke Bomb', it: 'Bomba fumogena' },
    desc: { en: 'Vanish for 4 turns. Your first attack from the smoke is a critical hit.', it: 'Sparisci per 4 turni. Il primo attacco dal fumo è un critico.' } },
  // cleric
  smite: { icon: 'sparkles', cd: 3, target: 'adjacent', name: { en: 'Smite', it: 'Punizione' },
    desc: { en: 'A holy blow with +4 damage, doubled against the undead.', it: 'Colpo sacro con +4 danni, doppio contro i non morti.' } },
  mend: { icon: 'heart', cd: 7, target: null, name: { en: 'Mending', it: 'Ristoro' },
    desc: { en: 'Heal a third of your HP and clear poison and burning.', it: 'Recuperi un terzo dei PV e ti liberi da veleno e fuoco.' } },
  sanctuary: { icon: 'shield', cd: 11, target: null, name: { en: 'Sanctuary', it: 'Santuario' },
    desc: { en: 'For 4 turns you take 35% less damage and heal 3 HP a turn.', it: 'Per 4 turni subisci il 35% di danni in meno e recuperi 3 PV a turno.' } },
  // paladin
  aegis: { icon: 'shield', cd: 6, target: null, name: { en: 'Aegis', it: 'Egida' },
    desc: { en: 'A shield that absorbs damage equal to twice your level.', it: 'Uno scudo che assorbe danni pari al doppio del tuo livello.' } },
  hammer: { icon: 'hammer', cd: 5, target: 'adjacent', name: { en: 'Hammerfall', it: 'Martello' },
    desc: { en: 'Hits the enemy in front and the ones beside it, stunning for 1 turn.', it: 'Colpisce il nemico davanti e quelli di fianco, stordendoli per 1 turno.' } },
  consecrate: { icon: 'flame', cd: 9, target: null, name: { en: 'Consecrate', it: 'Consacrazione' },
    desc: { en: 'Burning ground around you for 4 turns: enemies that start their turn next to you take damage.', it: 'Terra consacrata per 4 turni: i nemici che iniziano il turno accanto a te subiscono danni.' } },
  // hunter
  volley: { icon: 'arrow-up-right', cd: 5, target: 'enemy', range: 7, name: { en: 'Volley', it: 'Salva di frecce' },
    desc: { en: 'Every enemy you can see takes an arrow.', it: 'Ogni nemico che vedi riceve una freccia.' } },
  snare: { icon: 'target', cd: 6, target: 'enemy', range: 6, name: { en: 'Snare', it: 'Trappola' },
    desc: { en: 'Traps an enemy in place for 3 turns and poisons it.', it: 'Blocca un nemico per 3 turni e lo avvelena.' } },
  beast: { icon: 'paw-print', cd: 14, target: null, name: { en: 'Call the Beast', it: 'Chiama la bestia' },
    desc: { en: 'A wolf fights at your side until it falls.', it: 'Un lupo combatte al tuo fianco finché non cade.' } },
};

// three branches per class, three tiers each; a tier needs the one above in the same branch
export const TALENTS = {
  warrior: [
    [{ id: 'A1', name: { en: 'Iron Skin', it: 'Pelle di ferro' }, desc: { en: '+2 armor.', it: '+2 armatura.' } },
      { id: 'A2', name: { en: 'Vitality', it: 'Vitalità' }, desc: { en: '+15 max HP.', it: '+15 PV massimi.' } },
      { id: 'A3', name: { en: 'Unbreakable', it: 'Indistruttibile' }, desc: { en: 'Once per floor, a killing blow leaves you at 1 HP.', it: 'Una volta per piano, un colpo mortale ti lascia a 1 PV.' } },
      { id: 'A4', name: { en: 'Last Stand', it: 'Ultima difesa' }, desc: { en: 'Below a third of your HP you take 20% less damage.', it: 'Sotto un terzo dei PV subisci il 20% di danni in meno.' } }],
    [{ id: 'B1', name: { en: 'Shield Bash', it: 'Colpo di scudo' }, desc: { en: 'Learn Shield Bash.', it: 'Impari Colpo di scudo.' }, skill: 'bash' },
      { id: 'B2', name: { en: 'Concussion', it: 'Commozione' }, desc: { en: 'Bash stuns for 3 turns and recharges 1 turn faster.', it: 'Il Colpo di scudo stordisce per 3 turni e si ricarica un turno prima.' } },
      { id: 'B3', name: { en: 'Rage', it: 'Furia' }, desc: { en: '+50% damage while below half HP.', it: '+50% danni sotto metà PV.' } },
      { id: 'B4', name: { en: 'Battle Trance', it: 'Trance di battaglia' }, desc: { en: 'Shield Bash recharges 2 turns faster and stuns one turn longer.', it: 'Il Colpo di scudo si ricarica due turni prima e stordisce un turno in più.' } }],
    [{ id: 'C1', name: { en: 'Charge', it: 'Carica' }, desc: { en: 'Learn Charge.', it: 'Impari Carica.' }, skill: 'charge' },
      { id: 'C2', name: { en: 'Bloodlust', it: 'Sete di sangue' }, desc: { en: 'Heal 3 HP on every kill.', it: 'Recuperi 3 PV a ogni uccisione.' } },
      { id: 'C3', name: { en: 'Executioner', it: 'Boia' }, desc: { en: '+60% damage to enemies below 30% HP.', it: '+60% danni ai nemici sotto il 30% dei PV.' } },
      { id: 'C4', name: { en: 'Last Stand', it: 'Ultima difesa' }, desc: { en: 'Below a third of your HP you take 20% less damage.', it: 'Sotto un terzo dei PV subisci il 20% di danni in meno.' } }],
  ],
  mage: [
    [{ id: 'A1', name: { en: 'Kindling', it: 'Esca' }, desc: { en: 'Firebolt sets the target on fire for 3 turns.', it: 'Il Dardo di fuoco incendia il bersaglio per 3 turni.' } },
      { id: 'A2', name: { en: 'Pyromancy', it: 'Piromanzia' }, desc: { en: 'Firebolt recharges 1 turn faster.', it: 'Il Dardo di fuoco si ricarica un turno prima.' } },
      { id: 'A3', name: { en: 'Inferno', it: 'Inferno' }, desc: { en: 'Firebolt explodes, hitting enemies next to the target.', it: 'Il Dardo di fuoco esplode e colpisce i nemici vicini al bersaglio.' } },
      { id: 'A4', name: { en: 'Kindled Soul', it: 'Anima accesa' }, desc: { en: 'Burning enemies take 50% more damage from your spells.', it: 'I nemici in fiamme subiscono il 50% di danni in più dai tuoi incantesimi.' } }],
    [{ id: 'B1', name: { en: 'Frost Nova', it: 'Nova di gelo' }, desc: { en: 'Learn Frost Nova.', it: 'Impari Nova di gelo.' }, skill: 'nova' },
      { id: 'B2', name: { en: 'Ice Armor', it: 'Armatura di ghiaccio' }, desc: { en: '+3 armor.', it: '+3 armatura.' } },
      { id: 'B3', name: { en: 'Shatter', it: 'Frantumare' }, desc: { en: 'Frozen or stunned enemies take +60% damage.', it: 'I nemici congelati o storditi subiscono +60% danni.' } },
      { id: 'B4', name: { en: 'Deep Freeze', it: 'Gelo profondo' }, desc: { en: 'Frost Nova reaches 3 tiles and freezes for one turn longer.', it: 'La Nova di gelo arriva a 3 caselle e congela un turno in più.' } }],
    [{ id: 'C1', name: { en: 'Blink', it: 'Traslazione' }, desc: { en: 'Learn Blink.', it: 'Impari Traslazione.' }, skill: 'blink' },
      { id: 'C2', name: { en: 'Arcane Flow', it: 'Flusso arcano' }, desc: { en: 'Every skill recharges 1 turn faster.', it: 'Ogni abilità si ricarica un turno prima.' } },
      { id: 'C3', name: { en: 'Arcane Ward', it: 'Protezione arcana' }, desc: { en: '25% chance to ignore an enemy hit.', it: '25% di probabilità di ignorare un colpo nemico.' } },
      { id: 'C4', name: { en: 'Mastery', it: 'Maestria' }, desc: { en: 'Every spell hits 30% harder.', it: 'Ogni incantesimo fa il 30% di danni in più.' } }],
  ],
  rogue: [
    [{ id: 'A1', name: { en: 'Swiftness', it: 'Rapidità' }, desc: { en: '+2 armor.', it: '+2 armatura.' } },
      { id: 'A2', name: { en: 'Ambush', it: 'Imboscata' }, desc: { en: 'Your first hit on each enemy is a critical.', it: 'Il primo colpo su ogni nemico è un critico.' } },
      { id: 'A3', name: { en: 'Assassin', it: 'Assassino' }, desc: { en: 'Critical hits deal triple damage.', it: 'I critici fanno il triplo dei danni.' } },
      { id: 'A4', name: { en: 'Deadly Aim', it: 'Mira letale' }, desc: { en: '+2 to hit and criticals on 18-20.', it: '+2 a colpire e critico con 18-20.' } }],
    [{ id: 'B1', name: { en: 'Poison Blade', it: 'Lama avvelenata' }, desc: { en: 'Learn Poison Blade.', it: 'Impari Lama avvelenata.' }, skill: 'venom' },
      { id: 'B2', name: { en: 'Toxicity', it: 'Tossicità' }, desc: { en: 'Poison deals more damage and lasts longer.', it: 'Il veleno fa più danni e dura di più.' } },
      { id: 'B3', name: { en: 'Virulence', it: 'Virulenza' }, desc: { en: 'Poisoned enemies take +30% damage from you.', it: 'I nemici avvelenati subiscono +30% danni da te.' } },
      { id: 'B4', name: { en: 'Twin Fangs', it: 'Zanne gemelle' }, desc: { en: 'Shadowstep strikes three times instead of twice.', it: 'Il Passo d\'ombra colpisce tre volte invece di due.' } }],
    [{ id: 'C1', name: { en: 'Smoke Bomb', it: 'Bomba fumogena' }, desc: { en: 'Learn Smoke Bomb.', it: 'Impari Bomba fumogena.' }, skill: 'smoke' },
      { id: 'C2', name: { en: 'Lucky', it: 'Fortunato' }, desc: { en: 'Critical on 18-20 and +25% gold.', it: 'Critico con 18-20 e +25% oro.' } },
      { id: 'C3', name: { en: 'Second Wind', it: 'Secondo fiato' }, desc: { en: 'Once per floor, heal 35% when you drop below 25% HP.', it: 'Una volta per piano, recuperi il 35% quando scendi sotto il 25% dei PV.' } },
      { id: 'C4', name: { en: 'Ghost', it: 'Fantasma' }, desc: { en: 'You move without waking enemies: the first blow on each of them is a critical.', it: 'Ti muovi senza svegliare i nemici: il primo colpo su ognuno è un critico.' } }],
  ],
  cleric: [
    [{ id: 'A1', name: { en: 'Blessed Mail', it: 'Maglia benedetta' }, desc: { en: '+2 armor.', it: '+2 armatura.' } },
      { id: 'A2', name: { en: 'Vitality', it: 'Vitalità' }, desc: { en: '+15 max HP.', it: '+15 PV massimi.' } },
      { id: 'A3', name: { en: 'Consecrated', it: 'Consacrato' }, desc: { en: 'Mending also heals 10 HP at the start of every floor.', it: 'Il Ristoro cura anche 10 PV all\'inizio di ogni piano.' } },
      { id: 'A4', name: { en: 'Last Stand', it: 'Ultima difesa' }, desc: { en: 'Below a third of your HP you take 20% less damage.', it: 'Sotto un terzo dei PV subisci il 20% di danni in meno.' } }],
    [{ id: 'B1', name: { en: 'Mending', it: 'Ristoro' }, desc: { en: 'Learn Mending.', it: 'Impari Ristoro.' }, skill: 'mend' },
      { id: 'B2', name: { en: 'Faith', it: 'Fede' }, desc: { en: 'Mending recharges 2 turns faster.', it: 'Il Ristoro si ricarica due turni prima.' } },
      { id: 'B3', name: { en: 'Zeal', it: 'Zelo' }, desc: { en: 'Smite hits every adjacent enemy.', it: 'La Punizione colpisce tutti i nemici vicini.' } },
      { id: 'B4', name: { en: 'Mastery', it: 'Maestria' }, desc: { en: 'Smite hits 30% harder.', it: 'La Punizione fa il 30% di danni in più.' } }],
    [{ id: 'C1', name: { en: 'Sanctuary', it: 'Santuario' }, desc: { en: 'Learn Sanctuary.', it: 'Impari Santuario.' }, skill: 'sanctuary' },
      { id: 'C2', name: { en: 'Devotion', it: 'Devozione' }, desc: { en: 'Sanctuary recharges 3 turns faster.', it: 'Il Santuario si ricarica tre turni prima.' } },
      { id: 'C3', name: { en: 'Blessing', it: 'Benedizione' }, desc: { en: 'You heal 2 HP every turn you take no damage.', it: 'Recuperi 2 PV a ogni turno in cui non subisci danni.' } },
      { id: 'C4', name: { en: 'Miracle', it: 'Miracolo' }, desc: { en: 'Once per run, you come back at half HP.', it: 'Una volta per partita ti rialzi con metà dei PV.' } }],
  ],
  paladin: [
    [{ id: 'A1', name: { en: 'Bulwark', it: 'Bastione' }, desc: { en: '+3 armor.', it: '+3 armatura.' } },
      { id: 'A2', name: { en: 'Vitality', it: 'Vitalità' }, desc: { en: '+15 max HP.', it: '+15 PV massimi.' } },
      { id: 'A3', name: { en: 'Unbreakable', it: 'Indistruttibile' }, desc: { en: 'Once per floor, a killing blow leaves you at 1 HP.', it: 'Una volta per piano, un colpo mortale ti lascia a 1 PV.' } },
      { id: 'A4', name: { en: 'Last Stand', it: 'Ultima difesa' }, desc: { en: 'Below a third of your HP you take 20% less damage.', it: 'Sotto un terzo dei PV subisci il 20% di danni in meno.' } }],
    [{ id: 'B1', name: { en: 'Hammerfall', it: 'Martello' }, desc: { en: 'Learn Hammerfall.', it: 'Impari Martello.' }, skill: 'hammer' },
      { id: 'B2', name: { en: 'Concussion', it: 'Commozione' }, desc: { en: 'Hammerfall stuns for 2 turns.', it: 'Il Martello stordisce per 2 turni.' } },
      { id: 'B3', name: { en: 'Shatter', it: 'Frantumare' }, desc: { en: 'Stunned enemies take +60% damage from you.', it: 'I nemici storditi subiscono +60% danni da te.' } },
      { id: 'B4', name: { en: 'Judgement', it: 'Giudizio' }, desc: { en: 'Hammerfall hits 40% harder.', it: 'Il Martello fa il 40% di danni in più.' } }],
    [{ id: 'C1', name: { en: 'Consecrate', it: 'Consacrazione' }, desc: { en: 'Learn Consecrate.', it: 'Impari Consacrazione.' }, skill: 'consecrate' },
      { id: 'C2', name: { en: 'Vow', it: 'Voto' }, desc: { en: 'Consecrate lasts 2 turns longer and hurts more.', it: 'La Consacrazione dura due turni in più e fa più male.' } },
      { id: 'C3', name: { en: 'Warding', it: 'Protezione' }, desc: { en: '25% chance to ignore an enemy hit.', it: '25% di probabilità di ignorare un colpo nemico.' } },
      { id: 'C4', name: { en: 'Martyr', it: 'Martire' }, desc: { en: 'Every kill heals 4 HP.', it: 'Ogni uccisione ti cura 4 PV.' } }],
  ],
  hunter: [
    [{ id: 'A1', name: { en: 'Tough Hide', it: 'Pelle dura' }, desc: { en: '+2 armor.', it: '+2 armatura.' } },
      { id: 'A2', name: { en: 'Marksman', it: 'Tiratore' }, desc: { en: '+2 to hit.', it: '+2 a colpire.' } },
      { id: 'A3', name: { en: 'Assassin', it: 'Assassino' }, desc: { en: 'Critical hits deal triple damage.', it: 'I critici fanno il triplo dei danni.' } },
      { id: 'A4', name: { en: 'Ghost', it: 'Fantasma' }, desc: { en: 'You move without waking enemies: the first blow on each of them is a critical.', it: 'Ti muovi senza svegliare i nemici: il primo colpo su ognuno è un critico.' } }],
    [{ id: 'B1', name: { en: 'Snare', it: 'Trappola' }, desc: { en: 'Learn Snare.', it: 'Impari Trappola.' }, skill: 'snare' },
      { id: 'B2', name: { en: 'Toxicity', it: 'Tossicità' }, desc: { en: 'Poison deals more damage and lasts longer.', it: 'Il veleno fa più danni e dura di più.' } },
      { id: 'B3', name: { en: 'Virulence', it: 'Virulenza' }, desc: { en: 'Poisoned enemies take +30% damage from you.', it: 'I nemici avvelenati subiscono +30% danni da te.' } },
      { id: 'B4', name: { en: 'Volley', it: 'Salva' }, desc: { en: 'Every skill recharges 1 turn faster.', it: 'Ogni abilità si ricarica un turno prima.' } }],
    [{ id: 'C1', name: { en: 'Call the Beast', it: 'Chiama la bestia' }, desc: { en: 'Learn Call the Beast.', it: 'Impari Chiama la bestia.' }, skill: 'beast' },
      { id: 'C2', name: { en: 'Companion', it: 'Compagno' }, desc: { en: 'The wolf hits harder and has more HP.', it: 'Il lupo colpisce più forte e ha più PV.' } },
      { id: 'C3', name: { en: 'Pack Bond', it: 'Legame del branco' }, desc: { en: 'You and the wolf heal 3 HP each when one of you lands a critical.', it: 'Tu e il lupo recuperate 3 PV quando uno dei due fa un critico.' } },
      { id: 'C4', name: { en: 'Hunter\'s Eye', it: 'Occhio del cacciatore' }, desc: { en: 'Your sight grows by 2 tiles.', it: 'La tua vista cresce di 2 caselle.' } }],
  ],
};

// speed: 2 acts twice per turn, 0.5 every other turn. ai: melee | ranged | erratic. range for ranged attackers.
export const ENEMIES = {
  rat: { art: 'enemy-rat', name: { en: 'Plague Rat', it: 'Ratto della peste' }, hp: 7, ac: 10, hit: 2, dmg: [1, 3], xp: 4, speed: 2, ai: 'melee', pack: 3 },
  skeleton: { art: 'enemy-skeleton', name: { en: 'Skeleton', it: 'Scheletro' }, undead: true, hp: 13, ac: 13, hit: 3, dmg: [2, 6], xp: 8, ai: 'melee' },
  ghoul: { art: 'enemy-ghoul', name: { en: 'Ghoul', it: 'Ghoul' }, undead: true, hp: 19, ac: 11, hit: 4, dmg: [2, 7], xp: 12, ai: 'melee', onHit: 'stun' },
  cultist: { art: 'enemy-cultist', name: { en: 'Cultist', it: 'Cultista' }, hp: 12, ac: 11, hit: 4, dmg: [2, 6], xp: 12, ai: 'ranged', range: 5, shot: 'shadow', minFloor: 2 },
  bat: { art: 'enemy-bat', name: { en: 'Cave Bat', it: 'Pipistrello' }, hp: 10, ac: 14, hit: 5, dmg: [2, 5], xp: 9, speed: 2, ai: 'erratic', pack: 2 },
  goblin: { art: 'enemy-goblin', name: { en: 'Goblin Archer', it: 'Arciere goblin' }, hp: 16, ac: 12, hit: 5, dmg: [3, 7], xp: 14, ai: 'ranged', range: 6, shot: 'arrow' },
  spider: { art: 'enemy-spider', name: { en: 'Cave Spider', it: 'Ragno delle grotte' }, hp: 20, ac: 13, hit: 6, dmg: [3, 7], xp: 16, ai: 'melee', onHit: 'poison' },
  slime: { art: 'enemy-slime', name: { en: 'Acid Slime', it: 'Melma acida' }, hp: 30, ac: 8, hit: 5, dmg: [4, 9], xp: 18, speed: 0.5, ai: 'melee', split: true },
  imp: { art: 'enemy-imp', name: { en: 'Imp', it: 'Diavoletto' }, hp: 22, ac: 15, hit: 7, dmg: [4, 9], xp: 24, ai: 'ranged', range: 6, shot: 'fire' },
  wraith: { art: 'enemy-wraith', name: { en: 'Wraith', it: 'Spettro' }, undead: true, hp: 32, ac: 15, hit: 8, dmg: [4, 9], xp: 30, ai: 'melee', onHit: 'drain' },
  golem: { art: 'enemy-golem', name: { en: 'Obsidian Golem', it: 'Golem d\'ossidiana' }, hp: 60, ac: 17, hit: 8, dmg: [7, 14], xp: 42, speed: 0.5, ai: 'melee' },
  // the cinder forge (act 4): everything here burns, and some of it explodes
  cinderHound: { art: 'enemy-cinder-hound', name: { en: 'Cinder Hound', it: 'Segugio di brace' }, hp: 46, ac: 16, hit: 9, dmg: [6, 11], xp: 46, speed: 2, ai: 'melee', pack: 2 },
  magmaSlime: { art: 'enemy-magma-slime', name: { en: 'Magma Slime', it: 'Melma di magma' }, hp: 72, ac: 12, hit: 8, dmg: [7, 13], xp: 54, speed: 0.5, ai: 'melee', split: true, onHit: 'burn' },
  ashWraith: { art: 'enemy-ash-wraith', name: { en: 'Ash Wraith', it: 'Spettro di cenere' }, hp: 50, ac: 17, hit: 10, dmg: [6, 11], xp: 58, ai: 'ranged', range: 7, shot: 'fire', onHit: 'drain' },
  forgeGolem: { art: 'enemy-forge-golem', name: { en: 'Forge Golem', it: 'Golem di forgia' }, hp: 110, ac: 19, hit: 10, dmg: [9, 16], xp: 84, speed: 0.5, ai: 'melee' },
  // the drowned cathedral (act 5): cold, water and a lot of things that should have stayed dead
  drowned: { art: 'enemy-drowned', name: { en: 'Drowned Sailor', it: 'Marinaio annegato' }, undead: true, hp: 64, ac: 16, hit: 11, dmg: [7, 12], xp: 70, ai: 'melee', onHit: 'stun' },
  frostWisp: { art: 'enemy-frost-wisp', name: { en: 'Frost Wisp', it: 'Fuoco fatuo' }, hp: 38, ac: 17, hit: 10, dmg: [4, 8], xp: 58, speed: 2, ai: 'ranged', range: 6, shot: 'frost', pack: 2 },
  tidePriest: { art: 'enemy-tide-priest', name: { en: 'Tide Priest', it: 'Sacerdote della marea' }, hp: 78, ac: 16, hit: 11, dmg: [7, 13], xp: 88, ai: 'ranged', range: 7, shot: 'frost', onHit: 'poison' },
  paleGolem: { art: 'enemy-pale-golem', name: { en: 'Pale Golem', it: 'Golem pallido' }, hp: 140, ac: 20, hit: 11, dmg: [11, 18], xp: 104, speed: 0.5, ai: 'melee' },
  // the empty throne (act 6): the old cast, promoted
  firstKnight: { art: 'enemy-first-knight', name: { en: 'First Knight', it: 'Primo cavaliere' }, undead: true, hp: 120, ac: 20, hit: 13, dmg: [10, 16], xp: 120, ai: 'melee', onHit: 'drain' },
  // summoned only
  wolf: { art: 'pet-wolf', name: { en: 'Wolf', it: 'Lupo' }, hp: 24, ac: 12, hit: 6, dmg: [4, 8], xp: 0, ai: 'melee' },
  emberling: { art: 'enemy-emberling', name: { en: 'Emberling', it: 'Braciere' }, hp: 16, ac: 14, hit: 8, dmg: [3, 6], xp: 5, ai: 'melee', small: true, onHit: 'burn' },
  hollow: { art: 'enemy-first-knight', name: { en: 'Hollow Knight', it: 'Cavaliere vuoto' }, undead: true, hp: 40, ac: 17, hit: 10, dmg: [6, 10], xp: 22, ai: 'melee', small: true },
  // summoned or split only
  spiderling: { art: 'enemy-spider', name: { en: 'Spiderling', it: 'Ragnetto' }, hp: 8, ac: 12, hit: 5, dmg: [2, 4], xp: 3, ai: 'melee', small: true, onHit: 'poison' },
  slimelet: { art: 'enemy-slime', name: { en: 'Slimelet', it: 'Melmina' }, hp: 10, ac: 9, hit: 4, dmg: [2, 5], xp: 4, ai: 'melee', small: true },
  // bosses
  boneKing: { art: 'boss-bone-king', boss: true, name: { en: 'The Bone King', it: 'Il Re d\'Ossa' }, title: { en: 'Lord of the Ossuary', it: 'Signore dell\'Ossario' },
    hp: 95, ac: 15, hit: 6, dmg: [5, 12], xp: 80, ai: 'melee' },
  broodmother: { art: 'boss-broodmother', boss: true, name: { en: 'The Broodmother', it: 'La Madre della Covata' }, title: { en: 'Queen of a Thousand Eyes', it: 'Regina dai mille occhi' },
    hp: 190, ac: 16, hit: 8, dmg: [6, 12], xp: 160, ai: 'melee', onHit: 'poison' },
  lich: { art: 'boss-lich', boss: true, name: { en: 'The Ashen Lich', it: 'Il Lich di Cenere' }, title: { en: 'The Last Flame of the Abyss', it: 'L\'ultima fiamma dell\'Abisso' },
    hp: 210, ac: 16, hit: 9, dmg: [6, 11], xp: 300, ai: 'ranged', range: 8, shot: 'bolt' },
  chainLord: { art: 'boss-chain-lord', boss: true, name: { en: 'The Chain Lord', it: 'Il Signore delle Catene' }, title: { en: 'Keeper of the Furnace', it: 'Custode della Fornace' },
    hp: 380, ac: 18, hit: 12, dmg: [9, 16], xp: 460, ai: 'melee', onHit: 'burn' },
  frostQueen: { art: 'boss-frost-queen', boss: true, name: { en: 'The Frost Queen', it: 'La Regina del Gelo' }, title: { en: 'The Drowned Bride', it: 'La sposa annegata' },
    hp: 430, ac: 18, hit: 12, dmg: [8, 15], xp: 620, ai: 'ranged', range: 8, shot: 'frost' },
  firstKing: { art: 'boss-first-king', boss: true, name: { en: 'The First King', it: 'Il Primo Re' }, title: { en: 'Who Built the Stairs', it: 'Colui che scavò le scale' },
    hp: 560, ac: 19, hit: 14, dmg: [11, 19], xp: 900, ai: 'melee' },
};

// equipment: power adds damage to attacks and spells, ac adds armor. Names are built from tier adjectives and class bases.
// f: feminine in Italian (the adjective agrees)
export const BASES = {
  sword: { en: 'Sword', it: 'Spada', f: 1 }, axe: { en: 'Axe', it: 'Ascia', f: 1 }, mace: { en: 'Mace', it: 'Mazza', f: 1 },
  staff: { en: 'Staff', it: 'Bastone' }, wand: { en: 'Wand', it: 'Bacchetta', f: 1 }, orb: { en: 'Orb', it: 'Globo' },
  dagger: { en: 'Dagger', it: 'Pugnale' }, kris: { en: 'Kris', it: 'Kris' }, blade: { en: 'Short Blade', it: 'Lama corta', f: 1 },
  plate: { en: 'Plate', it: 'Corazza', f: 1 }, robe: { en: 'Robe', it: 'Veste', f: 1 }, leather: { en: 'Leathers', it: 'Cuoio' },
  ring: { en: 'Ring', it: 'Anello' }, amulet: { en: 'Amulet', it: 'Amuleto' },
};
export const TIER_ADJ = [
  { en: 'Worn', it: ['consunto', 'consunta'] }, { en: 'Sturdy', it: ['robusto', 'robusta'] }, { en: 'Masterwork', it: ['da maestro', 'da maestro'] },
  { en: 'Runed', it: ['runico', 'runica'] }, { en: 'Ancient', it: ['antico', 'antica'] },
];
export const RARITIES = [
  { id: 'common', color: '#d8d2c4', name: { en: 'Common', it: 'Comune' }, weight: 55, mods: 0 },
  { id: 'rare', color: '#5aa9ff', name: { en: 'Rare', it: 'Raro' }, weight: 30, mods: 1 },
  { id: 'epic', color: '#c47bff', name: { en: 'Epic', it: 'Epico' }, weight: 12, mods: 2 },
  { id: 'legendary', color: '#ffb340', name: { en: 'Legendary', it: 'Leggendario' }, weight: 3, mods: 3 },
];
export const LEGENDARY_NAMES = [
  { en: 'Dawnbringer', it: 'Portatrice d\'alba' }, { en: 'Grave Whisper', it: 'Sussurro della tomba' }, { en: 'Emberheart', it: 'Cuore di brace' },
  { en: 'The Last Oath', it: 'L\'ultimo giuramento' }, { en: 'Nightfall', it: 'Calar della notte' }, { en: 'Kingsbane', it: 'Rovina dei re' },
];
// item modifiers: value per tier, label with {0}
export const MODS = {
  hp: { per: 5, en: '+{0} max HP', it: '+{0} PV massimi' },
  hit: { per: 0.5, min: 1, en: '+{0} to hit', it: '+{0} a colpire' },
  power: { per: 0.4, min: 1, en: '+{0} damage', it: '+{0} danni' },
  ac: { per: 0.25, min: 1, en: '+{0} armor', it: '+{0} armatura' },
  crit: { fixed: 1, en: 'Critical range +{0}', it: 'Critico +{0}' },
  regen: { fixed: 1, en: 'Regenerate {0} HP every 3 turns', it: 'Rigeneri {0} PV ogni 3 turni' },
  steal: { fixed: 1, en: 'Heal {0} HP on every hit', it: 'Recuperi {0} PV a ogni colpo' },
  gold: { fixed: 25, en: '+{0}% gold', it: '+{0}% oro' },
  light: { fixed: 1, en: '+{0} sight', it: '+{0} vista' },
};
export const CONSUMABLES = {
  heal: { icon: 'flask-conical', color: '#ff5a5a', name: { en: 'Healing Potion', it: 'Pozione curativa' }, desc: { en: 'Restores half of your HP.', it: 'Ridà metà dei PV.' } },
  fire: { icon: 'scroll', color: '#ff8a3c', name: { en: 'Scroll of Fire', it: 'Pergamena del fuoco' }, desc: { en: 'Burns every enemy in sight.', it: 'Brucia ogni nemico in vista.' } },
  teleport: { icon: 'scroll', color: '#b48cff', name: { en: 'Scroll of Teleport', it: 'Pergamena del teletrasporto' }, desc: { en: 'Moves you to a random place on this floor.', it: 'Ti porta in un punto a caso del piano.' } },
  map: { icon: 'map', color: '#7fd3ff', name: { en: 'Scroll of Mapping', it: 'Pergamena della mappa' }, desc: { en: 'Reveals the whole floor.', it: 'Rivela tutto il piano.' } },
};
export const SLOT_ICON = { weapon: 'sword', armor: 'shield-half', trinket: 'gem' };

// sanctuary: permanent upgrades bought with embers
export const UPGRADES = [
  { id: 'vigor', icon: 'heart', max: 5, cost: [30, 60, 100, 150, 220], name: { en: 'Vigor', it: 'Vigore' }, desc: { en: '+5 max HP per level.', it: '+5 PV massimi per livello.' } },
  { id: 'edge', icon: 'sword', max: 3, cost: [60, 140, 260], name: { en: 'Whetstone', it: 'Cote' }, desc: { en: '+1 damage per level.', it: '+1 danno per livello.' } },
  { id: 'guard', icon: 'shield', max: 2, cost: [80, 200], name: { en: 'Old Scars', it: 'Vecchie cicatrici' }, desc: { en: '+1 armor per level.', it: '+1 armatura per livello.' } },
  { id: 'satchel', icon: 'flask-conical', max: 2, cost: [40, 120], name: { en: 'Satchel', it: 'Bisaccia' }, desc: { en: 'Start with one more healing potion per level.', it: 'Parti con una pozione curativa in più per livello.' } },
  { id: 'fortune', icon: 'coins', max: 2, cost: [50, 130], name: { en: 'Fortune', it: 'Fortuna' }, desc: { en: '+20% gold per level.', it: '+20% oro per livello.' } },
  { id: 'insight', icon: 'sparkles', max: 1, cost: [250], name: { en: 'Insight', it: 'Intuito' }, desc: { en: 'Start every run with one more talent point.', it: 'Ogni partita parte con un punto talento in più.' } },
  { id: 'heirloom', icon: 'key', max: 1, cost: [150], name: { en: 'Family Vault', it: 'Cripta di famiglia' }, desc: { en: 'The best item of your last hero can be taken into the next run.', it: 'L\'oggetto migliore dell\'ultimo eroe può passare alla partita dopo.' } },
  { id: 'torch', icon: 'flame', max: 1, cost: [90], name: { en: 'Better Torch', it: 'Torcia migliore' }, desc: { en: '+1 sight radius.', it: '+1 raggio di vista.' } },
];

// relics: unlocked forever by killing a boss the first time, one can be carried into a run
export const RELICS = {
  crown: { boss: 'boneKing', icon: 'crown', name: { en: 'Crown Shard', it: 'Frammento di corona' }, desc: { en: '+15% damage.', it: '+15% danni.' } },
  gland: { boss: 'broodmother', icon: 'droplet', name: { en: 'Venom Gland', it: 'Ghiandola del veleno' }, desc: { en: 'Your hits poison enemies.', it: 'I tuoi colpi avvelenano.' } },
  phylactery: { boss: 'lich', icon: 'skull', name: { en: 'Phylactery', it: 'Filatterio' }, desc: { en: 'Once per run, rise again at half HP.', it: 'Una volta per partita, ti rialzi con metà dei PV.' } },
  brand: { boss: 'chainLord', icon: 'flame', name: { en: 'Forge Brand', it: 'Marchio della forgia' }, desc: { en: 'You start every floor with a shield worth 15 HP.', it: 'Ogni piano inizi con uno scudo da 15 PV.' } },
  tear: { boss: 'frostQueen', icon: 'snowflake', name: { en: 'Frozen Tear', it: 'Lacrima di ghiaccio' }, desc: { en: 'Your hits slow enemies: they lose every other turn for 1 turn.', it: 'I tuoi colpi rallentano i nemici: saltano un turno su due.' } },
  sigil: { boss: 'firstKing', icon: 'crown', name: { en: 'Founder\'s Sigil', it: 'Sigillo del fondatore' }, desc: { en: '+25% damage and +25% gold.', it: '+25% danni e +25% oro.' } },
};

export const HERO_NAMES = ['Aldric', 'Brenna', 'Cassian', 'Dara', 'Edda', 'Fenn', 'Gisela', 'Hakon', 'Isolde', 'Jory', 'Kaela', 'Lorcan', 'Mira', 'Nils', 'Orla', 'Piers', 'Quill', 'Rhea', 'Soren', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Ysolde'];
