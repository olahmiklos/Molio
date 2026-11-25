# Molio

Fogorvosi rendelőkezelő program diktálással (Nuxt 3 PWA, Pinia, Prisma, PostgreSQL).

> **Készült a `Molio_fogorvosi_szoftver_specifikacio_v2.4` dokumentum alapján**
> (Molio — Fogorvosi Szoftver — Funkcionális Specifikáció, **v2.4**, utolsó módosítás: 2026. november 24.).
> A verzió és a specifikáció hivatkozása az alkalmazásban is látszik: lábléc és **Beállítások → Névjegy**.

Ez a **2.4 bemutató (demó) verzió**: kitalált mintaadatokkal (Cooldent Kft.), szerver és adatbázis nélkül.
Az adatok a böngésző tárolójában (IndexedDB) vannak, ezért a módosítások csak az adott eszközön és böngészőben látszanak.
A diktálást a Cloudflare Workers AI Whisper-modellje alakítja szöveggé (a böngésző beépített felismerője tartalék és élő előnézet), a mezőket szabályok töltik ki; kísérleti AI-értelmezés kapcsolóval bekapcsolható. A hangfelvétel nem tárolódik.

## Mit tud a demó

- **Recepció:** páciensek (egészségügyi figyelmeztetés + rejtett belső megjegyzés), két fogorvos naptára napi/heti/havi nézetben, ráhagyási sávok, ütközésfigyelés, szabad időpontok, emlékeztetők előnézete és szimulált küldése, a meg nem jelenés szabályalapú kockázata.
- **Kezelés:** diktálás, fogszám-felismerés (FDI-szám, „tizenhatos”, „jobb felső hatos”, tejfogak „tejfog”/„római” jelöléssel), fogfelszínek (M, O/I, D, V, L) és bővítés kezelés közben, anyagjavaslat és összevetés, díj a felszínek száma szerint, ívelt röntgenszerű fogtérkép előzményekkel és röntgenkép-váltással, fogazati státusz diktálással, csatolmányok, PDF ügyfélkarton.
- **Raktár:** készlet, automatikus levonás, 60 napos előrejelzés és rendelési határidő, bevételezés egységárral és **gördülő súlyozott átlagárral**, gyártási szám (LOT) és lejárat, kiadás lejárat szerint, rendelési javaslat (a rendelést munkatárs adja le), implantátum-nyomonkövetés és LOT-keresés visszahíváshoz, törzsadatok, kezelési csomagok és felismerési szótár szerkesztése.
- **v2.2:** figyelmeztetés a páciens meglévő időpontjairól foglaláskor; időpont törlése 30 napos visszaállítással, tételek áthelyezése, időpontok összevonása; verziójelzés és „Frissítés keresése”; diktálás azonnali előnézete ⚠-megerősítéssel és 7 napos piszkozattal; kötelező kezelő orvos; javasolt kezelés forrásvizitje, több tétel egy időponton; tájékoztató üzenet időponthoz, egységes Teendők menü.
- **v2.3:** a diktálás pontosítása: szerveroldali Whisper-felismerés (Cloudflare Workers AI, `worker/index.ts`) szakszó-listával, élő előnézet, felvétel- és hangerőjelző, zajszűrés, kitaláció-szűrő; diktálási alapszótár (131 sor) és ismeretlen kifejezések; hasonlóság szerinti egyeztetés; az előjegyzett kezelés és a fogtérkép felhasználása az ellenőrzésben; javítási napló, „Nem ezt mondtam” jelzés, tanuló szabályok; „Diktálás betanítása” és személyes javítások; kísérleti AI-értelmezés; automatikus pontosságmérés (`npm run accuracy`); csatornaválasztó gombok; a fogállapot-szótár a Kódtáblák alatt; B-006 (foglalás időtartama) és B-007 (közeli időpont) javítása; új verzió felugró ablak a main ágon.
- **v2.0:** beleegyező nyilatkozat tableten aláírva (PDF a kartonba), közérthető páciens-tájékoztató orvosi jóváhagyással, kontroll-meghívók (recall), sterilizációs napló, EESZT-jelentés és számla előkészítése (szemléltetés).

- **v2.4:** main ágon egyszerű, rögzített beállítású diktálás; a teszt ágon „Fejlesztői részletek” panel, Diktálás-labor (próbanapló a KV-ben) és rejtett Látogatások nézet – ezek kódja a main buildből kimarad (`__MOLIO_DEV__`, `pages:extend`); automatikus váltás a böngésző szövegére értelmetlen Whisper-szövegnél; szűrt 16 kHz-es átalakítás és rövid mondatos szakszó-szöveg; „Mai feladat” sáv; öntanuló javítások és személyes rövidítések központi mentéssel; ütközések egymás mellett és Teendőként; összevonás azonos időpontnál; törlés a szerkesztő ablakban; a tájékoztató orvosi jóváhagyása Archívummal; beosztáskezelő (a foglalás a beosztáshoz kötve).

## Kiadás előtti tesztfelvétel (v2.4, 5. pont)

`npm run hangproba -- --url https://teszt-molio.<fiók>.workers.dev` elküldi a `tests/fixtures/hang/` alatti ismert felvételeket (a fejlesztő hangja, betegadat nélkül) a Worker átirat-végpontjára,
és a Whisper szövegét a `varhato.json` szerinti szöveggel veti össze (szó-szintű egyezés). 80% alatt 2-es kilépési kóddal megáll – a kitelepítés nem folytatódik automatikusan.

## Felhasználói kézikönyv

A kézikönyv forrása a `docs/kezikonyv.md`. Minden buildnél (`nuxt build` / `nuxt generate`, a `build:before` hookban) a
`scripts/build-manual.mjs` PDF-et készít belőle a `public/kezikonyv/` mappába (nincs verziókezelve), a program pedig a
**Súgó** oldalon (`/#/sugo`) adja letöltésre. Így az éles oldal kézikönyve akkor frissül, amikor új verzió kerül a `main` ágra;
a `teszt` ág előnézetében a címlap „teszt-előnézet” jelzést kap. Kézi előállítás: `npm run manual`.
Új funkciónál a `docs/kezikonyv.md` megfelelő fejezetét is frissíteni kell.

## Cloudflare Worker, Workers AI és KV (v2.3)

A demó statikus Nuxt build marad (`.output/public`), de előtte egy kis Worker (`worker/index.ts`, `wrangler.jsonc`) szolgálja ki az `/api/*` kéréseket:
`POST /api/diktalas/atiras` (Whisper), `POST /api/diktalas/ertelmezes` (AI-értelmezés), `POST /api/diktalas/naplo` (anonimizált javítási napló), `GET /api/diktalas/keret` (becsült napi keret);
v2.4: `POST|GET /api/diktalas/tanult-javitas` (tanult javítások és rövidítések ágak szerint), `POST|GET /api/diktalas/proba` (próbanapló, csak teszt), `POST /api/latogatas` (látogatás-napló, mindkét ágon), `GET|DELETE /api/latogatas`, `POST /api/latogatas/nev` (csak a teszt gazdagépen).
A KV ingyenes írás-kerete (kb. 1000 / nap) miatt egy látogatás és egy napló-köteg egy írás, a látogatás-írás napi felső határa ágonként 200, és minden KV-művelet hibatűrő.
A Workers AI az `AI` bindingen, kulcs nélkül, a fiók jogán érhető el. A központi javítási napló és a keretbecslés egy **KV névteret** (`MOLIO_LOG`) használ;
amíg ez nincs létrehozva és bekötve, a Worker kecsesen kezeli (a kliens az eszközön várakoztatja a bejegyzéseket). Létrehozás: `npx wrangler kv namespace create MOLIO_LOG`,
majd a kapott azonosító a `wrangler.jsonc`-ban: `"kv_namespaces": [{ "binding": "MOLIO_LOG", "id": "<id>" }]`.

## Pontosságmérés kiadás előtt (v2.3, 16. pont)

`npm run accuracy` lefuttatja a tesztkészletet (`tests/accuracy/set.ts`) a teljes értelmezési láncon, kategóriánként összeveti az elvárt értelmezéssel és az előző kiadás eredményével
(`app/data/accuracy-baseline.json`), az eredményt az `app/data/accuracy.json`-ba írja (ez látszik a Névjegy / Verzió blokkban). Ha bármely kategória több mint 2 ponttal romlik, 2-es kilépési kóddal megáll.
Új kiadásnál az `accuracy.json` tartalmát kell az `accuracy-baseline.json`-ba másolni (`--baseline` kapcsoló a jelenlegi futás mentéséhez).

## Publikálás Cloudflare Pages-re

Workers & Pages → Create → Pages → Connect to Git → `olahmiklos/molio`, majd:

| Beállítás | Érték |
| --- | --- |
| Framework preset | Nuxt.js |
| Build command | `npx nuxi generate` |
| Build output directory | `.output/public` |
| Környezeti változó | `NODE_VERSION` = `22` |

Az útvonalak hash alapúak (`/#/paciensek`), ezért nincs szükség átirányítási szabályra.

## Fejlesztés

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # a szövegértelmezés és a mintaadatok tesztjei
npm run typecheck
npm run generate   # statikus build: .output/public
```

Helyi futtatás Dockerrel (rendelői telepítés): `docker compose up -d` → http://localhost:8080

## Felépítés

| Mappa | Tartalom |
| --- | --- |
| `app/pages` | Naptár, Páciensek, Kezelés, Emlékeztetők, Raktár, Beállítások, Névjegy |
| `app/components` | fogtérkép (`ToothChart`), felszínválasztó, naptár, modális ablakok |
| `app/stores` | Pinia store-ok modulonként (spec 6.2): auth, patient, appointment, treatment, dentalChart, voice, inventory, ui + központi `data` |
| `app/repositories` | adatelérési réteg: böngészős (IndexedDB) a demóhoz, API a végleges rendszerhez |
| `app/utils/parser.ts` | szabályalapú szövegértelmezés (spec 2.2.1, 2.2.6, 2.2.7) – referencia: 07_Demo/index.html |
| `app/utils/seed.ts` | mintaadatok (a böngészős demó és a későbbi PostgreSQL seed közös forrása) |
| `prisma/schema.prisma` | a végleges PostgreSQL-séma (spec 8.) |
| `server/api` | Nitro REST végpontok (a demóban csak `health`) |

## Eltérések és megjegyzések a specifikációhoz képest

- A 30G extra rövid tű kulcsszavai közül kikerült a „palatinális”, mert a v1.9 szerint ez fogfelszín neve (orális/palatinális, L).
- A „tömünk” szóalak bekerült a tömés kulcsszavai közé (a „rágófelszínen is tömünk” bővítéshez).
- A ráhagyás 0, 30 vagy 60 perc lehet (a naptár 30 perces sávokkal dolgozik); a kezeléstípusonkénti alapértékek a 11.2 javaslata szerint: gyökérkezelés, foghúzás, koronához előkészítés után 30 perc.

## Fontos

- Valódi betegadat soha nem kerülhet a repóba, a demóhoz csak kitalált adat használható.
- Titkok (jelszó, API-kulcs) csak `.env`-ben vagy GitHub Secrets-ben legyenek.
- A specifikáció a `docs/` mappába kerül, ha elkészült.
