# Dungeon101 — appunti di lavoro

Quello che serve per ripartire senza rileggere il codice. Il README dice cosa fa il gioco, qui c'è come è fatto dentro, dove sono le trappole e cosa resta da fare.

## Dove siamo (23/11/2026)

- Branch **`feat/piu-piani-piu-classi`**, staccato da `main` di proposito: **non si fa il merge** finché Davide non lo chiede. Otto commit, da `b20171e` a `dcd62c8`.
- Il gioco è passato da **9 piani / 3 classi** a **27 piani in 9 atti / 6 classi**, con talenti, mana, mercante, reliquie a livelli e Santuario a 50 potenziamenti.
- Selftest ok, bot su 6 classi: piano medio 4,7–9,3, **zero vittorie**. È voluto: la difficoltà è tarata perché la prima partita non si vinca.
- Niente è pubblicato: `main` è ancora la versione a 9 piani. Per pubblicare serve unire il branch (o farlo vedere in locale, sotto).

## Come provarlo

```
python -m http.server 8101          # oppure un server già acceso su 127.0.0.1:65470
node tests/selftest.mjs 1           # piani, salvataggi, unione dei progressi + una partita per classe
node tests/selftest.mjs 25          # 25 partite per classe, controlla anche il bilanciamento
node bot.mjs 20                     # solo bilanciamento: piano medio e morti per classe
```

`?debug` nell'indirizzo espone `window.d101` (`g`, `startRun`, `Game`, `hud`, `talents`, `inventory`, `shop`). Per fare uno screenshot con una partita pronta:

```js
window.d101.startRun(window.d101.Game.create({ cls: 'warrior', name: 'Prova', meta: {} }))
```

Screenshot di prova: `$TMPDIR/shot2.mjs` (Playwright, talenti e inventario), `shot3/4` (Santuario), `shot6/8` (HUD e pausa), `shot9` (telefono a 390 px). Il server di prova è `http://127.0.0.1:65470`.

## Mappa del codice

| file | cosa ci sta |
|---|---|
| `js/data.js` | tutti i numeri e i testi del gioco: `ACTS` (9), `FLOORS` (27), `XP_ACT`, `CLASSES` (6), `SKILLS` (27), `TALENTS` (600 nodi), `BRANCHES`, `ENEMIES` (34, 9 boss), `BASES` (31), `MODS` (14), `CONSUMABLES` (16), `UPGRADES` (50) + `UP_GROUPS` (5), `RELICS` (15) + `RELIC_MAX` (5) |
| `js/game.js` | le regole, senza DOM: turni, combattimento, abilità, mana, talenti, mercante, reliquie, spawn |
| `js/dungeon.js` | generazione dei piani: stanze e corridoi, automi cellulari, lava; 6 tavolozze, 9 atti |
| `js/render.js` | canvas: piano dipinto una volta, nebbia, luce, particelle, segnalini, minimappa |
| `js/main.js` | interfaccia: HUD, albero dei talenti, inventario, mercante, Santuario, mappa, pausa, titolo, albo |
| `js/meta.js` | salvataggi (`localStorage`), unione con il cloud, braci e potenziamenti |
| `js/cloud.js` | Firebase `dungeon101-dm`, caricato solo se serve |
| `js/i18n.js` | testi EN/IT. **Molte stringhe stanno su una riga sola**: se manca una virgola il gioco non parte |
| `js/icons.js` | Lucide 1.74.0 come stringhe SVG (`ICONS` + `icon()`) |

## Le regole che contano

- **Specializzazioni** (`game.js`): un eroe apre **un ramo** all'inizio (`p.spec`), il secondo dal **livello 10** (`SPEC_LVL`), massimo due (`SPEC_MAX`). Il ramo si apre comprando il primo talento del ramo. Due scelte sullo stesso livello sono esclusive: comprata una, l'altra è chiusa per sempre (`learn()` lo controlla, la grafica la spegne).
- **Talenti**: 5 rami × 10 livelli × 2 scelte per classe. Gli effetti sono `flag:<nome>` (letti da `flags()`) oppure `skill:<id>` (regalano un'abilità). `ps()` somma equipaggiamento, talenti, `bonus` del Santuario e reliquie.
- **Mana**: ogni abilità costa mana, la classe ha `pool`, `poolLvl` e `regen`. `canCast()` decide, `spend()` scala. La ricarica torna a fine turno.
- **Difficoltà**: `spawn()` scala i PV con `1.45^(piano-1)` e i danni con `1.4^(piano-1)`, ma **i boss scalano per atto** (`actStartHp`, `ac + atto`, xp con `actK`): scalarli per piano faceva un muro e faceva salire il paladino al livello 39.
- **Ritmo dei nemici**: i nemici comuni agiscono **un turno sì e uno no** (`e.turn`), boss e lupi sempre. Serve perché nove nemici per piano altrimenti moltiplicano i turni.
- **Colpi a distanza** (`laneClear`): i muri fermano tutto, i corpi fermano frecce, fuoco, gelo e ragnatela; `shadow` e `bolt` passano sopra i corpi ma non i muri. Usato da `targets()`, dall'IA a distanza, da ragnatela/fulmine e da `rain`.
- **Santuario**: 50 potenziamenti, tutti `max: 5` con cinque costi. Ogni id deve avere un effetto in `bonus` (dentro `Game.create`) e, se serve, un uso in `ps()` o nel gioco: aggiungerne uno senza collegarlo lo rende finto.
- **Reliquie**: 15, legate ai boss, ognuna sale fino a 5 portandola a fine partita (`meta.relics[id]` = livello, `rl()` = livello in corso).
- **Oggetti**: `give(it)` impila nella borsa (fino a 9), `take(it, x, y)` mette a terra, `makeEquip`, `randomLoot`. Il confronto è `itemCompare()` + `statShort()` in `game.js`, la tabella è in `main.js` (`inventory()`).
- **Mercante**: 30% dei piani dal 2, non nei piani dei boss; `merchantStock`, `priceOf`, `sellPrice`, `buy`, `sell`.

## Interfaccia

- **Talenti** (`talents()` in `main.js`): cinque colonne affiancate, dieci livelli in verticale, le due scelte del livello sulla stessa riga; la scheda del nodo è un popup `.tpop` posizionato accanto al nodo (a sinistra se non c'è spazio). Rami chiusi spenti, ramo scelto con la spunta.
- **Inventario**: due colonne. A sinistra slot e borsa (con `×n` e l'angolo verde se batte quello indossato), a destra la scheda con la tabella di confronto: una riga per statistica, due numeri, il delta con la freccia, e l'etichetta **Meglio / Peggio / Uno scambio**.
- **Santuario**: cinque ripiani (Corpo, Mente, Borsa, Fortuna, Discesa) con le linguette in alto; dentro, prima quelli già avviati, poi gli altri, col livello accanto al nome.
- **HUD**: barra abilità con tasto in alto a sinistra, costo di mana in alto a destra (rosso se manca), ricarica al centro, nome sotto; il colore dell'icona dice lo stato. Minimappa cliccabile, mappa grande con nemici e legenda, pausa con statistiche e scorciatoie a Talenti/Inventario/Mappa.
- **Trappole di CSS già pagate**: `.shelf` con `overflow: hidden` si mangiava la fisarmonica; i nomi locali come `icon` o `name` dentro le funzioni di `main.js` coprono `icon()` e `L()` (nel Santuario si usa `icon_`).

## Fatto il 23/11/2026 (pomeriggio, branch `feat/piu-piani-piu-classi`)

| commit | cosa |
|---|---|
| `b20171e` 13:20 | piani, atti e classi parametrici: più piani e più eroi sono dati, non codice. Arrivano `flags()`/`has()` e `bot.mjs` |
| `addfdca` 15:03 | da 6 a **9 atti e 27 piani**, tre boss nuovi (Draco Annegato, Verme di Cenere, Ultimo Custode), tre classi nuove (Chierico, Paladino, Cacciatore), 17 illustrazioni generate e ritagliate tonde |
| `32996d5` 16:11 | cinque rami di talenti per classe (600 nodi), mana al posto delle ricariche, mercante, pozioni impilate, reliquie a 5 livelli |
| `8d3572c` 16:36 | bilanciamento: i nemici agiscono a turni alterni, armatura e xp dei boss per atto, PV dei boss per atto |
| `3b77ebb` 17:06 | i colpi si fermano sui muri e sui corpi (`laneClear`), per l'eroe e per i nemici |
| `4fd9612` 17:26 | **50 potenziamenti** del Santuario a 5 livelli, tutti collegati al motore; talenti affiancati col popup; confronto oggetti a righe |
| `9f2d80f` 17:46 | **specializzazioni** (una all'inizio, la seconda al 10), due scelte per livello con l'altra che si disabilita, Santuario a cinque ripiani, **23 icone mancanti** aggiunte |
| `dcd62c8` 17:54 | interfaccia di gioco: barra abilità leggibile, minimappa cliccabile, mappa con nemici e legenda, pausa con statistiche e scorciatoie, ritocchi per il telefono |

## Cosa resta

1. **Schermata di fine partita e primo avvio**: sono il punto in cui un giocatore nuovo decide se restare. Non ancora toccate.
2. **Bilanciamento**: la Maga (4,8 di piano medio) e il Cacciatore (4,7) sono indietro rispetto al Paladino (9,3). Il bot però non usa cure, scudi né il lupo, quindi le classi di supporto risultano più deboli di quanto siano in mano a una persona. Da guardare prima con il bot corretto, non con i numeri grezzi.
3. **`Cimelio`** (potenziamento del Santuario) ha effetto solo se il Santuario passa l'oggetto alla partita: da verificare end to end.
4. **README**: aggiornato a 27 piani, 9 atti, 6 classi, 50 potenziamenti. Va riletto quando il branch entra in `main`.
5. Pubblicare: unire il branch su `main` (e rifare gli screenshot sul sito, `davide-mariotti.github.io/apps/dungeon101/`, se cambia qualcosa di visibile).
