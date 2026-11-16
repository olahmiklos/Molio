# Molio

Fogorvosi gyakorlat-támogató szoftver (Nuxt 3 PWA, Pinia, Prisma, PostgreSQL).

## Indítás

```bash
cp .env.example .env
npm install
npm run db:up        # helyi Postgres (Docker)
npm run dev
```

## Fontos

- Valódi betegadat soha nem kerülhet a repóba, a demóhoz csak kitalált adat használható.
- Titkok (jelszó, API-kulcs) csak `.env`-ben vagy GitHub Secrets-ben legyenek.
- A specifikáció a `docs/` mappába kerül, ha elkészült.
