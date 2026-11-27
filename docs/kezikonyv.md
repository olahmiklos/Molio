# Bevezetés

A Molio fogorvosi rendelőkezelő program. Célja, hogy a fogorvosnak és az asszisztensnek minél kevesebbet kelljen adminisztrálnia: a kezelést az orvos diktálja, a program pedig kitölti a kartont, levonja a felhasznált anyagokat a raktárból, és előkészíti a papírmunkát (nyilatkozat, tájékoztató, számla, jelentések).

> Ez a kézikönyv a bemutató (demó) verzióhoz készült. A demóban csak kitalált adatot rögzíts. Ahol egy funkció a demóban csak szemléltetés (például az EESZT-beküldés vagy a számlakiállítás), azt a kézikönyv külön jelzi.

## A demó és a végleges program

- A demó a böngészőben fut, szerver és adatbázis nélkül. Az adatok **csak azon az eszközön és abban a böngészőben** maradnak meg, ahol rögzítetted őket. Másik gépen vagy telefonon a demó a saját mintaadataival indul.
- A demó a kitalált **Cooldent Kft.** adataival indul: egy telephely, egy rendelő, két fogorvos (Dr. Csempesz és Dr. Oláh), tíz minta-páciens.
- A diktálás a böngésző beépített magyar beszédfelismerését használja, és szabályok alapján tölti ki a mezőket. A mesterséges intelligenciával készülő összefoglalók a végleges verzióban lesznek elérhetők.
- A mintaadatok a **Beállítások → Klinika → Visszaállítás alaphelyzetbe** gombbal bármikor visszaállíthatók.
- **(v2.4)** A bemutató a látogatás idejét és az IP-címet naplózza; erre a demó sávja és a kezelés képernyő is figyelmeztet.

## Ajánlott eszközök és böngészők

- **Windows:** Chrome vagy Edge.
- **Mac:** Safari vagy Chrome.
- **iPhone, iPad:** Safari.
- **Android telefon és tablet:** Chrome.

Firefoxban a beépített beszédfelismerés nem érhető el, ott a kezelés leírása begépelhető.

A Molio alkalmazásként is telepíthető. iPhone-on és iPaden: Safari → Megosztás → Főképernyőhöz adás. Androidon és asztali Chrome-ban: menü → Alkalmazás telepítése. Ha új verzió jelenik meg, a program magától frissül. Ha éppen kezelés van folyamatban vagy egy ablak nyitva van, megvárja a végét; addig felül sáv jelzi, és az „Újratöltés most” gombbal azonnal is frissíthető.

# A felület

A felső menüsor (telefonon az alsó sáv) a fő részeket nyitja meg: **Naptár, Páciensek, Kezelés, Teendők, Raktár, Sterilizálás, Beállítások**.

**Súgó és kézikönyv (v2.4):** a fejléc rendelői adatsora (cím, telefon, rendelési idő, Súgó link) megszűnt. A Súgó a **Beállítások** lap tetején lévő **? Súgó és kézikönyv** sorból nyílik (innen tölthető le a PDF-kézikönyv is); a lap alján a **Felhasználói kézikönyv (PDF)** link is ide vezet.


- A zöld **demó sáv** emlékeztet, hogy az adatok csak ezen az eszközön tárolódnak.
- Ha a raktárban valamit sürgősen meg kell rendelni, a menü alatt **narancssárga sáv** jelenik meg; rákattintva a Raktár nyílik meg.
- Ha folyamatban van egy kezelés, a Kezelés menüpont mellett rózsaszín pötty látszik.
- **(v2.4)** A **Teendők** menüpont jelvénye mutatja a kezelendő tételek számát (időpont-ütközések, jóváhagyásra váró tájékoztatók, beosztáson kívüli időpontok, lemondást jelzők); fölé állva látszik a bontás.
- A legtöbb ablak az Esc billentyűvel vagy a jobb felső × gombbal zárható be.

# Naptár és időpontfoglalás

A naptár a két orvos időpontjait mutatja napi, heti és havi nézetben. Minden kezeléstípusnak saját színe van.

**Beosztás szerinti foglalás (v2.4):** időpont csak akkor foglalható, ha az orvos a beosztása szerint rendel (alapbeállítás: kedd–péntek 10:00–20:00, lásd Beállítások → Klinika → Beosztás). A beosztáson kívüli sáv a naptárban csíkozott, nem kattintható; fölé állva látszik az ok. Ha a foglalás (a kezelés és a ráhagyás együtt) a rendelési időn kívülre esne, a foglalás ablaka figyelmeztet, és gombként felkínálja a **legközelebbi rendelési időt szabad hellyel**. Sürgős esetben a **Sürgős eset – a tiltás felülbírálása** jelölővel, kötelező indoklással mégis menthető; ez naplózódik, és az időpont ablakában is látszik.

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

**Törlés és lemondás (v2.4):**

- A gombok az időpont ablakán kívül az **időpont szerkesztő ablakában** is megvannak (**Törlés (téves rögzítés)** és **Lemondás**, jövőbeli, még nem rögzített kezelésű időpontnál), valamint a páciens kartonján, a Kezelések → Következő kezelések részben az időpont sorában (**Törlés**, a **Szerkesztés** mellett).
- A megerősítő ablak felsorolja az időpont összes tételét, és háromféle sorsot kínál: **vissza „javasolt – még nincs időpont” állapotba** (Teendők → Egyeztetendő kezelések), **átkerülnek a páciens másik jövőbeli időpontjára**, vagy **törlés a tételekkel együtt**.
- Ha a páciens erről az időpontról már kapott értesítést, a program megkérdezi, küldjön-e értesítést a lemondásról vagy törlésről (a demóban tényleges küldés nélkül).

## Ha a páciensnek ekkor már van időpontja – összevonás (v2.4)

Ha ugyanannak a páciensnek az új foglalás ideje átfed egy meglévő időpontjával, **A páciensnek ekkor már van időpontja** ablak jelenik meg:

- **Összevonás egy időponttá** (alapértelmezett): az új kezelés a meglévő időpontba kerül; a kezdés marad, az időtartam a két kezelés összege, a ráhagyás a nagyobbik. Eltérő orvosnál a program megkérdezi, melyik orvos maradjon (egy időponthoz egy orvos tartozik). Ha az összevont időpont ütközne a következővel vagy túllógna a rendelési időn, a program felajánlja aznap a legközelebbi megfelelő kezdést (**Áthelyezés**); ha nincs ilyen, másik napot vagy külön időpontot kell választani.
- **Külön időpont:** az új foglalás külön, ütköző időpontként mentődik (a naptárban egymás mellett látszik, és „Időpont-ütközés” teendő keletkezik).
- **Vissza:** semmi nem mentődik.

Az összevonás és a külön foglalás is visszavonható az utána megjelenő üzenet **Visszavonás** gombjával. Ha a páciens a meglévő időpontról már kapott értesítést, a program rákérdez, küldjön-e értesítést a módosításról (a demóban szimulált).

## Ütköző időpontok (v2.4)

- Az egymással átfedő időpontok a naptárban **egymás mellett**, egyenlő szélességű sávokban látszanak, dupla felkiáltójellel és piros kerettel. Szaggatott a keret, ha csak a ráhagyás fedi át a másikat; halvány a jelzés, ha az átfedést szándékosnak jelölték.
- Ha van kezelendő ütközés, a naptár fölött sáv jelzi: **„N időpont-ütközés – kezelendő”**; rákattintva a Teendők ütközés-listája nyílik meg.
- Az időpont ablakában elöl látszik, kivel ütközik (**Ütközik** / **A ráhagyás ütközik**); **Az ütköző időpont megnyitása** gomb a másik időpontot nyitja meg, a **Szándékos átfedés** gomb jóváhagyja az átfedést (például két szék, két asszisztens).
- A Teendők között minden ütközés **Időpont-ütközés** teendőként jelenik meg, lásd a Teendők fejezetet.

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
- **Tájékoztató:** a páciensnek szóló összefoglaló állapota (jóváhagyásra vár, jóváhagyva, elküldve). **(v2.4)** Ha a páciens e-mailes értesítést kér, a jelzés a jóváhagyási sor állapotát mutatja: **tájékoztató: az orvos jóváhagyására vár**, **tájékoztató kiküldve (e-mail)** a dátummal, vagy **tájékoztató: nem került kiküldésre** (lejárt jóváhagyás nélkül, vagy az orvos nem tartotta szükségesnek); rákattintva a Teendők → Jóváhagyásra váró tájékoztatók nyílik meg.
- **Nem történt meg (v2.4):** ha a „Mai feladat” egyik tervezett tételét „nem történt meg” jelöléssel mentetted, a kezelés alatt piros sor mutatja (a megjegyzéssel), és a következő alkalom „következő lépéseként” jelenik meg.
- **♨ S-…:** a kezeléshez használt sterilizált műszercsomag tételszáma.
- **LOT:** a nyomon követett anyagok gyártási száma.
- **Anyagköltség:** a felhasznált anyagok értéke átlagáron.

A nap fejlécében a **Számla előkészítése** és a **PDF ügyfélkarton** gomb található.

**(v2.4)** A kartonon a **Kezelések → Következő kezelések** részben az előjegyzett időpontok és a javasolt kezelések sorában **Kezelés indítása** gomb is van: a kezelés innen indítva is a „Mai feladat” összefoglalóval nyílik. Ha egy másik kezelés még folyamatban van, a program megkérdezi, elveted-e. Az időpont sorában a **Törlés** gomb a teljes időpontot törli (lásd Időpont törlése).

# Kezelés diktálással

## A kezelés indítása

A kezelés a naptárban egy időpontra kattintva (**Kezelés indítása**), vagy a páciens kartonjáról az **Új kezelés** gombbal indul. Időpontból indítva a páciens, a kezelés típusa és a tervezett fog/felszín automatikusan átkerül. **(v2.4)** A páciens kartonjáról az időpont vagy a javasolt kezelés sorában lévő **Kezelés indítása** gombbal is indítható.

## Mai feladat (v2.4)

A kezelés képernyő legfelső sávjában, a **Diktálás** gomb mellett a **Mai feladat** rövid összefoglalója látszik: a tervezett tételek, mellettük az állapotuk (pipával **elvégezve**, **még nincs rögzítve**, **nem történt meg**), több tételnél a „kész” számláló. Ha nincs előre tervezett kezelés, ezt írja ki; a mai kezelés ilyenkor diktálással rögzíthető. A páciens kiemelt egészségügyi figyelmeztetése lenyitás nélkül is mindig látszik.

- A **Részletek** gomb lenyitja: a páciens, az időpont (dátum, idő, időtartam, orvos), az időponthoz rögzített megjegyzés és az előző alkalom „következő lépése”. Innen nyílik **Az időpont teljes összefoglalója** is.
- Ha egy tervezett tétel szándékosan elmarad, a sorában a **Nem történt meg** gombbal jelölheted, rövid megjegyzéssel (nem kötelező); a **Visszavonás** gomb törli a jelölést. Az elmaradt tétel a következő alkalom összefoglalójában „következő lépésként” jelenik meg.
- A jelölés csak tájékoztat: a mentést nem blokkolja, és a diktálás tartalmát nem módosítja. A terv nem töltődik be magától az eredménybe – ami elkészült, azt diktálni vagy rögzíteni kell.
- A sáv új kezelésnél látszik; státuszfelvételnél és lezárt kezelés szerkesztésénél egy rövid tájékoztató sor áll a helyén.

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

### Egyszerű nézet és automatikus felismerő-váltás (v2.4)

A fogorvosoknak szóló (main ági) változatban a diktálás rögzített beállítással fut: a felismerőt, a zajszűrést és a többi technikai beállítást nem kell (és nem lehet) állítani, ezek csak új kiadással változnak. A v2.3-ban leírt felismerő-választó, élő előnézet, zajszűrés- és érzékenység-kapcsoló ezért ebben a nézetben nem látszik.

- **Egyszerű állapotüzenetek:** felvétel közben „Hallgatlak…”, egyszerű hangerőjelző és a hátralévő idő; tanács csak halk („Halk a hang – beszéljen közelebb a mikrofonhoz”), túl hangos vagy hiányzó hang esetén. Leállítás után „Diktálás sikeres – feldolgozom az eredményt…”; ha nem volt értelmezhető beszéd: „Nem sikerült megérteni – kérjük, mondja újra.”
- **Automatikus váltás:** a pontos felismerés mellett a böngésző felismerője a háttérben fut. Ha a pontos felismerés értelmetlen vagy használhatatlan szöveget ad, a program magától a böngésző szövegét használja, és ezt halvány sor jelzi („Alap felismerés – a pontos felismerés most nem adott használható szöveget.”). Teendőd nincs.
- **Hálózat nélkül** a Diktálás gomb inaktív, és üzenet jelzi: „Nincs hálózati kapcsolat – a diktálás most nem érhető el. A kezelést kézzel is rögzítheti.” Ha diktálás közben szakad meg a kapcsolat, a program kb. 15 másodpercen belül legfeljebb háromszor újrapróbálja; ha ez sem sikerül: „A kapcsolat megszakadt – a diktálás nem készült el, mondja újra.”
- **AI-értelmezés:** alapból bekapcsolva; a diktálás sávjában a kapcsolóval kikapcsolható, a mellette lévő **i** (tájékoztató) gomb rövid magyarázatot ad. Ha a napi AI-keret elfogy, a kapcsoló kikapcsol, a diktálás AI nélkül működik tovább.

 a szöveg begépelhető, vagy a **Minta diktálás beszúrása** listából kipróbálható.

## Ellenőrzés

**Az ellenőrzés helye (v2.4):** a ⚠ ellenőrizendő sorok a **Diktálás és jegyzet** részben, közvetlenül a diktált szöveg alatt jelennek meg – csak akkor, ha van ilyen; a rész fejlécében pötty mutatja a számukat. A **Nem ezt mondtam** gomb a rész fejlécének jobb oldalán van. Alatta a fogtérkép és a **Kezelési tételek**, közvetlenül utána a **Felhasznált anyagok** következik.

**Csak a kockázatos eltérés kérdez (v2.4):** az AI és a szabályok eltérése csak kockázatos esetben kap ⚠ jelzést. Kisebb eltérésnél az anyag mennyisége mellett halvány **AI: …** gomb jelenik meg; rákoppintva átveszed az AI értékét. A kézzel javított érték miatt a program nem kérdez újra.

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

## Rövidítések (v2.4)

A rövidítés egy szóval előhívott tételcsoport (műveletek és anyagok mennyiséggel), például „szokásos kontroll”. A nevét kimondva a diktálásban a tételek normál sorként jelennek meg („rövidítésből: …” jelöléssel), és szerkeszthetők. A rövidítés személyes, és nem tartalmaz betegadatot.

- **Módosítás ugyanabban a mondatban:** fogszám („… a 36-osra”), kiegészítés („…, plusz két tampon”), mennyiség felülírása („…, érzéstelenítés két ampulla”), elhagyás („…, de polírozás nélkül”). Az elhagyott sor áthúzva megmarad, és a **Visszaállítás** gombbal visszahozható. Ha a fogszámhoz kötött műveletnél nem hangzik el fog, ⚠ sor kérdezi: **Melyik fog?**; ha a „nélkül” több tételre is illik, a program megkérdezi, melyik maradjon ki.
- **Létrehozás:** a **Diktálás és jegyzet** részben a **Mentés rövidítésként** gombbal a mostani eredményből, vagy a **Beállítások → Diktálás → Rövidítéseim → + Új rövidítés** gombbal kézzel. Az ablakban megadod a nevet (gépelve, vagy a **Név diktálása** gombbal), a további elhangzó alakokat (vesszővel), és kijelölöd a tételeket; a katalógusból és a raktárlistából újak vehetők fel. **Rövidítés mentése** után a következő diktálástól él.
- **Ajánlás:** ha egy kombinációt 30 napon belül háromszor mentesz, a mentés után a program felajánlja: „Gyakran diktálod ezt a csoportot – rövidítést készítsek belőle?” (**Rövidítést készítek**). Ha egy rövidítés anyagmennyiségét többször ugyanúgy módosítod, felajánlja az alapérték frissítését (**Frissítem**).
- **Rövidítéseim:** a Beállítások → Diktálás lapon a lista mutatja a nevet, az elhangzó alakokat, a tételeket és a használatot; a rövidítés ki-be kapcsolható, szerkeszthető, törölhető. A **hibás** jelölés azt mutatja, hogy egyik tétele már nem létezik.

## Tanult javítások és értelmezések (v2.4, v2.5)

- **(v2.4)** A program a kijavított szóból önállóan tanul: a kiejtési javítás csak rád vonatkozik, a szakmai a rendelő minden felhasználójára. A tanult javítások központilag is mentődnek, így eszközcsere után is visszatölthetők; a main ágon tanultak a teszt ágon is érvényesek, fordítva nem.

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
- **(v2.4)** A teszt ágon ezen felül a Beállítások → Diktálás lapon próbabeállítások, a Beállításokban külön **Diktálás-labor** fül, a kezelés képernyőn **Fejlesztői részletek** panel, a Névjegyben a **Látogatások** nézet érhető el. Ezek a main ágon nem jelennek meg, a fogorvosnak nincs velük teendője.

# Páciens-tájékoztató orvosi jóváhagyással

A program minden jóváhagyott kezelésből közérthető összefoglalót készít a páciensnek: mi történt, mire figyeljen otthon, mikor jöjjön legközelebb.

1. Nyisd meg a tájékoztatót a jóváhagyás utáni ablakból, vagy a kartonon a kezelés melletti **tájékoztató** jelzésre kattintva.
2. Olvasd el, és ha kell, javítsd a szöveget.
3. Az orvos a **Orvosként jóváhagyom** gombbal hagyja jóvá. **Jóváhagyás nélkül a tájékoztató nem küldhető ki.**
4. Válaszd ki a csatornát (SMS, e-mail), és küldd el.

Ha a jóváhagyott szöveget módosítod, újra jóvá kell hagyni. A demóban a szöveg sablon alapján készül, és a küldés szimulált. A végleges verzióban a vázlatot a mesterséges intelligencia írja a diktálásból, de a jóváhagyás ott is kötelező.

## Jóváhagyásra váró tájékoztatók (v2.4)

Ha a páciens e-mailes értesítést kér, és van e-mail-címe, a kezelés mentése után a tájékoztató a **Teendők → Jóváhagyásra váró tájékoztatók** lapra kerül, az orvos jóváhagyására. Ha ilyen van, a Naptár fölött sáv jelzi („N tájékoztató vár jóváhagyásra”), és a Teendők jelvényében is számolódik.

1. A **Nézet** választóban válaszd ki az orvost (orvosi nézet: jóváhagyhat), vagy az **Asszisztens – csak az állapot** nézetet.
2. Egy sorra kattintva lenyílik a szöveg. Gombok: **Jóváhagyás és küldés** (e-mailben megy ki), **Szerkesztés** / **Szerkesztés kész**, **Nem szükséges** (indoklás nem kötelező, majd megerősítés), **Megnyitás** (a páciens kartonja).
3. Ha 7 napon belül nincs jóváhagyás, a tájékoztató az **Archívum** nézetbe kerül „nem került kiküldésre” állapottal, és nem megy ki. Onnan a **Visszahozás jóváhagyásra** gombbal új, 7 napos határidővel visszahozható (ekkor sem megy ki semmi).

Tömeges jóváhagyás nincs, hogy az orvos valóban elolvassa, mi megy ki. Minden lépés naplózódik. A demóban a küldés szimulált, valódi e-mail nem megy ki.

# Beleegyező nyilatkozat tableten

1. A kezelés képernyőn nyisd le a **Beleegyező nyilatkozat** részt, és kattints a **Nyilatkozat aláíratása tableten** gombra. (Egy korábbi kezeléshez a kartonról is aláíratható.)
2. A program a kiválasztott kezelésből és fogakból előkészíti a szöveget (tömés, gyökérkezelés, foghúzás, korona, implantátum vagy általános sablon). Az orvos aláírás előtt módosíthatja.
3. Az **Átadom aláírásra** gombbal a szöveg nagy betűvel jelenik meg. A páciens bejelöli, hogy megértette, majd ujjal vagy tollal aláír.
4. Az **Aláírás mentése** után a nyilatkozat PDF-ben a csatolmányok közé és a kartonra kerül.

> A demó nyilatkozatai mintaszövegek. Éles használat előtt szakmai és jogi ellenőrzésük szükséges.

# Teendők, emlékeztetők és kontroll-meghívók

A **Teendők** menü (korábban Emlékeztetők) egységes listába gyűjti az asszisztens feladatait: egyeztetendő időpontok (javasolt kezelések), kiküldendő tájékoztatók, esedékes kontrollok, lemondást jelzett időpontok és a páciensek üzenetei; típus, orvos és sürgősség szerint szűrhető. A raktári teendők a Raktár menüben maradnak. **Tájékoztató** csak rögzített időponthoz küldhető (időpont, javasolt kezelések közérthető felsorolása, forrás-kezelés); időpont nélkül kézzel indítható udvarias, **időpont-egyeztetést kérő** üzenet. A küldés a demóban szimulált.

**Új teendőtípusok (v2.4):**

- **Időpont-ütközés:** az átfedő időpontok. **Megnyitás** (a naptár napi nézetében kiemelve mutatja az ütköző időpontokat), **Áthelyezés…** (melyik időpontot), **Értesítés kiküldése…** (kinek), **Szándékos átfedés** (például két szék, két asszisztens – a feladat lezárul, a naptárban halványabb jelzés marad).
- **Időpont a beosztáson kívül:** olyan jövőbeli időpont, amely az orvos beosztása szerint rendelési időn kívül esik (és nem sürgős felülbírálással készült): **Áthelyezés** vagy **Értesítés**. Az időpont ablakában is figyelmeztetés látszik.
- **Tájékoztató jóváhagyásra vár:** az orvosnak; az **Elolvasás** gomb a Jóváhagyásra váró tájékoztatók lapot nyitja meg.

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

- **Súgó és kézikönyv (v2.4):** a Beállítások lap tetején lévő sor a Súgót és a letölthető PDF-kézikönyvet nyitja meg.
- **Klinika:** név, cím, telefon, a naptár első és utolsó sávja (v2.4: a rendelési időt a beosztás adja), a tejfogazat javaslatának korhatára, a ráhagyás hossza, a mintaadatok visszaállítása.
- **Klinika → Beosztás (v2.4):** három rész, felül a megtekintett nap választójával. Időpont csak akkor foglalható, ha az orvos a beosztás szerint rendel; alapbeállítás kedd–péntek 10:00–20:00, ettől napra vagy időszakra el lehet térni. Az asszisztens- és a recepciós-beosztás nem tilt, csak jelez. A demóban mindenki szerkesztheti.
- **Rendelő (alaprajz):** a rendelők minta-alaprajza a hozzájuk rendelt orvosokkal, rendelési idejükkel és asszisztenseikkel, a recepciós pult és a váróterem. Jelzi, ha nincs recepciós, vagy egy asszisztens egyszerre két helyen van. Alatta a rendelőszobák és a várótermek listája (név átírható, **+ Rendelőszoba**, **+ Váróterem**).
- **Orvosok és asszisztensek:** orvosonként név, naptárszín, rendelő, aktív/inaktív, az asszisztensek kijelölése, a **Heti sablon szerkesztése** és a **Napi eltérések** két hétre (egy napra koppintva: időszakok megadása, **Vissza az alapbeosztásra**, **Nincs rendelés**, **Mentés**). Az adott napra asszisztens választható; jelzés, ha egy rendelési napon nincs asszisztens. **+ Orvos hozzáadása**, az asszisztensek listája (**+ Asszisztens**).
- **Recepció:** ki mikor ül a recepciós pultnál: heti sablon és napi eltérés, alatta a lefedettség (van-e a rendelési időben recepciós).
- A **Beosztás → Rendelő (alaprajz)** részben új rendelő vehető fel (automatikus sorszámozott névvel, pl. „3. rendelő”, átírható), a rendelő, a váróterem és az egyéb helyiségek a **Törlés** gombbal törölhetők (megerősítéssel). Ha a rendelőhöz orvos vagy jövőbeli időpont tartozik, előbb át kell rendelni; ha csak múltbeli adat kapcsolódik hozzá, törlés helyett inaktiválható (az alaprajzról és a választókból eltűnik, a múltbeli adatokban megmarad).
- **Értesítések:** az alapértelmezett emlékeztető és az SMS-, e-mail-sablonok előnézettel.
- **Kezelési csomagok:** kezeléstípusonként az alapidő, a ráhagyás, a díj (tömésnél felszínszám szerint), a kontroll-meghívó időköze, a beleegyező nyilatkozat sablonja, a szín, a diktálási kulcsszavak és az anyagcsomag (alkalmanként, foganként vagy felszínenként). 
- **Diktálás (v2.3):** felismerő-választó (pontos / alap), élő előnézet, zajszűrés, hasonlósági érzékenység, AI-értelmezés kapcsoló, az AI hozzáadott értéke és az „Így diktálj” súgó.
- **Diktálás (v2.4, egyszerű nézet):** a fogorvosoknak szóló változatban a lapon csak az **AI-értelmezés** kapcsolója (alapból bekapcsolva), a **Rövidítéseim** (lásd Rövidítések), a **Tanult javítások** és **Tanult értelmezések**, valamint az **Így diktálj** súgó látszik, a **Diktálás betanítása** indításával. A felismerés technikai beállításai rögzítettek.
- **Diktálás betanítása:** hangpróba szakaszonként, visszajelzés, javaslatok egyenkénti jóváhagyása, előzmények – részletesen a „Diktálás betanítása – lépésről lépésre” fejezetben.
- **Kódtáblák és szinonimák:** szinonimatábla, kódtáblák, a **fogazati státusz felismerési szótára** (korábban a Kezelési csomagoknál), a diktálási **alapszótár**, **személyes javítások**, kitaláció-szűrő, **ismeretlen kifejezések** (egy lépésben hozzárendelhetők), összeférhetőségi szabályok, tanult szabályok és a javítási napló.
- **Anyag-törzsadatok:** anyagcsoportok és anyagok, beszállító, beszerzési idő, átlagár, célkészlet.
- **Kapcsolatok:** az EESZT, a számlázó program és a mesterséges intelligencia bekötésének leírása (a demóban szemléltetés).

# Gyakori kérdések

**Mi az az „Új verzió érhető el” ablak? (v2.3, v2.5)** A nyilvános (main) demón új kiadáskor felugró ablak jelzi az új verziót; nem tűnik el magától, és az oldal csak az **OK** gomb után töltődik újra – magától, csendben soha (iPhone-on és iPaden, a Kezdőképernyőre mentett alkalmazásban is). A folyamatban lévő diktálást előtte piszkozatba mentjük, újratöltés után felajánljuk a folytatást.

**Miért nem látom a másik gépen rögzített adatot?** A demó az adatokat csak abban a böngészőben tárolja, ahol rögzítetted. A végleges rendszerben az adatok központi adatbázisban lesznek.

**Nem működik a diktálás.** Ellenőrizd, hogy a böngésző engedélyt kapott-e a mikrofonhoz, és hogy van-e internetkapcsolat (a beszédfelismeréshez szükséges). Firefoxban nincs beszédfelismerés; ott gépeld be a szöveget. **(v2.4)** Hálózat nélkül a Diktálás gomb inaktív; a kezelés ilyenkor kézzel rögzíthető.

**Miért nem tudok egy sávra időpontot foglalni? (v2.4)** A csíkozott sáv az orvos beosztásán kívül esik. A beosztás a Beállítások → Klinika → Beosztás részben módosítható; sürgős esetben a foglalás ablakában indoklással felülbírálható.

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

## 2.4

- Egyszerű, rögzített beállítású diktálás a fogorvosnak; automatikus váltás a böngésző szövegére, ha a pontos felismerés nem ad használható szöveget; hálózat nélkül a diktálás nem indul, kapcsolatvesztésnél újrapróbálás.
- „Mai feladat” összefoglaló a diktálás gomb mellett, „nem történt meg” jelöléssel; kezelés indítása a páciens kartonjáról.
- Az ellenőrzés a „Diktálás és jegyzet” részben; csak a kockázatos eltérés kérdez (⚠), a kisebb AI-eltérés halvány jelzés; AI-értelmezés alapból bekapcsolva.
- Öntanuló javítások központi mentéssel, első alkalmazáskor jelöléssel és visszavonással; személyes rövidítések (Rövidítéseim), ajánlással.
- Érthetőbb „Diktálás betanítása” szakaszonkénti visszajelzéssel és szavas minősítéssel.
- Naptár: ütköző időpontok egymás mellett, ütközés-sáv és „Időpont-ütközés” teendő; azonos páciens átfedő időpontjánál összevonás egy időponttá; törlés és lemondás a szerkesztő ablakban és a karton Kezelések során, a tételek sorsának választásával.
- Jóváhagyásra váró tájékoztatók az orvosnak, 7 napos határidővel, Archívummal; állapotjelzés a kartonon.
- Beállítások → Klinika → Beosztás: alaprajz, orvosok és asszisztensek, recepció; a foglalás a beosztáshoz kötve, sürgős felülbírálással.
- A Súgó és kézikönyv a Beállításokból érhető el; a fejléc rendelői adatsora megszűnt.

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
