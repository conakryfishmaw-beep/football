# AI Football Predictor & Analytics Platform

Futbol maçları için yapay zeka destekli tahmin ve arşiv platformu.

## Mimari

```
football/
├── backend/          # Node.js + Express + PostgreSQL API
│   ├── src/
│   │   ├── db/           # PostgreSQL pool + SQL schema
│   │   ├── services/     # API-Football entegrasyonu
│   │   ├── engine/       # AI tahmin motoru
│   │   ├── routes/       # Express rotaları
│   │   ├── jobs/         # Cron: sonuç güncelleme
│   │   └── server.js
│   └── package.json
├── frontend/         # Next.js + Tailwind
│   ├── app/
│   │   ├── page.tsx              # Dashboard (Dün/Bugün/7 gün)
│   │   ├── match/[id]/page.tsx   # Maç detay
│   │   └── archive/page.tsx      # Arşiv & arama
│   └── package.json
└── docker-compose.yml # PostgreSQL
```

## Tahmin Motoru

Her maç için 4 seçenek üretilir, en yüksek güven skorluolanı seçilir:

1. **Taraf Bahsi** (1 / X / 2)
2. **Ev Gol** (home team scores — Yes/No)
3. **Deplasman Gol** (away team scores — Yes/No)
4. **Toplam Gol** (Over/Under 2.5)

Algoritma: Son 10 maçlık form (ağırlık %60) + H2H son 5 maç (ağırlık %40) → Poisson-tabanlı gol beklentisi + form skoru.

## Şeffaflık

Her tahmin üretildiği anda `predictions` tablosuna `Beklemede` olarak yazılır. Cron-job bitmiş maçları çeker, skoru `matches` tablosuna yazar ve ilgili tahmini `Kazandı` / `Kaybetti` olarak günceller. **Hiçbir tahmin silinmez.**

## Hızlı Başlangıç

```bash
# 1) PostgreSQL'i başlat
docker compose up -d

# 2) Backend
cd backend
cp .env.example .env        # API_FOOTBALL_KEY değerini doldur
npm install
npm run db:init             # schema.sql çalıştırır
npm run dev

# 3) Frontend
cd ../frontend
npm install
npm run dev                 # http://localhost:3000
```

## Ortam Değişkenleri

Backend `.env`:

```
PORT=4000
DATABASE_URL=postgres://football:football@localhost:5432/football
API_FOOTBALL_KEY=your_api_football_key
API_FOOTBALL_HOST=v3.football.api-sports.io
```

Frontend `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
