# Bevezetés

A Molio fogorvosi rendelőkezelő program. Célja, hogy a fogorvosnak és az asszisztensnek minél kevesebbet kelljen adminisztrálnia: a kezelést az orvos diktálja, a program pedig kitölti a kartont, levonja a felhasznált anyagokat a raktárból, és előkészíti a papírmunkát (nyilatkozat, tájékoztató, számla, jelentések).

> Ez a kézikönyv a bemutató (demó) verzióhoz készült. A demóban csak kitalált adatot rögzíts. Ahol egy funkció a demóban csak szemléltetés (például az EESZT-beküldés vagy a számlakiállítás), azt a kézikönyv külön jelzi.

## A demó és a végleges program

- A demó a böngészőben fut, szerver és adatbázis nélkül. Az adatok **csak azon az eszközön és abban a böngészőben** maradnak meg, ahol rögzítetted őket. Másik gépen vagy telefonon a demó a saját mintaadataival indul.
- A demó a kitalált **Cooldent Kft.** adataival indul: egy telephely, egy rendelő, két fogorvos (Dr. Csempesz és Dr. Oláh), tíz minta-páciens.
- A diktálás a böngésző beépített magyar beszédfelismerését használja, és szabályok alapján tölti ki a mezőket. A mesterséges intelligenciával készülő összefoglalók a végleges verzióban lesznek elérhetők.
- A mintaadatok a **Beállítások → Klinika → Visszaállítás alaphelyzetbe** gombbal bármikor visszaállíthatók.

## Ajánlott eszközök és böngészők

- **Windows:** Chrome vagy Edge.
- **Mac:** Safari vagy Chrome.
- **iPhone, iPad:** Safari.
- **Android telefon és tablet:** Chrome.

Firefoxban a beépített beszédfelismerés nem érhető el, ott a kezelés leírása begépelhető.

A Molio alkalmazásként is telepíthető. iPhone-on és iPaden: Safari → Megosztás → Főképernyőhöz adás. Androidon és asztali Chrome-ban: menü → Alkalmazás telepítése. Ha új verzió jelenik meg, a program magától frissül. Ha éppen kezelés van folyamatban vagy egy ablak nyitva van, megvárja a végét; addig felül sáv jelzi, és az „Újratöltés most” gombbal azonnal is frissíthető.

# A felület

A felső menüsor (telefonon az alsó sáv) a fő részeket nyitja meg: **Naptár, Páciensek, Kezelés, Emlékeztetők, Raktár, Sterilizálás, Beállítások**. A legfelső sávban és a lap alján a **Súgó és kézikönyv** link vezet ehhez a kézikönyvhöz.

- A zöld **demó sáv** emlékeztet, hogy az adatok csak ezen az eszközön tárolódnak.
- Ha a raktárban valamit sürgősen meg kell rendelni, a menü alatt **narancssárga sáv** jelenik meg; rákattintva a Raktár nyílik meg.
- Ha folyamatban van egy kezelés, a Kezelés menüpont mellett rózsaszín pötty látszik.
- A legtöbb ablak az Esc billentyűvel vagy a jobb felső × gombbal zárható be.

# Naptár és időpontfoglalás

A naptár a két orvos időpontjait mutatja napi, heti és havi nézetben. Minden kezeléstípusnak saját színe van.

## Időpont foglalása

1. Kattints egy szabad sávra a naptárban, vagy a páciens kartonján az **Időpont foglalása** gombra.
2. Válaszd ki a pácienst, az orvost és a kezelést. Tömésnél megadhatod a tervezett fogat és felszínt is – ez a kezelés indításakor automatikusan átkerül.
3. Állítsd be az emlékeztetőt (SMS, e-mail, időzítés). A páciens választását a program megjegyzi.
4. **Időtartam (v2.3):** a foglalás hossza a kiválasztott kezelés(ek) ideje (pl. gyökérkezelés: 90 perc); a ráhagyás ezen felül, a kezelés után adódik hozzá. Az ablak összesítő sora mutatja a számítást. Kézzel rövidebb idő is megadható (a program figyelmeztet, de engedi), a **Vissza a kezelés szerinti időre** gomb visszaállítja.
5. **Közeli időpont (v2.3):** ha a páciensnek bármelyik orvosnál 7 napon belül már van időpontja, a dátum mellett kiemelt jelzés látszik, a szabad időpontok között a meglévő időpont napja is kiemelve. Mentéskor felugró ablak kérdezi: **hozzáadod a meglévő időponthoz** (az időtartam megnő), **visszalépsz**, vagy **foglalsz az új időpontra**.

## Figyelmeztetések a páciens meglévő időpontjairól (v2.2)

Páciens kiválasztása után a program megmutatja, ha neki már van jövőbeli időpontja: a következő időpontot, az **ugyanazon a napon** lévőt (átfedésnél piros jelzéssel) és a **7 napon belülieket**. Ugyanazon napra újabb időpont foglalása előtt megerősítést kér. Új páciensnél a **kezelő orvos megadása kötelező**; meglévő páciensnél, ha más orvost választasz, csak tájékoztatást kapsz.

## Javasolt kezelések foglalása (v2.2)

Ha a páciensnek vannak javasolt, még be nem ütemezett kezelései, a foglalásnál jelölőnégyzettel kiválaszthatod, melyeket végeznék el ezen az időponton; ami nincs bejelölve, egyeztetendő marad a Teendők között. Minden tételnél látszik, melyik alkalmon javasolták, és ki végzi. Egy időponthoz egy orvos tartozik. Ha a javasolt határidő az időpont előtt lejár, a program figyelmeztet.

## Időpont törlése, összevonása (v2.2)

A jövőbeli időpont **Lemondás** vagy **Törlés** gombja kötelező okot kér, és megkérdezi, mi legyen a javasolt kezelésekkel (visszakerülnek a Teendők közé, vagy átkerülnek a páciens másik időpontjára). A törölt időpont a kartonon **30 napig visszaállítható**, a törlés után pedig a **Visszavonás** gombbal azonnal is. Az **Összevonás** a páciens két időpontját vonja egybe (eltérő orvosnál te döntöd el, ki marad), a **Tételek áthelyezése** egyes tételeket visz át a másik időpontra.

## Ráhagyási idő

A bonyolultabb kezelések (például foghúzás, gyökérkezelés, implantátum) után, illetve a „ráhagyást igényel” jelölésű pácienseknél a naptár tartaléksávot hagy. Ez lila csíkozással látszik, és oda nem foglalható másik időpont. Ha egy páciens az elmúlt évben többször késett, a kartonja felajánlja a jelölés bekapcsolását.

# Páciensek és ügyfélkarton

A **Páciensek** listában névre, telefonszámra vagy TAJ-számra lehet keresni. A páciens nevére kattintva nyílik meg az ügyfélkarton.

## Az ügyfélkarton részei

- **Gyors összefoglaló:** a kartonból automatikusan összeállított kivonat (legutóbbi kezelés, teendő, következő időpont és a meg nem jelenés kockázata).
- **Egészségügyi figyelmeztetés:** például allergia, vérhígító. Mindig piros kiemeléssel látszik, és a nyomtatott (PDF) kartonra is rákerül. Ide csak egészségügyi adat kerül.
- **Belső megjegyzés:** adminisztratív információ (például „cégre kéri a számlát”). Csak kinyitva vagy fölé húzott egérrel látszik, a PDF-re nem kerül rá.
- **Fogazat:** a születési dátum alapján a program tejfogazatot vagy maradó fogazatot javasol; egy kattintással átváltható. A váltás dátummal mentődik.
- **Kontroll:** mikor esedékes a következő fogkő-eltávolítás vagy állapotfelmérés.
- **Fogtérkép:** ívelt, röntgenszerű ábra a korábbi kezelésekkel színkódolva. Egy fog fölé állva látszik a fog története. Ha van feltöltött röntgenkép, egy kattintással arra váltható.
- **Beültetett implantátumok:** fogszám, termék és gyártási szám (LOT).
- **Aláírt nyilatkozatok:** a tableten aláírt beleegyező nyilatkozatok PDF-ben.
- **Kezelések** naponként, a leírással, a felhasznált anyagokkal és a csatolmányokkal.

## A kezelések melletti jelzések

- **EESZT:** beküldésre vár / beküldve. Rákattintva látszik, mi kerülne a jelentésbe.
- **Tájékoztató:** a páciensnek szóló összefoglaló állapota (jóváhagyásra vár, jóváhagyva, elküldve).
- **♨ S-…:** a kezeléshez használt sterilizált műszercsomag tételszáma.
- **LOT:** a nyomon követett anyagok gyártási száma.
- **Anyagköltség:** a felhasznált anyagok értéke átlagáron.

A nap fejlécében a **Számla előkészítése** és a **PDF ügyfélkarton** gomb található.

# Kezelés diktálással

## A kezelés indítása

A kezelés a naptárban egy időpontra kattintva (**Kezelés indítása**), vagy a páciens kartonjáról az **Új kezelés** gombbal indul. Időpontból indítva a páciens, a kezelés típusa és a tervezett fog/felszín automatikusan átkerül.

## Diktálás

Nyomd meg a **Diktálás** gombot, és mondd el, mit csinálsz. Például:

> „36-os fog, meziális és rágófelszíni kompozit tömés. Érzéstelenítés két ampulla artikainnal. Kérek öt tampont. Polírozás.”

A program felismeri:

- a **fogat** többféle formában: „36-os”, „harminchatos”, „jobb alsó hatos”, tejfogaknál „jobb alsó római négyes” is;
- a **felszíneket**: meziális, disztális, okkluzális (rágófelszín), vesztibuláris, lingvális/palatinális, valamint a rövidítéseket (MOD, MO, DO);
- a **kezelés típusát** (tömés, gyökérkezelés, foghúzás, implantátum…);
- az **anyagokat és mennyiségeket** („két ampulla”, „kérek öt tampont”).

### Pontosabb diktálás (v2.3)

- **Felismerő:** a diktálás alapból a **pontos felismerést** (Whisper, szerveroldali) használja szakszó-listával; beszéd közben a böngésző **élő előnézetet** ad, és ha a pontos felismerés nem érhető el, az **alap felismerés** a tartalék (erről jelzés látszik). Egy felvétel legfeljebb 30 másodperces.
- **Felvétel- és hangerőjelző:** a diktálás alatt látszik a felvétel, a hátralévő idő és a hangerő; halk, túl hangos vagy hiányzó hang esetén tanács jelenik meg.
- **Zajszűrés:** a Beállítások → Diktálás lapon kapcsolható (mélyzaj-szűrés, hangerő-kiegyenlítés).
- **Szótár és hasonlóság:** a köznyelvi kifejezéseket („harminc hatos”, „polír pasta”) a program a hivatalos elnevezésre alakítja; ha egy szó csak hasonlít egy ismert kifejezésre, **⚠** jelzéssel rákérdez.
- **Ellenőrzés:** a program összeveti a diktálást az előjegyzett kezeléssel és a fogtérképpel (pl. tömés hiányzó fogon), a kétértelmű mennyiségeknél („három hatos injekció”: 3 db a 6-osból, vagy 3,6) rákérdez; a ⚠ sorokat mentés előtt egyenként meg kell erősíteni.
- **Nem ezt mondtam:** az előnézetben jelezheted, ha a program rosszul hallott vagy rosszul értelmezett; a jelzés a **javítási naplóba** kerül (csak szöveg, betegadat nélkül), és segíti a szabályok tanulását.
- **AI-értelmezés (kísérleti):** a diktálás sávjában kapcsolóval bekapcsolható; eltérésnél ⚠ jelzi, melyik értelmezést választod.
- **Diktálás betanítása:** a Beállítások → Diktálás betanítása lapon felolvasható szakaszokból (kb. 2 perc) a program megméri a pontosságot ezen az eszközön, és személyes javításokat javasol, amelyeket egyenként jóváhagyhatsz. Az eredmény csak ezen az eszközön érvényes.

A teljes szöveg kezelési jegyzetként megmarad, és bármikor javítható. Ha nincs beszédfelismerés, a szöveg begépelhető, vagy a **Minta diktálás beszúrása** listából kipróbálható.

## Ellenőrzés

- **Fogtérkép:** a felismert fog kijelölődik. Kattintással kijelölhetsz vagy levehetsz fogat, a kijelölt fognál a felszínek is kattinthatók.
- **Kezelés közben bővítve:** ha a foglaláskor tervezettnél több felszínt kezelsz, a program jelzi; a díj és az anyag a kezelt felszínek szerint számolódik.
- **Felhasznált anyagok:** a program a kezelési csomagból és a diktálásból javasol. Sárga = ellenőrizendő eltérés, halvány = csak a csomagból javasolt. A mennyiség átírható, a tétel kivehető, új anyag hozzáadható.
- A gyártási számmal nyilvántartott anyagoknál a sor alatt látszik, **melyik tételből (LOT)** fog levonódni – mindig a legkorábban lejáróból. Ha lejárt tétel kerülne sorra, piros figyelmeztetés jelenik meg.

## Műszercsomag és nyilatkozat

- **Sterilizált műszercsomag:** válaszd ki, melyik sterilizálási tétel csomagjával dolgozol. A program alapból a legfrissebb, megfelelt ciklust ajánlja. Ha aznap még nem volt Bowie–Dick-teszt, figyelmeztet.
- **Beleegyező nyilatkozat:** a **Nyilatkozat aláíratása tableten** gombbal (lásd külön fejezet).

## Azonnali előnézet és mentés (v2.2)

A diktálás leállításakor a program azonnal feldolgozza a szöveget, és előnézetet ad a fogakról, tételekről és anyagokról. Csak a **⚠ ellenőrizendő** anyagsorokat kell megerősíteni (**Megerősítem**, vagy a mennyiség átírása); amíg ilyen sor van, a kezelés nem menthető. A **Mentés és véglegesítés** gombbal kerül a kartonba, és csak ekkor vonódik le a készlet. Ha kilépsz mentés nélkül, a diktált szöveg **7 napig piszkozatként megmarad**, a készlet nem változik.

## Jóváhagyás

A **Jóváhagyás és mentés** gomb után:

1. a kezelés a kartonba kerül;
2. az anyagok levonódnak a raktárból (a nyomon követett anyagoknál a gyártási számmal együtt);
3. a program figyelmeztet, ha valamelyik anyag 10% alá csökkent vagy mínuszba ment;
4. felajánlja az érintett fogak státuszának frissítését (tömés után tömött, húzás után hiányzik…);
5. elkészül a **páciens-tájékoztató vázlata**, amelyet az orvosnak jóvá kell hagynia.

Egy korábbi kezelés a kartonon a **Szerkesztés** gombbal módosítható; a különbözet a raktárban korrekcióként jelenik meg.

## Tanult javítások és értelmezések (v2.5)

- Ha kijavítasz egy félreértett szót („Nem ezt mondtam”, vagy a ⚠ sor választása), a program a következő diktálástól magától javítja.
- Ha a szöveg jó volt, de a program rosszul értelmezte (pl. kézzel átírod a mennyiséget, a ⚠ sorban másik fogat vagy anyagot választasz), a javításból **értelmezési szabály** lesz, pl. „kérek öt tampont” → Vattatampon 5 db. Ez a rendelő minden felhasználójára érvényes.
- A fogszámot, műveletet vagy anyagot módosító tanult szabály első alkalmazásakor a sor **„Korábbi javításod alapján”** jelölést kap, és a **Visszavonás** gombbal egy koppintással visszavonható.
- A tanult javítások listája: **Beállítások → Diktálás → Tanult javítások / Tanult értelmezések** (megtekinthető, kikapcsolható, törölhető). A demóban a tanult javítások ezen az eszközön érvényesek; a diktálás mentésekor központilag is mentődnek.

## Fogazati státusz felvétele diktálással

A kezelés képernyőn a **Státuszfelvétel** gombbal válthatsz. Mondd fogról fogra: „18-as és 28-as hiányzik, 16-os korona, 36-os tömött, 13-tól 23-ig ép, a többi ép.” Ilyenkor a program nem jelöl ki kezelést, és nem von le anyagot. A felismert státusz vázlat: a fogra kattintva javítható, és csak a jóváhagyás után mentődik. Ha a diktált állapot ellentmond a korábbi kezeléseknek, a program jelzi.

# Diktálás betanítása – lépésről lépésre

Ez a fejezet a main ági (fogorvosoknak szóló) egyszerű nézetet írja le. A teszt ági részleteket a fejezet végén a „Fejlesztői nézet (csak a teszt ágon)” szakasz tartalmazza.

## Mire való?

A betanítás nem a hangodat tanítja a gépnek. Azt méri, mely szavakat érti félre a felismerő nálad, ezen az eszközön és ezzel a mikrofonnal, és ezekből javítási szabályt javasol. A jóváhagyott szabályok minden további diktálásnál maguktól lefutnak.

A demóban a tanult javítások ezen az eszközön (ebben a böngészőben) érvényesek. Kb. 2 perc; ajánlott, nem kötelező. Az éles bevezetés előtt minden diktáló felhasználónak el kell végeznie.

## Előkészület

- Csendes hely, és az az eszköz és mikrofon, amellyel a rendelőben ténylegesen diktálsz.
- Természetes tempóban beszélj, úgy, ahogy kezelés közben diktálsz.

## Lépések

1. Nyisd meg: **Beállítások → Diktálás betanítása**. A képernyő tetején a **Hogyan használd?** sor lenyitva röviden összefoglalja a lépéseket.
2. Az első szakasznál nyomd meg a **Felolvasom** gombot, és olvasd fel a szöveget egyben. Felvétel közben a sávon látod a hátralévő időt (szakaszonként legfeljebb 30 másodperc); a gomb ilyenkor **Leállítás**. Ha elszóltad magad, mondd el újra.
3. Visszajelzés a szakasz után: **Jól felismertem** (zöld): nyomd meg a **Tovább** gombot. **Néhány szót másképp hallottam** (sárga): látod a szavakat (pl. felolvasott: fog – hallott: fok). Itt még nem döntesz a szabályról: a **Tovább így is** csak továbblép, a program megjegyzi az eltérést. Ha elszóltad magad, vagy nagyon más lett: **Mondja el újra**. **Nem sikerült megérteni** (piros): a program kiírja az okot (pl. halk hang); javíts rajta, és nyomd meg a **Mondja el újra** gombot.
4. A visszajelzés alatt látod, mit tanult a program: „1 új javítási javaslat készült” vagy „Nincs új javítás”.
5. Folytasd a többi szakasszal. Nem kell mindnek zöldnek lennie: a sárga szakaszokból lesz a javaslat.
6. A végén, az Összefoglalóban döntsd el a javaslatokat egyenként (pl. „ha ezt hallja: fok → értse úgy: fog”). Tömeges jóváhagyás nincs.
7. Mentés: automatikus, külön „Eredmény mentése” gomb nincs. Az előzmények a képernyő alján látszanak.

## Mikor hagyd jóvá a javaslatot?

A kulcskérdés nem az, hogy hasonlít-e a két szó, hanem ez: **előfordulhat, hogy a diktálásban a hallott szót valóban azt akarod mondani?** Ezt a kérdést a program minden javaslat mellett kiírja.

- **Nem fordulhat elő:** „Jóváhagyom” (pl. „fok” → „fog”, ha nem diktálsz hőmérsékletről vagy szögről; „harmincsat” → „harminchat”).
- **Igen, előfordulhat:** „Nem” (pl. ha a „hat”-ot „negyvenhét”-nek értené, a szabály minden helyes „hat”-ot elrontana). Számoknál és fogszámoknál légy a legóvatosabb.
- **Bizonytalan vagy:** „Nem”. Ha az eltérés rendszeres, a program később újra felveti.
- Nagyon eltérő szavaknál a program nem javasol szabályt, hanem ismétlést kér.
- A jóváhagyott szabály azonnal él. Megtekinthető, kikapcsolható, törölhető: **Beállítások → Diktálás → Tanult javítások**, illetve **Beállítások → Kódtáblák és szinonimák → Személyes javítások**.

## Mit jelent az eredmény?

- Az Összefoglalóban szavas minősítés látszik: **jó**, **közepes** vagy **gyenge**. Ez azt mutatja, a felolvasott kifejezések mekkora részét ismerte fel helyesen a felismerő – nem a te pontszámod.
- A gyenge eredmény nem hiba: éppen ez a betanítás nyersanyaga.
- Értelmetlen szöveg vagy „Nem érkezett értelmezhető beszéd” üzenet esetén a hang vagy a kapcsolat volt a gond (halk mikrofon, nincs hálózat): mondd el újra. Ez a szakasz nem számít bele az eredménybe.
- Ha a „Most a tartalék felismerő dolgozott” üzenet jelenik meg, nincs teendőd.

## Mikor érdemes megismételni?

- Új eszköz vagy új mikrofon esetén.
- Ha a diktálás újra gyakran téveszt. Ismételt betanításnál az Összefoglaló megmutatja, javult-e az előzőhöz képest; az **Újrakezdés** gombbal bármikor újraindítható.

## Fejlesztői nézet (csak a teszt ágon)

- A szakaszok mellett százalék látszik, felismerőnként feliratozva (pl. „Whisper: 80% – böngésző: 70%”): mindegyik a saját felirata szerinti felismerőre vonatkozik; a jobbat a program magától kezeli.
- A szavas minősítés határai: jó 90% felett, közepes 75–89%, gyenge 75% alatt.
- Az Összefoglalóban a felismerőnkénti és a kategóriánkénti százalék, az Előzményekben a felismerő és a zajszűrés is látszik; a „Fejlesztői részletek” panel a nyers szövegeket mutatja.

# Páciens-tájékoztató orvosi jóváhagyással

A program minden jóváhagyott kezelésből közérthető összefoglalót készít a páciensnek: mi történt, mire figyeljen otthon, mikor jöjjön legközelebb.

1. Nyisd meg a tájékoztatót a jóváhagyás utáni ablakból, vagy a kartonon a kezelés melletti **tájékoztató** jelzésre kattintva.
2. Olvasd el, és ha kell, javítsd a szöveget.
3. Az orvos a **Orvosként jóváhagyom** gombbal hagyja jóvá. **Jóváhagyás nélkül a tájékoztató nem küldhető ki.**
4. Válaszd ki a csatornát (SMS, e-mail), és küldd el.

Ha a jóváhagyott szöveget módosítod, újra jóvá kell hagyni. A demóban a szöveg sablon alapján készül, és a küldés szimulált. A végleges verzióban a vázlatot a mesterséges intelligencia írja a diktálásból, de a jóváhagyás ott is kötelező.

# Beleegyező nyilatkozat tableten

1. A kezelés képernyőn nyisd le a **Beleegyező nyilatkozat** részt, és kattints a **Nyilatkozat aláíratása tableten** gombra. (Egy korábbi kezeléshez a kartonról is aláíratható.)
2. A program a kiválasztott kezelésből és fogakból előkészíti a szöveget (tömés, gyökérkezelés, foghúzás, korona, implantátum vagy általános sablon). Az orvos aláírás előtt módosíthatja.
3. Az **Átadom aláírásra** gombbal a szöveg nagy betűvel jelenik meg. A páciens bejelöli, hogy megértette, majd ujjal vagy tollal aláír.
4. Az **Aláírás mentése** után a nyilatkozat PDF-ben a csatolmányok közé és a kartonra kerül.

> A demó nyilatkozatai mintaszövegek. Éles használat előtt szakmai és jogi ellenőrzésük szükséges.

# Teendők, emlékeztetők és kontroll-meghívók

A **Teendők** menü (korábban Emlékeztetők) egységes listába gyűjti az asszisztens feladatait: egyeztetendő időpontok (javasolt kezelések), kiküldendő tájékoztatók, esedékes kontrollok, lemondást jelzett időpontok és a páciensek üzenetei; típus, orvos és sürgősség szerint szűrhető. A raktári teendők a Raktár menüben maradnak. **Tájékoztató** csak rögzített időponthoz küldhető (időpont, javasolt kezelések közérthető felsorolása, forrás-kezelés); időpont nélkül kézzel indítható udvarias, **időpont-egyeztetést kérő** üzenet. A küldés a demóban szimulált.

## Időpontok és kockázat

Az **Emlékeztetők** oldal a következő hét időpontjait mutatja: ki kér emlékeztetőt, mikor megy ki, visszaigazolta-e, és mekkora a meg nem jelenés kockázata. A becslés a páciens korábbi kimaradásaiból, késéseiből, a foglalás óta eltelt időből és a visszaigazolásból számol. A magas kockázatú pácienseket érdemes telefonon is megkeresni. A demóban az üzenetek nem mennek ki, csak az előnézet és a szimulált küldés látszik.

## Kontroll-meghívók (recall)

A **Kontroll-meghívók** lap azt mutatja, kinél esedékes a rendszeres ellenőrzés: alapból **fogkő-eltávolítás 6 havonta, állapotfelmérés évente**. Az esedékesség a legutóbbi ilyen kezelés dátumából számolódik.

- **Üzenet:** a meghívó szövegének előnézete.
- **Meghívó:** a meghívó elküldése (a demóban szimulált); a lista jelzi, mikor hívtad meg.
- **Időpont:** azonnali foglalás a megfelelő kezeléssel.

Akinek már van ilyen időpontja, az alapból nem látszik. Az időközök kezeléstípusonként a **Beállítások → Kezelési csomagok** lapon módosíthatók.

# Raktár

A készlet telephelyenként vezetett. A kezelés jóváhagyásakor az anyagok automatikusan levonódnak.

## Készlet és előrejelzés

A **Készlet** lap minden anyagnál mutatja az aktuális készletet a célkészlethez képest, az átlagárat, a következő 60 napban lefoglalt kezelések várható fogyását, a várható elfogyás napját és azt, hogy **legkésőbb mikor kell megrendelni** (elfogyás napja mínusz beszerzési idő). A sorrend sürgősség szerinti: piros = elmúlt vagy 3 napon belül, sárga = 7 napon belül, zöld = ráér.

Egy anyagra kattintva látszik a heti fogyás grafikonja, a gyártási tételek, a beállítások (beszállító, beszerzési idő, célkészlet, diktálási kulcsszavak) és a mozgásnapló.

## Bevételezés és átlagár

A **Bevételezés** gombbal rögzítheted a beérkezett árut: mennyiség, **beszerzési egységár**, dátum, és ahol kötelező, a **gyártási szám (LOT)** és a **lejárat**.

A program **gördülő súlyozott átlagárat** számol. Minden bevételezésnél:

> új átlagár = (meglévő készlet × régi átlagár + új mennyiség × új egységár) ÷ teljes mennyiség

Példa: raktáron van 10 db 1000 Ft-os átlagáron, és beérkezik 10 db 1200 Ft-ért. Az új átlagár (10 × 1000 + 10 × 1200) ÷ 20 = **1100 Ft**. Ha ebből felhasználsz 5 db-ot, a maradék 15 db átlagára továbbra is 1100 Ft, és a következő bevételezés ebből számol tovább.

Ezt az árat használja a program a készletértékhez és a kezelések anyagköltségéhez. A bevételezés ablaka még mentés előtt megmutatja az új átlagárat és a számítást.

## Gyártási szám, lejárat, kiadási sorrend

Az érzéstelenítőknél, a tömőanyagoknál, a lenyomatanyagnál és az implantátumoknál a gyártási szám és a lejárat megadása kötelező (anyagonként beállítható). A kiadás **lejárat szerint** történik: a kezeléskor a program mindig a legkorábban lejáró tételből von le, és ezt a kartonba is beírja.

A **Lejárat és nyomon követés** lap a 90 napon belül lejáró tételeket mutatja (piros = 30 napon belül).

## Implantátumok és visszahívás

Az implantátum gyártási száma a páciens kartonjába kerül. Ha a gyártó egy tételt visszahív, a **Lejárat és nyomon követés** lapon írd be a gyártási számot: a program kilistázza, kinél, mikor és melyik foghoz használták, és jelzi, ha a raktárban is van még belőle.

## Rendelési javaslat

A **Rendelési javaslat** lap beszállítónként összegyűjti, mit és mennyit érdemes megrendelni. A javasolt mennyiség a célkészlet, a beszerzési időn belül várható fogyás és a már megrendelt mennyiség alapján számolódik.

**A program csak javasol, nem rendel.** A rendelést mindig egy munkatárs adja le a beszállítónál:

1. Kattints a **Rendelőlap és „megrendeltem”** gombra. A mennyiségek átírhatók.
2. A **Rendelőlap másolása** gombbal a szöveg e-mailbe illeszthető.
3. Add le a rendelést (telefon, e-mail, webshop).
4. Írd be, ki adta le, és kattints a **Megrendeltem** gombra. A javaslat ettől nem duplázódik.
5. Amikor az áru megérkezik, a megrendelés soránál lévő **Bevételezés** gombbal vedd fel (egységárral, LOT-tal), majd **zárd le** a megrendelést.

# Sterilizációs napló

A **Sterilizálás** oldalon vezetheted az autokláv-ciklusokat.

- Minden munkanap első ciklusa előtt rögzítsd a **Bowie–Dick-tesztet**. Ha ez hiányzik, a program a naplóban és a kezelés képernyőn is figyelmeztet.
- Az **Új ciklus** gombbal add meg a készüléket, a programot, a kezelőt, a csomagok számát és tartalmát, valamint az indikátorok eredményét (kémiai, Bowie–Dick, biológiai).
- A program minden ciklusnak tételszámot ad (például **S-261117-2**). Ha valamelyik indikátor nem felelt meg, a ciklus „nem felelt meg” jelzést kap, és a csomagjai nem választhatók ki a kezeléshez.
- A kezeléskor kiválasztott tételszám a kartonba kerül. A naplóban egy ciklusra kattintva látszik, kiknél használták a csomagjait.
- A **Napló letöltése** gomb CSV-fájlt ad, amely Excelben megnyitható.

# EESZT és számlázás

Ezek a demóban **szemléltetések**: semmi nem megy ki, és nem készül valódi számla.

## EESZT

A végleges rendszerben a kezelés jóváhagyásakor a program automatikusan beküldi az ellátási eseményt és az ambuláns lapot az Elektronikus Egészségügyi Szolgáltatási Térbe. A demóban a kartonon a kezelés melletti **EESZT** jelzésre kattintva látszik, milyen adatok kerülnének a jelentésbe, és a beküldés szimulálható.

## Számla

A páciens kartonján a nap fejlécében lévő **Számla előkészítése** gomb a nap kezeléseiből összeállítja a tételeket. Megadható a vevő, a fizetési mód (készpénz, bankkártya, átutalás, egészségpénztári kártya) és az egészségpénztár. A végleges rendszerben a számlát a csatolt számlázó program (például Számlázz.hu vagy Billingo) állítja ki és jelenti a NAV-nak. Az áfakezelést a könyvelővel egyeztetve kell beállítani.

# Beállítások

A **Beállítások → Névjegy / Verzió** mutatja a program verzióját („Demó v2.5 – a specifikáció v2.5 alapján készült”), a build idejét és a kódazonosítót, a használt felismerőt és AI-modellt, a diktálás-értelmezés pontossági mérését (tesztkészlet, az előző kiadáshoz képest), itt van a **Frissítés keresése** gomb és a másolható verzióadat (hibabejelentéshez). A teszt- és a demókörnyezetet jelölés különbözteti meg.

- **Klinika:** név, cím, telefon, rendelési idő, a tejfogazat javaslatának korhatára, a ráhagyás hossza, a mintaadatok visszaállítása. A **Beosztás → Rendelő (alaprajz)** részben új rendelő vehető fel (automatikus sorszámozott névvel, pl. „3. rendelő”, átírható), a rendelő, a váróterem és az egyéb helyiségek a **Törlés** gombbal törölhetők (megerősítéssel). Ha a rendelőhöz orvos vagy jövőbeli időpont tartozik, előbb át kell rendelni; ha csak múltbeli adat kapcsolódik hozzá, törlés helyett inaktiválható (az alaprajzról és a választókból eltűnik, a múltbeli adatokban megmarad).
- **Értesítések:** az alapértelmezett emlékeztető és az SMS-, e-mail-sablonok előnézettel.
- **Kezelési csomagok:** kezeléstípusonként az alapidő, a ráhagyás, a díj (tömésnél felszínszám szerint), a kontroll-meghívó időköze, a beleegyező nyilatkozat sablonja, a szín, a diktálási kulcsszavak és az anyagcsomag (alkalmanként, foganként vagy felszínenként). 
- **Diktálás (v2.3):** felismerő-választó (pontos / alap), élő előnézet, zajszűrés, hasonlósági érzékenység, AI-értelmezés kapcsoló, az AI hozzáadott értéke és az „Így diktálj” súgó.
- **Diktálás betanítása:** hangpróba szakaszonként, visszajelzés, javaslatok egyenkénti jóváhagyása, előzmények – részletesen a „Diktálás betanítása – lépésről lépésre” fejezetben.
- **Kódtáblák és szinonimák:** szinonimatábla, kódtáblák, a **fogazati státusz felismerési szótára** (korábban a Kezelési csomagoknál), a diktálási **alapszótár**, **személyes javítások**, kitaláció-szűrő, **ismeretlen kifejezések** (egy lépésben hozzárendelhetők), összeférhetőségi szabályok, tanult szabályok és a javítási napló.
- **Anyag-törzsadatok:** anyagcsoportok és anyagok, beszállító, beszerzési idő, átlagár, célkészlet.
- **Kapcsolatok:** az EESZT, a számlázó program és a mesterséges intelligencia bekötésének leírása (a demóban szemléltetés).

# Gyakori kérdések

**Mi az az „Új verzió érhető el” ablak? (v2.3, v2.5)** A nyilvános (main) demón új kiadáskor felugró ablak jelzi az új verziót; nem tűnik el magától, és az oldal csak az **OK** gomb után töltődik újra – magától, csendben soha (iPhone-on és iPaden, a Kezdőképernyőre mentett alkalmazásban is). A folyamatban lévő diktálást előtte piszkozatba mentjük, újratöltés után felajánljuk a folytatást.

**Miért nem látom a másik gépen rögzített adatot?** A demó az adatokat csak abban a böngészőben tárolja, ahol rögzítetted. A végleges rendszerben az adatok központi adatbázisban lesznek.

**Nem működik a diktálás.** Ellenőrizd, hogy a böngésző engedélyt kapott-e a mikrofonhoz, és hogy van-e internetkapcsolat (a beszédfelismeréshez szükséges). Firefoxban nincs beszédfelismerés; ott gépeld be a szöveget.

**Elírtam egy anyagmennyiséget a jóváhagyás után.** Nyisd meg a kezelést a kartonon a **Szerkesztés** gombbal, javítsd, és hagyd jóvá újra. A raktár a különbözettel korrigál.

**Miért más az anyag ára, mint a legutóbbi számlán?** A program átlagárat használ: a különböző áron beérkezett tételek súlyozott átlagát. A legutóbbi beszerzési ár az anyag adatlapján külön is látszik.

**Hogyan kezdhetem elölről a kipróbálást?** Beállítások → Klinika → Visszaállítás alaphelyzetbe.

# Verziótörténet

## 2.5

- Hibajavítás (B-008): a main ágon az oldal nem frissül magától; az új verziót mindig a felugró ablak jelzi, újratöltés csak az OK után.
- „Diktálás betanítása – lépésről lépésre” fejezet a Súgóban és a kézikönyvben; „Hogyan használd?” útmutató és döntési kérdés a betanítás képernyőn.
- Rendelő, váróterem és egyéb helyiség törlése a Klinika → Beosztás → Rendelő (alaprajz) részben; inaktiválás múltbeli adatnál.
- Értelmezési javítások tanulása és mérése („Korábbi javításod alapján” jelölés, visszavonás, összesítő a Tanult szabályok fülön).
- Hibajavítás (B-015): az alaprajz rács elrendezésű, az elemek tetszőleges számú rendelőnél sem csúsznak egymásra.

## 2.3

- Pontosabb diktálás: szerveroldali Whisper-felismerés szakszó-listával, élő előnézet, felvétel- és hangerőjelző, zajszűrés, kitaláció-szűrő, tartalék felismerő.
- Diktálási alapszótár, ismeretlen kifejezések gyűjtése, hasonlóság szerinti egyeztetés, ellenőrzés az előjegyzett kezeléssel és a fogtérképpel.
- Javítási napló, „Nem ezt mondtam” jelzés, tanuló szabályok; Diktálás betanítása és személyes javítások; kísérleti AI-értelmezés.
- A fogazati státusz felismerési szótára a Kódtáblák és szinonimák alatt; kiszerelés-változatok az anyagoknál.
- Csatornaválasztó gombok a tájékoztató- és emlékeztető-küldésben (SMS / e-mail).
- Foglalás: az időtartam a kezelés hossza (ráhagyás pluszban), figyelmeztetés és megerősítő ablak 7 napon belüli másik időpontnál.
- Új verzió felugró ablak a main ágon, piszkozatmentéssel.

## 2.2

- Figyelmeztetés a páciens meglévő, azonos napi és 7 napon belüli időpontjaira foglaláskor.
- Időpont törlése okkal, 30 napos visszaállítással; tételek áthelyezése és időpontok összevonása.
- Verziójelzés és „Frissítés keresése”, teszt/demó jelölés, másolható verzióadatok.
- Diktálás azonnali előnézete, csak a ⚠ sorok megerősítésével; mentéskor véglegesül a készletlevonás; 7 napos piszkozat.
- Kötelező kezelő orvos új páciensnél, váltáskor az időpontok átvitele.
- Javasolt kezelés forrásvizitje; több javasolt tétel egy időponton, részleges ütemezéssel és határidő-figyelmeztetéssel.
- Tájékoztató üzenet rögzített időponthoz, udvarias egyeztetést kérő üzenet, egységes Teendők menü.

## 2.0

- Raktár: bevételezés egységárral és gördülő súlyozott átlagárral; gyártási szám (LOT) és lejárat; kiadás lejárat szerint; lejáró tételek; rendelési javaslat beszállítónként (a rendelést munkatárs adja le); implantátum-nyomonkövetés és keresés gyártási számra.
- Digitális beleegyező nyilatkozat tableten aláírva, PDF a kartonba.
- Közérthető páciens-tájékoztató, amely csak orvosi jóváhagyás után küldhető.
- Kontroll-meghívók (recall).
- Sterilizációs napló, a műszercsomag tételszáma a kartonban.
- EESZT-jelentés és számla előkészítése (szemléltetés).
- Letölthető felhasználói kézikönyv, amely minden új kiadással frissül.

## 1.0

- Naptár két orvossal, ráhagyási idő, emlékeztetők és meg nem jelenési kockázat.
- Ügyfélkarton egészségügyi figyelmeztetéssel, fogazatváltással, ívelt fogtérképpel, PDF-kartonnal.
- Kezelés diktálással: fogszám, felszínek, bővítés kezelés közben, anyagjavaslat, díj; fogazati státusz diktálással; csatolmányok.
- Raktár: készlet, automatikus levonás, 60 napos előrejelzés, rendelési határidő.
