# Molio

Fogorvosi rendelőkezelő program diktálással (Nuxt 3 PWA, Pinia, Prisma, PostgreSQL).

> **Készült a `Molio_fogorvosi_szoftver_specifikacio_v2.0` dokumentum alapján**
> (Molio — Fogorvosi Szoftver — Funkcionális Specifikáció, **v2.0**, utolsó módosítás: 2026. november 17.).
> A verzió és a specifikáció hivatkozása az alkalmazásban is látszik: lábléc és **Beállítások → Névjegy**.

Ez a **2.0 bemutató (demó) verzió**: kitalált mintaadatokkal (Cooldent Kft.), szerver és adatbázis nélkül.
Az adatok a böngésző tárolójában (IndexedDB) vannak, ezért a módosítások csak az adott eszközön és böngészőben látszanak.
AI-feldolgozás nincs benne, a diktálást a böngésző beépített magyar beszédfelismerése alakítja szöveggé, a mezőket szabályok töltik ki.

## Mit tud a demó

- **Recepció:** páciensek (egészségügyi figyelmeztetés + rejtett belső megjegyzés), két fogorvos naptára napi/heti/havi nézetben, ráhagyási sávok, ütközésfigyelés, szabad időpontok, emlékeztetők előnézete és szimulált küldése, a meg nem jelenés szabályalapú kockázata.
- **Kezelés:** diktálás, fogszám-felismerés (FDI-szám, „tizenhatos”, „jobb felső hatos”, tejfogak „tejfog”/„római” jelöléssel), fogfelszínek (M, O/I, D, V, L) és bővítés kezelés közben, anyagjavaslat és összevetés, díj a felszínek száma szerint, ívelt röntgenszerű fogtérkép előzményekkel és röntgenkép-váltással, fogazati státusz diktálással, csatolmányok, PDF ügyfélkarton.
- **Raktár:** készlet, automatikus levonás, 60 napos előrejelzés és rendelési határidő, bevételezés egységárral és **gördülő súlyozott átlagárral**, gyártási szám (LOT) és lejárat, kiadás lejárat szerint, rendelési javaslat (a rendelést munkatárs adja le), implantátum-nyomonkövetés és LOT-keresés visszahíváshoz, törzsadatok, kezelési csomagok és felismerési szótár szerkesztése.
- **v2.0:** beleegyező nyilatkozat tableten aláírva (PDF a kartonba), közérthető páciens-tájékoztató orvosi jóváhagyással, kontroll-meghívók (recall), sterilizációs napló, EESZT-jelentés és számla előkészítése (szemléltetés).

## Felhasználói kézikönyv

A kézikönyv forrása a `docs/kezikonyv.md`. Minden buildnél (`nuxt build` / `nuxt generate`, a `build:before` hookban) a
`scripts/build-manual.mjs` PDF-et készít belőle a `public/kezikonyv/` mappába (nincs verziókezelve), a program pedig a
**Súgó** oldalon (`/#/sugo`) adja letöltésre. Így az éles oldal kézikönyve akkor frissül, amikor új verzió kerül a `main` ágra;
a `teszt` ág előnézetében a címlap „teszt-előnézet” jelzést kap. Kézi előállítás: `npm run manual`.
Új funkciónál a `docs/kezikonyv.md` megfelelő fejezetét is frissíteni kell.

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
