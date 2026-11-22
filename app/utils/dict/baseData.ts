// Diktálási alapszótár v0.1 (131 sor) – forrás: Molio_alapszotar_diktalas (Google Sheets, Drive: 03_Adatbazis), 2026-11-22.
// Oszlopok: azonosító | kategória | elhangzó formák (;) | hivatalos elnevezés | kód / érték | megjegyzés
// A demóban a teljes szótár ellenőrzés nélkül működik (spec v2.3, 4. pont); az ellenőrzési állapot csak a végleges változatban jelenik meg.
export const BASE_RAW = `SZ-001|Fogszám|jobb felső [pozíció]; jobb fent [pozíció]; felső jobb [pozíció]|1. kvadráns (páciens jobb felső)|1x|Kvadráns + pozíció, pl. „jobb felső hatos” = 16. Oldal a páciens szemszögéből (FDI).
SZ-002|Fogszám|bal felső [pozíció]; bal fent [pozíció]; felső bal [pozíció]|2. kvadráns (páciens bal felső)|2x|Pl. „bal felső hármas” = 23.
SZ-003|Fogszám|bal alsó [pozíció]; bal lent [pozíció]; alsó bal [pozíció]|3. kvadráns (páciens bal alsó)|3x|Pl. „bal alsó hatos” = 36.
SZ-004|Fogszám|jobb alsó [pozíció]; jobb lent [pozíció]; alsó jobb [pozíció]|4. kvadráns (páciens jobb alsó)|4x|Pl. „jobb alsó nyolcas” = 48.
SZ-005|Fogszám|36-os; harminchatos; harminc hatos; három-hat; hármas-hatos|FDI fogszám (példa: 36)|36|Általános minta minden FDI-számra (11–48, tejfog 51–85): számmal, szóval, két számjegyként mondva.
SZ-006|Fogszám|egyes; nagymetsző; középső metsző|Középső metszőfog (pozíció 1)|x1|Kvadráns nélkül önmagában nem azonosít fogat, ⚠ kérdés.
SZ-007|Fogszám|kettes; kismetsző; oldalsó metsző|Oldalsó metszőfog (pozíció 2)|x2|
SZ-008|Fogszám|hármas; szemfog|Szemfog (pozíció 3)|x3|
SZ-009|Fogszám|négyes; első kisőrlő|Első kisőrlő (pozíció 4)|x4|
SZ-010|Fogszám|ötös; második kisőrlő|Második kisőrlő (pozíció 5)|x5|
SZ-011|Fogszám|hatos; első nagyőrlő; első zápfog|Első nagyőrlő (pozíció 6)|x6|„Hatos” mennyiségként vagy anyagváltozatként is elhangozhat, lásd SZ-097.
SZ-012|Fogszám|hetes; második nagyőrlő; második zápfog|Második nagyőrlő (pozíció 7)|x7|
SZ-013|Fogszám|nyolcas; bölcsességfog; bölcsesség; harmadik nagyőrlő|Harmadik nagyőrlő (pozíció 8)|x8|Kvadráns nélkül: 18/28/38/48 közül ⚠ választás.
SZ-014|Fogszám|zápfog; őrlőfog|Őrlőfog (kis- vagy nagyőrlő)|x4–x8|Köznyelvi, nem egyértelmű pozíció: ⚠ kérdés.
SZ-015|Fogszám|tejfog jobb felső [pozíció]; jobb felső tej [pozíció]|Tejfog, 5. kvadráns|5x|Tejfogaknál pozíció 1–5. Gyermek fogtérképnél a kvadráns szóban elhagyható.
SZ-016|Fogszám|tejfog bal felső [pozíció]|Tejfog, 6. kvadráns|6x|
SZ-017|Fogszám|tejfog bal alsó [pozíció]|Tejfog, 7. kvadráns|7x|
SZ-018|Fogszám|tejfog jobb alsó [pozíció]|Tejfog, 8. kvadráns|8x|
SZ-019|Fogszám|tejőrlő; tejzápfog|Tejőrlő (pozíció 4–5)|x4–x5|
SZ-020|Fogszám|felső fogsor; felső állcsont; felül|Felső állcsont (maxilla)|Q1+Q2|Fogtól független vagy több fogat érintő tételhez.
SZ-021|Fogszám|alsó fogsor; alsó állcsont; alul|Alsó állcsont (mandibula)|Q3+Q4|
SZ-022|Fogszám|felső front; felső frontfogak|Felső frontfogak|13–23|
SZ-023|Fogszám|alsó front; alsó frontfogak|Alsó frontfogak|33–43|
SZ-024|Fogszám|teljes szájüreg; az egész fogsor; mindenhol|Teljes fogazat|ALL|Pl. fogkő-eltávolításnál.
SZ-025|Felszín|mesialis; meziális; mézial; elülső felszín; középvonal felőli|Mesialis felszín|M|
SZ-026|Felszín|distalis; disztális; hátsó felszín|Distalis felszín|D|
SZ-027|Felszín|occlusalis; okkluzális; okklúziós; rágófelszín; rágólap; rágó|Occlusalis felszín|O|Őrlőfogaknál.
SZ-028|Felszín|incisalis; inciziális; vágóél; metszőél|Incisalis felszín (él)|I|Frontfogaknál.
SZ-029|Felszín|buccalis; bukkális; pofa felőli; arc felőli|Buccalis felszín|B|Oldalsó fogaknál.
SZ-030|Felszín|vestibularis; vesztibuláris; labialis; labiális; ajak felőli|Vestibularis / labialis felszín|V|Frontfogaknál; a kódkészletben B-vel összevonható.
SZ-031|Felszín|lingualis; linguális; nyelv felőli; nyelvi|Lingualis felszín|L|Alsó fogaknál.
SZ-032|Felszín|palatinalis; palatinális; szájpad felőli|Palatinalis felszín|P|Felső fogaknál; a kódkészletben L-lel összevonható.
SZ-033|Felszín|MO; em-o; em ó; meziookkluzális; mezio-okkluzális|Mesio-occlusalis|M+O|
SZ-034|Felszín|DO; dé-o; dé ó; disztookkluzális; diszto-okkluzális|Disto-occlusalis|D+O|
SZ-035|Felszín|MOD; em-o-dé; em ó dé; meziookkluzodisztális|Mesio-occluso-distalis|M+O+D|
SZ-036|Felszín|nyaki; cervicalis; fognyaki; ötödik osztály; Black V|Cervicalis (nyaki) terület|C|A felszín (B/L) megadása szükséges lehet: ⚠.
SZ-037|Felszín|egyfelszínű; kétfelszínű; háromfelszínű|Felszínek száma|1 / 2 / 3|Az árhoz számít; ha a felszínek nincsenek megnevezve, ⚠.
SZ-038|Fogállapot|hiányzik; nincs meg; hiányzó; nincs fog|Hiányzó fog|HIANYZIK|
SZ-039|Fogállapot|kihúzva; extrahálva; ki lett húzva|Extrahált fog|EXTRAHALVA|Múltbeli állapot; jelen idejű „kihúztam” = művelet (SZ-055).
SZ-040|Fogállapot|szuvas; lyukas; caries; kariesz; szuvasodás; kariózus|Szuvas (carieses) fog|SZUVAS|
SZ-041|Fogállapot|tömött; tömés van benne; plombás; plomba|Tömött fog|TOMOTT|
SZ-042|Fogállapot|koronás; korona van rajta; sapka; sapkás|Koronával ellátott fog|KORONA|
SZ-043|Fogállapot|implantátum; implant; beültetett; csavar|Implantátum|IMPLANTATUM|„Csavar” köznyelvi, ellenőrizendő.
SZ-044|Fogállapot|hídpillér; híd tagja; hídtag; hídláb; hídtest|Híd tagja|HID|Pillér és hídtest megkülönböztetése a kódkészletben döntendő.
SZ-045|Fogállapot|gyökérmaradvány; csonk; radix; gyökércsonk|Gyökérmaradvány|GYOKERMARADVANY|
SZ-046|Fogállapot|tejfog; tej|Tejfog|TEJFOG|
SZ-047|Fogállapot|maradó; maradó fog; végleges fog|Maradó fog|MARADO|
SZ-048|Fogállapot|gyökérkezelt; gyöki van benne; ki van gyökerezve|Gyökérkezelt fog|GYOKERKEZELT|A jelenlegi fogállapot-kódkészletben nincs: felvétel javasolt.
SZ-049|Fogállapot|mozog; lötyög; mozgatható; laza|Mozgatható fog|MOZGATHATO|A jelenlegi kódkészletben nincs: felvétel javasolt (fokozattal).
SZ-050|Fogállapot|nem tört át; retineált; bent maradt; áttöretlen|Retineált fog|RETINEALT|A jelenlegi kódkészletben nincs: felvétel javasolt.
SZ-051|Fogállapot|törött; letört; repedt; repedés|Törött / repedt fog|TOROTT|A jelenlegi kódkészletben nincs: felvétel javasolt.
SZ-052|Fogállapot|ép; egészséges; rendben van|Ép fog|EP|
SZ-053|Fogállapot|ideiglenes tömés van benne; ideiglenes|Ideiglenes tömés|IDEIGLENES_TOMES|
SZ-054|Fogállapot|fogkő; fogköves; lepedékes|Fogkő jelenléte|FOGKO|Leletként; az eltávolítás művelet (SZ-064).
SZ-055|Művelet|kihúztam; kivettem; leszedtem; húzás; extrakció; extraháltam; eltávolítottam a fogat|Foghúzás (extrakció)|EXTRAKCIO|„Kivettem” varratnál/tömésnél mást jelent: környezet szerint, kétes esetben ⚠.
SZ-056|Művelet|műtéti eltávolítás; műtéttel vettem ki; feltárás; bölcsességfog műtét|Műtéti foghúzás|EXTRAKCIO_MUTETI|
SZ-057|Művelet|betömtem; tömés; tömtem; plombáltam; megtömtem|Tömés|TOMES|Anyag nélkül: a kezelési csomag alapértelmezése.
SZ-058|Művelet|kompozit tömés; fehér tömés; esztétikus tömés|Kompozit tömés|TOMES_KOMPOZIT|
SZ-059|Művelet|amalgám tömés; ezüst tömés; fekete tömés|Amalgám tömés|TOMES_AMALGAM|Ha a rendelő nem használ amalgámot, kivehető.
SZ-060|Művelet|üvegionomer tömés; GIC; glasszionomer|Üvegionomer tömés|TOMES_GIC|
SZ-061|Művelet|ideiglenes tömés; ideiglenest tettem; lezártam ideiglenesen|Ideiglenes tömés|TOMES_IDEIGLENES|
SZ-062|Művelet|gyöki; gyökerezés; gyökérkezelés; endo; endodoncia; kitisztítottam a gyökeret|Gyökérkezelés|GYOKERKEZELES|Több ülésben: ülés sorszáma a megjegyzésbe.
SZ-063|Művelet|trepanáltam; megnyitottam; trepanáció; feltártam a pulpát|Trepanáció (megnyitás)|TREPANACIO|„Feltárás” műtétnél mást jelent (SZ-056): környezet szerint.
SZ-064|Művelet|fogkő; fogkőleszedés; fogkőeltávolítás; ultrahangoztam; depurálás; scaling; leszedtem a fogkövet|Fogkő-eltávolítás|FOGKO_ELTAVOLITAS|„Leszedtem” önmagában extrakció is lehet: a tárgy dönt.
SZ-065|Művelet|polírozás; políroztam; polír|Polírozás|POLIROZAS|
SZ-066|Művelet|homokfúvás; airflow; pórfúvás|Homokfúvásos tisztítás|HOMOKFUVAS|
SZ-067|Művelet|érzéstelenítés; érzéstelenítettem; szúrtam; beadtam; szuri; injekció|Helyi érzéstelenítés|ERZESTELENITES|A felhasznált injekció anyagként is kerüljön levonásra (SZ-080).
SZ-068|Művelet|vezetéses; mandibuláris; Spix; vezetéses érzéstelenítés|Vezetéses érzéstelenítés|ERZESTELENITES_VEZETESES|
SZ-069|Művelet|röntgen; rtg; felvétel; kisröntgen; intraorális felvétel|Intraorális röntgenfelvétel|RTG_INTRAORALIS|Fogtól független vagy fogszámhoz kötött.
SZ-070|Művelet|panoráma; OP; ortopantomogram; panoráma röntgen|Panorámaröntgen (OP)|RTG_OP|Fogtól független.
SZ-071|Művelet|CBCT; CT; háromdimenziós felvétel|CBCT felvétel|RTG_CBCT|
SZ-072|Művelet|kontroll; felülvizsgálat; átnézés; visszarendelés|Kontrollvizsgálat|KONTROLL|
SZ-073|Művelet|állapotfelmérés; státuszfelvétel; státusz; első vizsgálat|Állapotfelmérés|ALLAPOTFELMERES|
SZ-074|Művelet|konzultáció; megbeszélés; tanácsadás; kezelési terv|Konzultáció|KONZULTACIO|Fogtól független.
SZ-075|Művelet|lenyomat; lenyomatot vettem; lenyomatvétel; mintavétel; szkennelés|Lenyomatvétel|LENYOMAT|„Mintavétel” laborvizsgálatot is jelenthet: ellenőrizendő.
SZ-076|Művelet|csiszolás; preparálás; lecsiszoltam; előkészítettem koronára|Preparálás (koronához)|PREPARALAS|
SZ-077|Művelet|korona felragasztás; cementálás; beragasztottam; felcementeztem; rögzítettem|Korona / híd rögzítése|KORONA_ROGZITES|
SZ-078|Művelet|varrat; varrtam; öltés; összevarrtam|Sebvarrás|VARRAS|
SZ-079|Művelet|varratszedés; kiszedtem a varratot; kivettem a varratot; szálszedés|Varratszedés|VARRATSZEDES|Elsőbbséget élvez a „kivettem” (SZ-055) értelmezéssel szemben, ha a „varrat” szó elhangzik.
SZ-080|Anyag|szuri; injekció; érzéstelenítő; karpula; ampulla; érzéstelenítő ampulla|Érzéstelenítő injekció (karpula)|ANYAG_ERZESTELENITO|A rendelő katalógusában szereplő márkanevekkel bővítendő. Kiszerelés-változat esetén lásd SZ-097.
SZ-081|Anyag|tű; injekciós tű; tűt|Injekciós tű|ANYAG_TU|„Tű” gyökérkezelésnél tágítót is jelenthet (SZ-090): környezet szerint.
SZ-082|Anyag|tampon; vattatampon; vattahenger; vattarúd|Vattahenger (tampon)|ANYAG_TAMPON|
SZ-083|Anyag|géz; gézlap; mull; steril géz|Gézlap|ANYAG_GEZ|
SZ-084|Anyag|polírpaszta; polír paszta; pasztát; polírozó paszta|Polírpaszta|ANYAG_POLIRPASZTA|
SZ-085|Anyag|kompozit; fehér anyag; tömőanyag; töltőanyag|Kompozit tömőanyag|ANYAG_KOMPOZIT|Árnyalat (pl. A2, A3) a megjegyzésbe vagy változatként.
SZ-086|Anyag|bond; bonding; ragasztó; adhezív; adheziv|Bonding (adhezív)|ANYAG_BONDING|„Ragasztó” rögzítőcementet is jelenthet (SZ-095): környezet szerint.
SZ-087|Anyag|savazó; sav; savazó gél; foszforsav; etch; étcs|Savazó gél|ANYAG_SAVAZO|
SZ-088|Anyag|matrica; matricaszalag; szalag; matricagyűrű|Matricaszalag|ANYAG_MATRICA|
SZ-089|Anyag|ék; fa ék; fogék|Interdentális ék|ANYAG_EK|
SZ-090|Anyag|tágító; reszelő; file; fájl; gyökércsatorna tű; tű a gyökérbe|Gyökércsatorna-tágító|ANYAG_TAGITO|
SZ-091|Anyag|guttapercha; gutta; guttacsúcs; gyökértömő csúcs|Guttapercha csúcs|ANYAG_GUTTAPERCHA|
SZ-092|Anyag|hipó; nátrium-hipoklorit; NaOCl; öblítő|Nátrium-hipoklorit öblítő|ANYAG_NAOCL|„Öblítő” klórhexidint is jelenthet: ⚠, ha nem egyértelmű.
SZ-093|Anyag|klórhexidin; CHX; klórhexidines öblítő|Klórhexidin öblítő|ANYAG_CHX|
SZ-094|Anyag|kofferdam; koferdám; gumilepedő; dam|Kofferdam|ANYAG_KOFFERDAM|
SZ-095|Anyag|cement; ragasztócement; rögzítőcement|Rögzítőcement|ANYAG_CEMENT|
SZ-096|Anyag|szilikon; lenyomatanyag; alginát; gipsz|Lenyomatanyag|ANYAG_LENYOMAT|Szilikon és alginát külön anyag a katalógusban: szétbontandó.
SZ-097|Anyag|[szám] [N]-es [anyag]; három hatos injekció|Kiszerelés-változat vagy tizedes mennyiség – KÉTÉRTELMŰ|KETERTELMU|Ha az anyagnak van „N-es” változata a katalógusban: első szám = darab, N = változat. Ha nincs és az egység db: 3,6 nem lehetséges. Egyébként ⚠ választógombok, a választás naplózva (v2.3 5. pont).
SZ-098|Anyag|ideiglenes tömőanyag; cavit; ideiglenes anyag|Ideiglenes tömőanyag|ANYAG_IDEIGLENES|
SZ-099|Anyag|varrófonal; fonal; cérna; varratanyag|Sebészi varrófonal|ANYAG_VARROFONAL|
SZ-100|Anyag|fluorlakk; lakk; fluoridos lakk|Fluoridlakk|ANYAG_FLUORLAKK|
SZ-101|Anyag|kesztyű; gumikesztyű; vizsgálókesztyű|Vizsgálókesztyű|ANYAG_KESZTYU|Ha nem tételesen vezetett, a szótárból kivehető.
SZ-102|Anyag|nyálszívó; szívó; szívóvég|Nyálszívó|ANYAG_NYALSZIVO|
SZ-103|Mennyiség|egy; egyet; egy darab; egy db|1|1|
SZ-104|Mennyiség|kettő; kettőt; két; két darab|2|2|
SZ-105|Mennyiség|egy pár; pár|2|2|„Pár” bizonytalan mennyiséget is jelenthet („pár darab”): ⚠.
SZ-106|Mennyiség|fél; felet|0,5|0,5|Csak tört mennyiséget engedő anyagnál (pl. ml).
SZ-107|Mennyiség|másfél|1,5|1,5|
SZ-108|Mennyiség|két és fél; kettő és fél|2,5|2,5|
SZ-109|Mennyiség|három egész hat; három egész hat tized; három vessző hat|3,6|3,6|Az egyértelmű tizedes forma; az „Így diktálj” súgóban ajánlott.
SZ-110|Mennyiség|még [N]; plusz [N]; további [N]|Relatív mennyiség|+N|v2.1 3. pont: a korábban diktált számhoz, ennek hiányában a csomag szerinti mennyiséghez adódik.
SZ-111|Mennyiség|[A] helyett [B]; nem [A], hanem [B]|Javítás|=B|v2.1 3. pont: az utóbbi szám érvényes.
SZ-112|Mennyiség|egy kevés; egy pici; kicsit|Nem számszerű mennyiség|CSOMAG|Csomag szerinti mennyiség, ⚠ ellenőrizendő.
SZ-113|Mennyiség|egy doboz; egy csomag; egy levél|Kiszerelés|KISZERELES|Az anyag katalógusbeli kiszerelési mennyiségére váltandó.
SZ-114|Mértékegység|darab; db; darabot; szál; szálat|darab|db|
SZ-115|Mértékegység|ml; milli; milliliter; cc; köbcenti|milliliter|ml|
SZ-116|Mértékegység|adag; adagot|adag|adag|
SZ-117|Mértékegység|karpula; ampulla; ampullát|darab (karpula)|db|Injekciónál egységként.
SZ-118|Hangfelismerési tévesztés|harminc hat os; harminc-hat-os; 30 6-os|36-os|36|Mintapélda: két külön szóként felismert fogszám összevonása, minden fogszámra.
SZ-119|Hangfelismerési tévesztés|polír pasta; polír paszta; polírpasta|polírpaszta|ANYAG_POLIRPASZTA|
SZ-120|Hangfelismerési tévesztés|kompozíció; kompozitot; kompozíciós|kompozit|ANYAG_KOMPOZIT|„Kompozíció” fogászati diktálásban szinte mindig kompozit.
SZ-121|Hangfelismerési tévesztés|emó; emo; em ó; MÓ|MO|M+O|
SZ-122|Hangfelismerési tévesztés|emódé; mód; em ó dé|MOD|M+O+D|„Mód” köznapi szó is: csak fogszám + művelet mellett.
SZ-123|Hangfelismerési tévesztés|guta percha; gutta percha; kutaperka|guttapercha|ANYAG_GUTTAPERCHA|
SZ-124|Hangfelismerési tévesztés|kofer dám; koffer dam; kofferdám|kofferdam|ANYAG_KOFFERDAM|
SZ-125|Hangfelismerési tévesztés|okkluziális; oklúzális; okkluzalis|occlusalis|O|
SZ-126|Hangfelismerési tévesztés|trepanál tam; trepanált am; trepanálta|trepanáltam|TREPANACIO|
SZ-127|Hangfelismerési tévesztés|extra kció; extrakciót; extra hálás|extrakció|EXTRAKCIO|
SZ-128|Töltelékszó|kérek; kérem; használtam; ment; elment; felhasználtam; tettem bele; ráment|(figyelmen kívül hagyandó)|-|A szám és az anyagnév között megengedett (v2.1 3. pont).
SZ-129|Töltelékszó|izé; öö; hát; szóval; na; akkor|(figyelmen kívül hagyandó)|-|
SZ-130|Javaslat-jelző|szükséges; kell; javasolt; javaslom; kellene; meg kell csinálni|Javasolt (még nem elvégzett) tétel|JAVASOLT|v2.1 12. pont: „tömés szükséges” = javasolt, „betömtem” = elvégzett.
SZ-131|Javaslat-jelző|két héten belül; egy hónapon belül; mielőbb; sürgős; ráér|Sürgősség / határidő|SURGOSSEG|Sürgős / ajánlott / ráér, illetve határidő a javasolt tételhez.`
