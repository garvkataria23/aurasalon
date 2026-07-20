# Aura Salon CRM/POS Deployment Guide

## Production Checklist

- Copy `.env.example` to `.env` and set strong `JWT_SECRET` and `ENCRYPTION_SECRET`.
- Create `/home/u840940482/persistent-data` and place `salon-crm.sqlite` there before startup.
- Set `AURA_DB_PATH=/home/u840940482/persistent-data/salon-crm.sqlite` in the host or PM2 environment.
- Run `npm run quality` before release.
- Run `npm run backup:db` before deploying over an existing SQLite database.
- Build with `npm run build`.
- Start the API and static admin app with `npm run start:prod`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The container serves the Express API and the built Angular admin app on port `4000`.

## Manual Server

```bash
npm ci
npm run quality
npm run seed:demo
npm run start:prod
```

## Backups

Production SQLite lives at `/home/u840940482/persistent-data/salon-crm.sqlite`, outside the deployed application tree. Development uses `data/salon-crm.sqlite` only when `NODE_ENV` is not `production` and `AURA_DB_PATH` is unset. Never include the persistent directory in a deployment ZIP or release-directory cleanup.

```bash
npm run backup:db
```

The admin Deployment page can also create a persisted backup event through `/api/deployment/backup`.

For PM2, start with `pm2 start ecosystem.config.cjs --env production` and use `pm2 restart aura-salon-crm --update-env` after environment changes.

## Health Checks

- API: `/api/health`
- Versioned API: `/api/v1/health`
- Deployment summary: `/api/deployment/summary`
