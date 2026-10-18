# Chantier Connect

Plateforme BTP avec espaces séparés par entreprise et par rôle. Stack : React, Vite, Express et PostgreSQL.

## Démarrage local

Voir [AGENTS.md](AGENTS.md) pour la configuration de l’environnement, PostgreSQL, les migrations et les comptes de démonstration. Ne jamais utiliser le seed de démonstration en production.

## Déploiement Cloudflare Workers

Le frontend Vite et l’API Express sont déployés ensemble sur Cloudflare Workers. Le build utilise le plugin Vite de Cloudflare et `wrangler.jsonc`; la commande `npx wrangler deploy` ne lance donc plus l’assistant de configuration initiale.

Dans Cloudflare, configurez `DATABASE_URL` avec l’URI PostgreSQL Supabase (pooler en mode session recommandé) et `JWT_SECRET` comme secrets du Worker. La clé JWT doit être aléatoire et faire au moins 64 caractères. Le Worker active TLS pour PostgreSQL. Ne mettez pas ces valeurs dans Git ni dans les variables Vite exposées au navigateur.

Paramètres de build Cloudflare : commande `pnpm run build`, répertoire racine `/`, commande de déploiement `npx wrangler deploy`. Le Worker sert le frontend et traite `/api/*`; `/api/health` permet de vérifier l’API et la connexion à la base.

Le formulaire public enregistre les demandes dans la table PostgreSQL `contact_requests` via `POST /api/contact`. Avant de le publier, appliquez `backend/migrations/008_contact_requests.sql` à la base Supabase (par exemple via le SQL Editor). N’exécutez pas une migration générale en production sans avoir d’abord vérifié les migrations en attente. Les soumissions sont conservées en base; aucune notification email n’est configurée, il faut donc consulter cette table pour traiter les demandes.

## État d’avancement — 18 octobre 2026

**État général : MVP utilisable en pilote accompagné; mise en production commerciale générale non validée.** Le build, le smoke test des huit rôles et une simulation locale du cloisonnement entre deux entreprises ont réussi le 18 octobre 2026. La simulation utilise une base temporaire locale; la recette de préproduction et la configuration réelle de production restent à valider. Le compte rendu se trouve dans [tests-audits/audits/etat-pilote-2026-10-18.md](tests-audits/audits/etat-pilote-2026-10-18.md).

### Fonctionnalités présentes dans le code

- Connexion par email/téléphone, sessions authentifiées, contrôle de rôles et séparation des données par entreprise.
- Espaces terrain, pilotage, finance et back-office éditeur, avec accès restreints selon les rôles.
- Gestion d’équipe par l’administrateur entreprise; un utilisateur terrain n’a qu’un seul chantier affecté.
- Profil utilisateur avec photo privée; l’historique du tableau de bord affiche les activités de l’utilisateur courant.
- Landing publique, formules indicatives et connexion client intégrée.
- Espace éditeur pour les abonnements, factures manuelles, échéances, encaissements et annulations.

### Fonctionnalités préparées ou manuelles

- **Mobile Money n’est pas disponible dans cette version.** Aucun parcours de paiement automatisé ni opérateur n’est activé; les routes techniques préparatoires répondent HTTP 503. Le lancement doit s’appuyer sur les factures et encaissements confirmés manuellement.
- Factures et échéances sont gérées manuellement. La sortie imprimable est un document opérationnel, pas une conformité fiscale certifiée.
- Les formules sont définies dans le code/base; leurs prix restent indicatifs jusqu’à validation commerciale et contractuelle.

### Vérifications à terminer

- Exécuter `pnpm check:roles` avec l’API locale démarrée, une base de recette migrée et les comptes de démonstration créés. Le script vérifie les parcours de lecture et les droits des huit rôles, ainsi que les chantiers visibles par chacun. Cette recette a réussi localement le 18 octobre 2026.
- Pour vérifier l’isolation entre deux entreprises, fournir en local `CHECK_ROLES_SECOND_TENANT_EMAIL` et `CHECK_ROLES_SECOND_TENANT_PASSWORD` pour un administrateur de recette du second tenant. Le script vérifie alors la séparation des chantiers et le rejet d’une création de tâche sur le chantier de l’autre entreprise; sans ces variables, il signale explicitement que ce test n’a pas eu lieu.
- `pnpm check:tenant-isolation` construit une base PostgreSQL temporaire locale, applique toutes les migrations, crée deux entreprises jetables et vérifie la séparation des lectures et le refus des écritures croisées, puis supprime uniquement cette base temporaire. La simulation locale a réussi le 18 octobre 2026; elle ne remplace pas le même contrôle en préproduction.
- Appliquer et vérifier les migrations sur une base de préproduction dédiée; ne pas lancer le seed de démonstration sur une base de production.
- Faire confirmer les mentions fiscales de facture, les contrats, la politique de confidentialité et les règles de conservation des données par les personnes compétentes.

## Checklist avant production

- [ ] Valider les prix, les limites, les taxes, les conditions de paiement et de résiliation avec les clients pilotes; communiquer que les paiements restent manuels.
- [ ] Examiner la migration `007_enterprise_launch_price.sql` : elle passe le plan Entreprise de 0 à 150 000 FCFA/mois et affecte les abonnements utilisant ce plan. Ne l’appliquer qu’après validation de l’impact et sauvegarde.
- [ ] Créer un environnement PostgreSQL dédié; configurer `NODE_ENV=production`, un `JWT_SECRET` aléatoire, TLS/base sécurisée, HTTPS, domaine et proxy de confiance.
- [ ] Générer `JWT_SECRET` avec un générateur cryptographiquement sûr et le fournir via le gestionnaire de secrets de l’hébergeur. Le backend refuse désormais de démarrer en production sans `DATABASE_SSL=true` et sans clé aléatoire d’au moins 64 caractères.
- [x] Exécuter `pnpm check:production-config` après le build; les cas de configuration valide et invalide passent localement.
- [ ] Appliquer les migrations avec `pnpm db:migrate`; ne jamais lancer `pnpm db:seed` en production.
- [x] Exécuter `pnpm build` (réussi le 18 octobre 2026).
- [ ] Tester en recette la connexion, la déconnexion, la suspension, l’échéance, la photo et la création/confirmation manuelle d’une facture.
- [x] Exécuter `pnpm check:roles` localement avec les huit rôles de démonstration (réussi le 18 octobre 2026).
- [x] Simuler l’isolation lecture/écriture avec deux tenants dans une base PostgreSQL locale temporaire (réussi le 18 octobre 2026).
- [ ] Exécuter `pnpm check:roles` en préproduction et refaire la recette avec deux tenants et leurs comptes dédiés.
- [ ] Tester avec plusieurs entreprises que les utilisateurs ne peuvent lire ni modifier les données d’un autre tenant; tester chaque rôle depuis un appareil mobile.
- [ ] Configurer des sauvegardes PostgreSQL chiffrées, restaurer une sauvegarde sur un environnement isolé et consigner le résultat.
- [ ] Installer une supervision des erreurs API, de PostgreSQL, du stockage, des certificats et des sauvegardes. `/api/health` vérifie la disponibilité immédiate, mais ne fournit ni alertes ni surveillance opérationnelle.
- [ ] Documenter responsable de support, gestion d’incident, procédure de retour arrière, export/suppression des données et communication en cas d’interruption.
- [ ] Limiter le lancement initial à quelques entreprises pilotes et suivre le support avant d’ouvrir les inscriptions plus largement.

Les fonctions à venir et non disponibles sont détaillées ci-dessous. Le kit commercial et l’onboarding sont également décrits dans [docs/launch-kit.md](docs/launch-kit.md).

## Feuille de route

Les éléments ci-dessous ne sont pas encore implémentés ou activés dans la version actuelle. Ils ne doivent pas être présentés aux clients comme disponibles.

### Comptes et communication

- **Invitation d’un utilisateur par email** : envoyer un lien sécurisé à durée limitée pour rejoindre l’entreprise et définir son mot de passe. Aujourd’hui, l’administrateur crée le compte et transmet le mot de passe provisoire par un canal externe.
- **Récupération autonome du mot de passe** par lien à usage unique; le parcours actuel demande de contacter le support.
- **Service email transactionnel** pour les invitations, changements de compte, factures et alertes d’échéance.
- **Notifications de rappel** par email/SMS, avec préférences effectives, suivi de délivrabilité et désabonnement lorsque requis.

### Abonnements et paiements

- **Paiement Mobile Money : hors périmètre de cette version.** Aucun paiement automatisé n’est disponible; ne pas le vendre ni l’activer par configuration seule.
- **Facturation récurrente et relances automatiques**. La création de facture et la confirmation du règlement sont actuellement des actions manuelles de l’éditeur.
- **Documents de facturation conformes localement** : informations légales complètes de l’émetteur, taxes, avoirs et validation des mentions obligatoires avec un conseil local. Le document imprimable actuel est un support opérationnel.
- **Historique client en libre-service** : consultation des factures, reçus, échéances et changements de formule depuis l’espace entreprise.

### Équipes et chantiers

- **Affectation d’un même compte à plusieurs chantiers**, avec adhésions explicites par chantier. Aujourd’hui, un profil possède un seul chantier affecté; un rôle terrain limité ne peut pas être rattaché à plusieurs chantiers.
- **Invitation et cycle de vie des accès** : acceptation, expiration, renvoi/révocation de l’invitation et expiration contrôlée des mots de passe provisoires.

### Exploitation et sécurité

- **Sauvegardes automatisées et restauration vérifiée**, avec politique de conservation et procédure de reprise.
- **Monitoring et alertes d’exploitation** : disponibilité, erreurs API, base, stockage, envoi d’emails et transactions de paiement. Le health check seul ne constitue pas une supervision.
- **Journal d’audit administrateur** immuable ou protégé contre l’altération, consultable et exportable pour les changements de rôles, abonnements, factures et accès.
- **Suite automatisée de tests** pour l’isolation multi-tenant, chaque matrice de rôle, les transitions d’abonnement, les paiements et les parcours mobiles; intégration au pipeline de livraison.
- **Conformité et cycle de vie des données** : durée de conservation, export et suppression des données, procédures documentées et validation juridique adaptée aux marchés visés.

Pour les tarifs proposés et la checklist de lancement, voir [docs/launch-kit.md](docs/launch-kit.md).
