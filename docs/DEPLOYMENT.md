# Deployment guide

## Render (what the live site uses)

1. Push this repository to GitHub.
2. In Render choose **New**, then **Blueprint**, pick the repository and press **Apply**.
3. Wait for the build. The health check is `/api/health`.

`render.yaml` sets the build command (`npm ci --include=dev && npm run build`), the start command (`npm start`) and these variables:

| Variable | Value | Why |
| --- | --- | --- |
| `NODE_VERSION` | `22.14.0` | `node:sqlite` needs Node 22.13 or newer |
| `NODE_ENV` | `production` | Production mode |
| `ENABLE_DEMO` | `1` | Create demo auctions and show the "Simulate a rival bid" button |
| `DB_PATH` | `/tmp/rfq.db` | Free plan has no disk, so data resets on restart |

For permanent data on a paid plan, attach a disk and set `DB_PATH=/var/data/rfq.db`.

## Docker

```bash
docker compose up --build        # http://localhost:8080
```

The image has two stages: a build stage with all dependencies, and a small run stage with production dependencies only. Data is kept in the `rfq-data` volume.

## Any Node host

```bash
npm ci --include=dev && npm run build
NODE_ENV=production PORT=8080 npm start
```

Serve it behind HTTPS. The server trusts one proxy hop (`trust proxy = 1`), which matches most hosts.

## Settings reference

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Listening port |
| `DB_PATH` | `backend/data/rfq.db` | SQLite file |
| `ENABLE_DEMO` | on outside production | Demo data and the rival-bid helper |
| `SEED_ON_EMPTY` | on | Set to `0` to skip seeding an empty database |
| `WEB_DIR` | `frontend/dist` | Folder with the built website |
