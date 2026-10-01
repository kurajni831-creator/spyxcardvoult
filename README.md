# CARD VAULT / SPYx NEXORA extracted project

This package contains the Express server source and package metadata extracted from the code supplied in chat.

## Run

```bash
npm install
npm start
```

Default port: `3000`.

## Environment variables

- `PORT` — server port
- `SETTINGS_CODE` — settings access code
- `INITIAL_ACCESS_CODE` — initial login passcode
- `DATA_FILE` — JSON database path when PostgreSQL is not configured
- `DATABASE_URL` — optional PostgreSQL connection string

## API

- `GET /api/session`
- `POST /api/login`
- `POST /api/settings/verify`
- `POST /api/settings/change`
- `POST /api/card/open`

The card/economy data in this project is intended for the game ecosystem described in the supplied source and is not a real banking/payment system.
