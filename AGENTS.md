# Chantier Connect

The repository contains two independently deployable projects:

- `frontend/` - React 19, Vite 8, Tailwind CSS v4, and a Cloudflare Worker that proxies `/api/*` to the Node backend.
- `backend/` - Node/Express API, PostgreSQL access, migrations, and seed tooling.

## Development

- Configure `backend/.env` from `backend/.env.example`. Never commit `.env` or put real secrets in `.env.example`.
- Run `npm install`, `npm run migrate`, and `npm run dev` from `backend/`.
- Run `npm install` and `npm run dev` from `frontend/` in a separate terminal.
- Vite's local API proxy defaults to `http://127.0.0.1:3001`.
- Build independently with `npm run build` in each project. The root workspace also supports `pnpm build`.

## Frontend

- `frontend/src/main.tsx` mounts `frontend/src/App.tsx` into the `#root` element.
- `frontend/src/index.css` imports Tailwind CSS v4; global font declarations belong there.
- `frontend/index.html` is the Vite HTML shell.
- `frontend/vite.config.ts` configures Vite, React, Tailwind, and the local API proxy.
- Cloudflare's runtime variable `API_ORIGIN` must be the backend's HTTPS origin. Do not configure database credentials in the frontend.

## Backend

- `backend/src/` contains the Express API, authentication, and tenant-scoped routes.
- `backend/migrations/` contains the ordered PostgreSQL migrations.
- `DATABASE_URL`, `DATABASE_SSL`, and `JWT_SECRET` belong only in the backend runtime environment.
- Never run the demo seed against production.

## Styling and quality

- Use Tailwind CSS v4 utilities in JSX or theme/global rules in `frontend/src/index.css`; do not add Tailwind or PostCSS config files.
- Use double quotes for strings containing apostrophes, or escape apostrophes in single-quoted strings.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
