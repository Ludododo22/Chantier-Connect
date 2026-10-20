# Chantier Connect

Plateforme BTP avec espaces séparés par entreprise et par rôle. Le code est organisé en deux projets autonomes : [frontend/](frontend/) (React/Vite/Cloudflare) et [backend/](backend/) (Node/Express/PostgreSQL/Supabase). Chaque dossier contient son propre `package.json` et README pour être publié dans un dépôt GitHub distinct.

## Développement local

Configurez `backend/.env` à partir de [backend/.env.example](backend/.env.example), puis lancez chaque projet dans son propre terminal :

```powershell
cd backend
npm install
npm run migrate
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Vite sert l’interface sur le port 8443 et relaie `/api/*` vers `http://127.0.0.1:3001`. Ne lancez jamais le seed de démonstration en production.

## Déploiement

1. Déployez [backend/](backend/) sur un hébergeur Node avec `npm install`, `npm run build` et `npm start`. Configurez les variables runtime `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET` (au moins 64 caractères aléatoires) et `NODE_ENV=production`. Utilisez l’URL PostgreSQL Supabase, de préférence son pooler en mode session, port 5432. Appliquez les migrations de `backend/migrations/` après vérification sur une base de recette. Le health check du backend est `/api/health`.
2. Déployez [frontend/](frontend/) sur Cloudflare Workers. `API_ORIGIN` est définie dans `frontend/wrangler.jsonc` avec l’origine HTTPS Render. Si elle change, mettez à jour cette valeur avant le déploiement. Le Worker sert les fichiers frontend et relaie `/api/*` au backend Node; il ne se connecte jamais directement à PostgreSQL.
3. Vérifiez `https://<backend>/api/health` puis `https://<frontend>/api/health`. Les deux doivent retourner `{"status":"ok","database":"connected"}`.

`DATABASE_URL` et `JWT_SECRET` ne doivent être configurés que sur le backend. Après le basculement, supprimez les anciens secrets backend du Worker Cloudflare. `API_ORIGIN` n’est pas secret. Le proxy conserve le chemin, la query string et les cookies afin que les sessions restent same-site depuis le domaine Cloudflare.

## Dépôts GitHub séparés

Créez les dépôts backend et frontend, puis exécutez les commandes Git à partir du dossier concerné. Pour le backend, les commandes fournies dans `backend/README.md` supposent que le répertoire courant est `backend/`. Pour le frontend, définissez `frontend/` comme racine du dépôt. Ne poussez jamais `.env`.

## Fonctionnalités et validation

L’application comprend la connexion par email/téléphone, le contrôle de rôles et la séparation des données par entreprise, des espaces terrain/pilotage/finance/back-office éditeur, ainsi que la gestion d’abonnements et de factures manuelles. Les paiements Mobile Money ne sont pas activés dans cette version.

**État : MVP utilisable en pilote accompagné; production commerciale générale non validée.** Le build, le smoke test des huit rôles et une simulation locale du cloisonnement entre deux entreprises ont réussi le 18 octobre 2026. Voir le compte rendu dans [tests-audits/audits/etat-pilote-2026-10-18.md](tests-audits/audits/etat-pilote-2026-10-18.md).
