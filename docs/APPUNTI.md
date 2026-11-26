# Dungeon101 — appunti di lavoro

Quello che serve per ripartire senza rileggere il codice. Il README dice cosa fa il gioco, qui c'è come è fatto dentro, dove sono le trappole e cosa resta da fare.

## Dove siamo (26/11/2026)

- Tutto il lavoro del 23-24/11 è in `main` e pubblicato su `dungeon101.github.io`: **27 piani in 9 atti, 6 classi**, talenti, mana, mercante, reliquie a livelli, Santuario a 50 potenziamenti.
- Il 26/11 una revisione completa delle regole ha trovato e sistemato una trentina di bug (sotto, "Fatto il 26/11"). Il selftest ora fallisce se un talento ha un flag che nessuna regola legge.
- Bot (`node bot.mjs 6`): piano medio 5,5 (Maga) – 9,2 (Paladino), **zero vittorie**. È voluto: la prima partita non si vince.
- La pagina del sito `/apps/dungeon101/` è allineata al gioco del 26/11.

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

Screenshot di prova: `$TMPDIR/shot2.mjs` (Playwright, talenti e inventario), `shot3/4` (Santuario), `shot6/8` (HUD e pausa), `shot9` (telefono a 390 px), `shot10` (fine partita: si forza `g.over='dead'` e si spinge un evento `level` in `g.ev` chiamando `d101.after()`), `shot11` (titolo al primo avvio e con progressi). Il server di prova è `http://127.0.0.1:65470`.

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
| `9428cb4` 23/11 sera | `docs/APPUNTI.md` (questo file) e README allineato al gioco a 27 piani |

## Fatto il 24/11

- **Schermata di fine partita** (`endRun()` in `main.js`): chi eri (eroe, classe, livello), i **27 piani come barre** con i boss più alti e quello raggiunto acceso, l'atto e i boss abbattuti, le statistiche con "di 27" e "migliore N" accanto ai punti, le braci guadagnate e il totale nel Santuario, le reliquie salite e l'oggetto messo nella cripta di famiglia, le etichette **Nuovo record** e **Punteggio migliore di sempre** (confrontate con il `meta` di prima della partita), e l'avviso se nel Santuario c'è qualcosa che puoi già comprare (`cheapestUpgrade()`).
- **Titolo**: la tagline dice 27 piani, nove tiranni, sei eroi; sotto "Nuova partita" il numero di eroi; se hai già giocato, una riga di progressi (partite, piano migliore su 27, potenziamenti comprati su 50, reliquie su 15, vittorie); al primo avvio un suggerimento su come funziona il ciclo morte → braci → Santuario.
- Meta e `og:description` di `index.html` aggiornati (erano ancora a nove piani).

## Fatto il 25/11

- **Bug veri sistemati** (erano segnalati da Davide): le pozioni non si impilavano oltre la prima (`give()` non divideva una pila più grande di 9, e le pozioni nascevano sfuse: il Satchell ne dava 1+2 separate, i boss una sola, i piani una sola); Salva di frecce colpiva **tutti** i nemici visibili ignorando il bersaglio, ora è un tiro mirato (una freccia, doppio danno, si ferma sul primo corpo) e con Perforante passa oltre, con Fuoco rapido prende chi sta accanto. Stessa famiglia, corretti anche: Punizione e Martello non si potevano mirare, le pergamene di Fuoco e Gelo colpivano tutto lo schermo (ora il più vicino + chi gli sta accanto), il lupo appariva dove capitava (ora esce sulla casella toccata) e il lupo morto restava in campo come muro. TalentI del cacciatore che non facevano niente: Morso sanguinante (il bleed non veniva mai applicato), Tiratore/Perforante/Fuoco rapido (ora contano davvero, con i nuovi modificatori `ranged` e `trap`).
- **Nuova partita**: reliquie e cimelio non sono più chip col tooltip ma schede con l'effetto scritto, le stelle piene/vuote e "Adesso: livello 2 di 5, … a livello".
- **Barra abilità**: pulsanti 76×78, nome su due righe dentro il pulsante (niente più "…"), i nomi lunghi scendono a 8,5 px, la barra non esce dallo schermo.
- `node bot.mjs` (5-6 partite per classe): 0 vittorie, medie 5.2-9.3. Maga e Cacciatore restano i più deboli: il prossimo lavoro è il bilanciamento, dopo aver insegnato al bot cure, scudi e lupo.

## Fatto il 26/11

- **Boss**: i tre boss nuovi hanno le loro mosse (prima solo l'attacco base). Draco Annegato: soffio di gelo in linea retta che si ferma al primo muro, si immerge e riemerge lontano quando lo raggiungi, chiama gli annegati. Verme di Cenere: pioggia di cenere intorno all'eroe, segugi e braci, a metà vita ti dà fuoco. Ultimo Custode: le sbarre della porta, una croce e poi una X sull'eroe (un passo di lato basta sempre), cavalieri vuoti e golem pallidi. Le loro illustrazioni sono nuove (prima riusavano quelle di altri boss), prompt in `docs/art/prompts/boss-*.txt`.
- **"A metà vita picchia più forte"** era un `e.dmg = [12, 20]` fisso che dal quarto atto *abbassava* i danni del boss: ora è `enrage()`, +20% una volta sola sui danni del piano.
- **Combattimento**: la soglia del critico saliva col livello (dal livello 3 nessun critico); ora scende di 1 ogni 5 livelli (`critChance`). Due talenti "Critico su N+" tengono il migliore invece di sommarsi. Primo sangue si applica. Pioggia di frecce non uccide due volte lo stesso nemico (`strike` esce se il bersaglio è già a terra).
- **Lupo**: c'è dal primo turno per il cacciatore (in `Game.create`), scende le scale con l'eroe, cresce col livello, con Compagno, i talenti `petPower` e il Totem; tira contro l'armatura del nemico e non contro quella dell'eroe; nova, inferno e pergamena del fulmine non lo colpiscono più; camminandoci contro ci si scambia di posto (prima l'eroe lo attaccava).
- **Oggetti**: Cimelio e Cripta di famiglia portano davvero l'oggetto nella partita (prima veniva distrutto); Tasche profonde allarga la borsa; una pila che non entra cade a terra invece di sparire; vendere una pila paga tutti i pezzi; il mercante vende un livello sopra il piano (prima 4-5 già dal piano 2).
- **Stati**: Lacrima di ghiaccio non paralizza più per sempre; furia, grido di guerra, pelle di pietra, sanguinamento e tagliola sui nemici fanno effetto e scadono; Santuario e Consacrazione durano i turni promessi; morte e vittoria nello stesso turno non escono più insieme.
- **Talenti e Santuario**: collegati i flag che non leggeva nessuno (erano 35) e quelli collegati al nodo sbagliato; "Cure +X%" e scudo massimo contano; Secondo respiro e Clessidra contano perché il mana non si riempie più da solo a ogni piano; Velocista e Concentrazione valgono un passo / un'abilità per livello; Artefice di fuga è per partita; Istinto mostra le scale da lontano; Vendetta e Acqua dolce (ora uno scudo) fanno qualcosa; Sigillo, Sigillo di sangue (oro) e Cuore freddo (1 PV a turno) come dice il testo.
- **Interfaccia**: plurali (`t()` accetta "uno|molti"), "Ucciso da Stai bruciando" diventato "Ucciso dalle fiamme", barre di vita e mana leggibili, titolo senza parola orfana, eroi su 3×2, schermata di fine partita che sta in 800 px, nel Santuario quanti potenziamenti puoi già comprare per ripiano, barra XP giusta dal quarto atto, il lupo non ferma il tocca-e-cammina e non finisce nel riquadro del nemico. `learn()` controlla da solo le due scelte di un livello e il secondo ramo al 10 (prima lo faceva solo l'interfaccia: il bot prendeva tutto).

## Cosa resta

1. **Tre talenti senza effetto** (esclusi apposta nel selftest): Muro di ghiaccio (maga B6), Ombra (ladro A7), Trappole (ladro C7b/E6, cacciatore C1b): servono meccaniche nuove (caselle di ghiaccio temporanee, un alleato ombra, trappole nemiche nel dungeon).
2. **I nemici non attaccano mai il lupo**: `enemyAct` mira solo l'eroe. Il lupo muore solo per gli attacchi ad area.
3. **Abilità più care della riserva di mana**: Bestia e Branco 24 contro 16 (si lanciano dal livello 9), Meteora dal 11, Santuario del paladino dal 9. E cinque nodi insegnano l'abilità iniziale della classe (guerriero B1b, ladro C5, chierico B1, paladino C1, cacciatore B1): sono punti sprecati.
4. **Bilanciamento**: Maga e Cacciatore restano i più deboli col bot; il bot però non usa cure, scudi né il lupo con giudizio.
