// v2.5 2. pont: „Diktálás betanítása – lépésről lépésre” – a Súgó fejezete (a kézikönyvben ugyanez: docs/kezikonyv.md).
// A szöveg a kiadott build tényleges gombfeliratait és üzeneteit használja (DictTrain.vue: „Felolvasom”, „Leállítás”, „Tovább”,
// „Tovább így is”, „Mondja el újra”, „Jóváhagyom”, „Nem”, „Újrakezdés”, „Kihagyom most”; visszajelzés: „✔ Jól felismertem”,
// „⚠ Néhány szót másképp hallottam”, „✖ Nem sikerült megérteni”). A main ági egyszerű nézetet írja le; a teszt ági részletek külön szakaszban.
// Javaslattal eldöntve (v2.5 2/2, később felülvizsgálandó): a v2.4 szerinti működést írja le.
export interface HelpBlock { h: string; p?: string[]; li?: string[]; ol?: string[] }

export const TRAIN_HELP_TITLE = 'Diktálás betanítása – lépésről lépésre'

export const TRAIN_HELP: HelpBlock[] = [
  { h: 'Mire való?', p: [
    'A betanítás nem a hangodat tanítja a gépnek. Azt méri, mely szavakat érti félre a felismerő nálad, ezen az eszközön és ezzel a mikrofonnal, és ezekből javítási szabályt javasol. A jóváhagyott szabályok minden további diktálásnál maguktól lefutnak.',
    'A demóban a tanult javítások ezen az eszközön (ebben a böngészőben) érvényesek. Kb. 2 perc; ajánlott, nem kötelező. Az éles bevezetés előtt minden diktáló felhasználónak el kell végeznie.',
  ] },
  { h: 'Előkészület', li: [
    'Csendes hely, és az az eszköz és mikrofon, amellyel a rendelőben ténylegesen diktálsz.',
    'Természetes tempóban beszélj, úgy, ahogy kezelés közben diktálsz.',
  ] },
  { h: 'Lépések', ol: [
    'Nyisd meg: Beállítások → Diktálás betanítása. A képernyő tetején a „Hogyan használd?” sor lenyitva röviden összefoglalja a lépéseket.',
    'Az első szakasznál nyomd meg a „Felolvasom” gombot, és olvasd fel a szöveget egyben. Felvétel közben a sávon látod a hátralévő időt (szakaszonként legfeljebb 30 másodperc); a gomb ilyenkor „Leállítás”. Ha elszóltad magad, mondd el újra.',
    'Visszajelzés a szakasz után: „✔ Jól felismertem” (zöld) – nyomd meg a „Tovább” gombot. „⚠ Néhány szót másképp hallottam” (sárga) – látod a szavakat (pl. felolvasott: fog – hallott: fok). Itt még nem döntesz a szabályról: a „Tovább így is” csak továbblép, a program megjegyzi az eltérést. Ha elszóltad magad, vagy nagyon más lett, nyomd meg a „Mondja el újra” gombot. „✖ Nem sikerült megérteni” (piros) – a program kiírja az okot (pl. „Halk volt a hang – beszéljen közelebb a mikrofonhoz.”); javíts rajta, és nyomd meg a „Mondja el újra” gombot.',
    'A visszajelzés alatt látod, mit tanult a program: „1 új javítási javaslat készült” vagy „Nincs új javítás”.',
    'Folytasd a többi szakasszal. Nem kell mindnek zöldnek lennie: a sárga szakaszokból lesz a javaslat.',
    'A végén, az Összefoglalóban döntsd el a javaslatokat egyenként (pl. „ha ezt hallja: fok → értse úgy: fog”). Tömeges jóváhagyás nincs.',
    'Mentés: automatikus, külön „Eredmény mentése” gomb nincs. Az előzmények a képernyő alján, az „Előzmények” részben látszanak.',
  ] },
  { h: 'Mikor hagyd jóvá a javaslatot?', p: [
    'A kulcskérdés nem az, hogy hasonlít-e a két szó, hanem ez: előfordulhat, hogy a diktálásban a hallott szót valóban azt akarod mondani? Ezt a kérdést a program minden javaslat mellett kiírja.',
  ], li: [
    'Nem fordulhat elő: „Jóváhagyom” (pl. „fok” → „fog”, ha nem diktálsz hőmérsékletről vagy szögről; „harmincsat” → „harminchat”).',
    'Igen, előfordulhat: „Nem” (pl. ha a „hat”-ot „negyvenhét”-nek értené, a szabály minden helyes „hat”-ot elrontana). Számoknál és fogszámoknál légy a legóvatosabb – ezt a javaslatnál külön jelzés mutatja.',
    'Bizonytalan vagy: „Nem”. Ha az eltérés rendszeres, a program később újra felveti.',
    'Nagyon eltérő szavaknál a program nem javasol szabályt, hanem ismétlést kér.',
    'A jóváhagyott szabály azonnal él. Megtekinthető, kikapcsolható, törölhető: Beállítások → Diktálás → Tanult javítások, illetve Beállítások → Kódtáblák és szinonimák → Személyes javítások.',
  ] },
  { h: 'Mit jelent az eredmény?', li: [
    'Az Összefoglalóban szavas minősítés látszik: jó, közepes vagy gyenge. Ez azt mutatja, a felolvasott kifejezések mekkora részét ismerte fel helyesen a felismerő – nem a te pontszámod.',
    'A gyenge eredmény nem hiba: éppen ez a betanítás nyersanyaga.',
    'Értelmetlen szöveg vagy „Nem érkezett értelmezhető beszéd – ismételje meg.” üzenet esetén a hang vagy a kapcsolat volt a gond (halk mikrofon, nincs hálózat): mondd el újra. Ez a szakasz nem számít bele az eredménybe.',
    'Ha a „Most a tartalék felismerő dolgozott, az eredmény így is érvényes.” üzenet jelenik meg, nincs teendőd.',
  ] },
  { h: 'Mikor érdemes megismételni?', li: [
    'Új eszköz vagy új mikrofon esetén.',
    'Ha a diktálás újra gyakran téveszt. Ismételt betanításnál az Összefoglaló megmutatja, javult-e az előzőhöz képest. Az „Újrakezdés” gombbal bármikor újraindítható.',
  ] },
]

/** csak a teszt ágon (fejlesztői nézet): a számszerű értékek */
export const TRAIN_HELP_DEV: HelpBlock = { h: 'Fejlesztői nézet (csak a teszt ágon)', li: [
  'A szakaszok mellett százalék látszik, felismerőnként feliratozva (pl. „Whisper: 80% – böngésző: 70%”): mindegyik a saját felirata szerinti felismerőre vonatkozik; a jobbat a program magától kezeli.',
  'A szavas minősítés határai: jó 90% felett, közepes 75–89%, gyenge 75% alatt.',
  'Az Összefoglalóban a felismerőnkénti és a kategóriánkénti százalék, az Előzményekben a felismerő és a zajszűrés is látszik; a „Fejlesztői részletek” panel a nyers szövegeket mutatja.',
] }
