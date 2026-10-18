# Chantier Connect

React + Vite + Tailwind CSS application.

## Development Server

- Copy the local values into `.env`; never commit that file or put real secrets in `.env.example`.
- Create a PostgreSQL database and configure `DATABASE_URL` and a random `JWT_SECRET`.
- Run `pnpm db:migrate` and `pnpm db:seed` for local development data.
- Run `pnpm dev:full` to start the Vite frontend (port 8443) and Express API (port 3001).
- Run `pnpm build` to type-check the backend and build the frontend.

## Project Structure

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React and Tailwind CSS v4 plugins and the `@` alias for `src`
- `backend/src/` - Express API, authentication, and tenant-scoped business routes
- `backend/migrations/` - PostgreSQL schema migrations
- `.env.example` - Local backend configuration template without credentials

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import "tailwindcss";`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This project does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
