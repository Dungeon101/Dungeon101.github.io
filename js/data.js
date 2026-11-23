// Game tables: classes, skills, talents, enemies, items, floors, sanctuary upgrades, relics.
// Everything here is plain data; the rules that use it live in game.js.

// one act every three floors, each with its own look, generator and bestiary. The last floor of an act is its boss.
export const ACTS = [
  { id: 'crypt', name: { en: 'The Crypt', it: 'La Cripta' }, gen: 'rooms', pool: ['rat', 'skeleton', 'ghoul', 'cultist'], boss: 'boneKing' },
  { id: 'caves', name: { en: 'The Fungal Caves', it: 'Le Grotte Fungine' }, gen: 'caves', pool: ['bat', 'goblin', 'spider', 'slime'], boss: 'broodmother' },
  { id: 'abyss', name: { en: 'The Abyss', it: 'L\'Abisso' }, gen: 'abyss', pool: ['imp', 'wraith', 'golem', 'cultist'], boss: 'lich' },
];

// how many floors one act lasts; the whole dungeon is this times the number of acts
export const ACT_LEN = 3;
export const FLOORS = ACTS.length * ACT_LEN;

// index of the act a floor belongs to, clamped so a floor past the end still answers something
export const actIndex = (floor) => Math.max(0, Math.min(ACTS.length - 1, Math.floor((floor - 1) / ACT_LEN)));
export const actOf = (floor) => ACTS[actIndex(floor)];
export const actStart = (floor) => actIndex(floor) * ACT_LEN + 1;
export const isBossFloor = (floor) => floor % ACT_LEN === 0;
export const isLastBoss = (floor) => isBossFloor(floor) && actIndex(floor) === ACTS.length - 1;

// xp needed to go from lvl to lvl+1: steep enough that a full run ends around level 10
export const xpNext = (lvl) => 12 * lvl + 7 * lvl * lvl;

export const CLASSES = {
  warrior: {
    name: { en: 'Warrior', it: 'Guerriero' }, art: 'hero-warrior', color: '#f0a03c',
    blurb: { en: 'Heavy armor, a long sword and no plan B.', it: 'Armatura pesante, spada lunga e nessun piano B.' },
    hp: 36, hpLvl: 8, ac: 15, hit: 4, dmg: [2, 7], crit: 20, skills: ['cleave', 'bash', 'charge'],
    weapons: ['sword', 'axe', 'mace'], armor: 'plate',
    talentIcons: ['shield', 'swords', 'zap'],
    // the talents that only this class can use, by the effects they turn on (see talentBonus in game.js)
    talentFlags: { A1: 'ac2', A2: 'hp15', A3: 'unbreakable', B3: 'rage', C2: 'bloodlust', C3: 'executioner' },
  },
  mage: {
    name: { en: 'Mage', it: 'Maga' }, art: 'hero-mage', color: '#5cc8ff',
    blurb: { en: 'Fragile, far away and very much on fire.', it: 'Fragile, lontana e decisamente in fiamme.' },
    hp: 22, hpLvl: 4, ac: 11, hit: 3, dmg: [1, 4], crit: 20, skills: ['firebolt', 'nova', 'blink'],
    weapons: ['staff', 'wand', 'orb'], armor: 'robe',
    talentIcons: ['flame', 'snowflake', 'sparkles'],
    talentFlags: { B2: 'ac3', B3: 'shatter', C2: 'fastskills', C3: 'ward' },
  },
  rogue: {
    name: { en: 'Rogue', it: 'Ladro' }, art: 'hero-rogue', color: '#5ee08a',
    blurb: { en: 'Strikes first, strikes twice, is gone before the third.', it: 'Colpisce per primo, colpisce due volte, al terzo è già sparito.' },
    hp: 26, hpLvl: 6, ac: 13, hit: 5, dmg: [3, 6], crit: 19, skills: ['shadowstep', 'venom', 'smoke'],
    weapons: ['dagger', 'kris', 'blade'], armor: 'leather',
    talentIcons: ['footprints', 'droplet', 'wind'],
    talentFlags: { A1: 'ac2', A2: 'ambush', A3: 'assassin', B3: 'virulence', C2: 'lucky', C3: 'secondwind' },
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
};

// three branches per class, three tiers each; a tier needs the one above in the same branch
export const TALENTS = {
  warrior: [
    [{ id: 'A1', name: { en: 'Iron Skin', it: 'Pelle di ferro' }, desc: { en: '+2 armor.', it: '+2 armatura.' } },
      { id: 'A2', name: { en: 'Vitality', it: 'Vitalità' }, desc: { en: '+15 max HP.', it: '+15 PV massimi.' } },
      { id: 'A3', name: { en: 'Unbreakable', it: 'Indistruttibile' }, desc: { en: 'Once per floor, a killing blow leaves you at 1 HP.', it: 'Una volta per piano, un colpo mortale ti lascia a 1 PV.' } }],
    [{ id: 'B1', name: { en: 'Shield Bash', it: 'Colpo di scudo' }, desc: { en: 'Learn Shield Bash.', it: 'Impari Colpo di scudo.' }, skill: 'bash' },
      { id: 'B2', name: { en: 'Concussion', it: 'Commozione' }, desc: { en: 'Bash stuns for 3 turns and recharges 1 turn faster.', it: 'Il Colpo di scudo stordisce per 3 turni e si ricarica un turno prima.' } },
      { id: 'B3', name: { en: 'Rage', it: 'Furia' }, desc: { en: '+50% damage while below half HP.', it: '+50% danni sotto metà PV.' } }],
    [{ id: 'C1', name: { en: 'Charge', it: 'Carica' }, desc: { en: 'Learn Charge.', it: 'Impari Carica.' }, skill: 'charge' },
      { id: 'C2', name: { en: 'Bloodlust', it: 'Sete di sangue' }, desc: { en: 'Heal 3 HP on every kill.', it: 'Recuperi 3 PV a ogni uccisione.' } },
      { id: 'C3', name: { en: 'Executioner', it: 'Boia' }, desc: { en: '+60% damage to enemies below 30% HP.', it: '+60% danni ai nemici sotto il 30% dei PV.' } }],
  ],
  mage: [
    [{ id: 'A1', name: { en: 'Kindling', it: 'Esca' }, desc: { en: 'Firebolt sets the target on fire for 3 turns.', it: 'Il Dardo di fuoco incendia il bersaglio per 3 turni.' } },
      { id: 'A2', name: { en: 'Pyromancy', it: 'Piromanzia' }, desc: { en: 'Firebolt recharges 1 turn faster.', it: 'Il Dardo di fuoco si ricarica un turno prima.' } },
      { id: 'A3', name: { en: 'Inferno', it: 'Inferno' }, desc: { en: 'Firebolt explodes, hitting enemies next to the target.', it: 'Il Dardo di fuoco esplode e colpisce i nemici vicini al bersaglio.' } }],
    [{ id: 'B1', name: { en: 'Frost Nova', it: 'Nova di gelo' }, desc: { en: 'Learn Frost Nova.', it: 'Impari Nova di gelo.' }, skill: 'nova' },
      { id: 'B2', name: { en: 'Ice Armor', it: 'Armatura di ghiaccio' }, desc: { en: '+3 armor.', it: '+3 armatura.' } },
      { id: 'B3', name: { en: 'Shatter', it: 'Frantumare' }, desc: { en: 'Frozen or stunned enemies take +60% damage.', it: 'I nemici congelati o storditi subiscono +60% danni.' } }],
    [{ id: 'C1', name: { en: 'Blink', it: 'Traslazione' }, desc: { en: 'Learn Blink.', it: 'Impari Traslazione.' }, skill: 'blink' },
      { id: 'C2', name: { en: 'Arcane Flow', it: 'Flusso arcano' }, desc: { en: 'Every skill recharges 1 turn faster.', it: 'Ogni abilità si ricarica un turno prima.' } },
      { id: 'C3', name: { en: 'Arcane Ward', it: 'Protezione arcana' }, desc: { en: '25% chance to ignore an enemy hit.', it: '25% di probabilità di ignorare un colpo nemico.' } }],
  ],
  rogue: [
    [{ id: 'A1', name: { en: 'Swiftness', it: 'Rapidità' }, desc: { en: '+2 armor.', it: '+2 armatura.' } },
      { id: 'A2', name: { en: 'Ambush', it: 'Imboscata' }, desc: { en: 'Your first hit on each enemy is a critical.', it: 'Il primo colpo su ogni nemico è un critico.' } },
      { id: 'A3', name: { en: 'Assassin', it: 'Assassino' }, desc: { en: 'Critical hits deal triple damage.', it: 'I critici fanno il triplo dei danni.' } }],
    [{ id: 'B1', name: { en: 'Poison Blade', it: 'Lama avvelenata' }, desc: { en: 'Learn Poison Blade.', it: 'Impari Lama avvelenata.' }, skill: 'venom' },
      { id: 'B2', name: { en: 'Toxicity', it: 'Tossicità' }, desc: { en: 'Poison deals more damage and lasts longer.', it: 'Il veleno fa più danni e dura di più.' } },
      { id: 'B3', name: { en: 'Virulence', it: 'Virulenza' }, desc: { en: 'Poisoned enemies take +30% damage from you.', it: 'I nemici avvelenati subiscono +30% danni da te.' } }],
    [{ id: 'C1', name: { en: 'Smoke Bomb', it: 'Bomba fumogena' }, desc: { en: 'Learn Smoke Bomb.', it: 'Impari Bomba fumogena.' }, skill: 'smoke' },
      { id: 'C2', name: { en: 'Lucky', it: 'Fortunato' }, desc: { en: 'Critical on 18-20 and +25% gold.', it: 'Critico con 18-20 e +25% oro.' } },
      { id: 'C3', name: { en: 'Second Wind', it: 'Secondo fiato' }, desc: { en: 'Once per floor, heal 35% when you drop below 25% HP.', it: 'Una volta per piano, recuperi il 35% quando scendi sotto il 25% dei PV.' } }],
  ],
};

// speed: 2 acts twice per turn, 0.5 every other turn. ai: melee | ranged | erratic. range for ranged attackers.
export const ENEMIES = {
  rat: { art: 'enemy-rat', name: { en: 'Plague Rat', it: 'Ratto della peste' }, hp: 7, ac: 10, hit: 2, dmg: [1, 3], xp: 4, speed: 2, ai: 'melee', pack: 3 },
  skeleton: { art: 'enemy-skeleton', name: { en: 'Skeleton', it: 'Scheletro' }, hp: 13, ac: 13, hit: 3, dmg: [2, 6], xp: 8, ai: 'melee' },
  ghoul: { art: 'enemy-ghoul', name: { en: 'Ghoul', it: 'Ghoul' }, hp: 19, ac: 11, hit: 4, dmg: [2, 7], xp: 12, ai: 'melee', onHit: 'stun' },
  cultist: { art: 'enemy-cultist', name: { en: 'Cultist', it: 'Cultista' }, hp: 12, ac: 11, hit: 4, dmg: [2, 6], xp: 12, ai: 'ranged', range: 5, shot: 'shadow', minFloor: 2 },
  bat: { art: 'enemy-bat', name: { en: 'Cave Bat', it: 'Pipistrello' }, hp: 10, ac: 14, hit: 5, dmg: [2, 5], xp: 9, speed: 2, ai: 'erratic', pack: 2 },
  goblin: { art: 'enemy-goblin', name: { en: 'Goblin Archer', it: 'Arciere goblin' }, hp: 16, ac: 12, hit: 5, dmg: [3, 7], xp: 14, ai: 'ranged', range: 6, shot: 'arrow' },
  spider: { art: 'enemy-spider', name: { en: 'Cave Spider', it: 'Ragno delle grotte' }, hp: 20, ac: 13, hit: 6, dmg: [3, 7], xp: 16, ai: 'melee', onHit: 'poison' },
  slime: { art: 'enemy-slime', name: { en: 'Acid Slime', it: 'Melma acida' }, hp: 30, ac: 8, hit: 5, dmg: [4, 9], xp: 18, speed: 0.5, ai: 'melee', split: true },
  imp: { art: 'enemy-imp', name: { en: 'Imp', it: 'Diavoletto' }, hp: 22, ac: 15, hit: 7, dmg: [4, 9], xp: 24, ai: 'ranged', range: 6, shot: 'fire' },
  wraith: { art: 'enemy-wraith', name: { en: 'Wraith', it: 'Spettro' }, hp: 32, ac: 15, hit: 8, dmg: [4, 9], xp: 30, ai: 'melee', onHit: 'drain' },
  golem: { art: 'enemy-golem', name: { en: 'Obsidian Golem', it: 'Golem d\'ossidiana' }, hp: 60, ac: 17, hit: 8, dmg: [7, 14], xp: 42, speed: 0.5, ai: 'melee' },
  // summoned or split only
  spiderling: { art: 'enemy-spider', name: { en: 'Spiderling', it: 'Ragnetto' }, hp: 8, ac: 12, hit: 5, dmg: [2, 4], xp: 3, ai: 'melee', small: true, onHit: 'poison' },
  slimelet: { art: 'enemy-slime', name: { en: 'Slimelet', it: 'Melmina' }, hp: 10, ac: 9, hit: 4, dmg: [2, 5], xp: 4, ai: 'melee', small: true },
  // bosses
  boneKing: { art: 'boss-bone-king', boss: true, name: { en: 'The Bone King', it: 'Il Re d\'Ossa' }, title: { en: 'Lord of the Ossuary', it: 'Signore dell\'Ossario' },
    hp: 95, ac: 15, hit: 6, dmg: [4, 10], xp: 80, ai: 'melee' },
  broodmother: { art: 'boss-broodmother', boss: true, name: { en: 'The Broodmother', it: 'La Madre della Covata' }, title: { en: 'Queen of a Thousand Eyes', it: 'Regina dai mille occhi' },
    hp: 190, ac: 15, hit: 8, dmg: [5, 11], xp: 160, ai: 'melee', onHit: 'poison' },
  lich: { art: 'boss-lich', boss: true, name: { en: 'The Ashen Lich', it: 'Il Lich di Cenere' }, title: { en: 'The Last Flame of the Abyss', it: 'L\'ultima fiamma dell\'Abisso' },
    hp: 260, ac: 16, hit: 9, dmg: [6, 12], xp: 300, ai: 'ranged', range: 8, shot: 'bolt' },
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
};

export const HERO_NAMES = ['Aldric', 'Brenna', 'Cassian', 'Dara', 'Edda', 'Fenn', 'Gisela', 'Hakon', 'Isolde', 'Jory', 'Kaela', 'Lorcan', 'Mira', 'Nils', 'Orla', 'Piers', 'Quill', 'Rhea', 'Soren', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Ysolde'];
