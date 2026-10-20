# Journal des changements — Administration Éditeur

## Lots livrés

### Lot 1 — Corrections ciblées B1–B5

- **B1 — Édition des plans :** le formulaire conserve ses valeurs préchargées et le `PATCH /api/platform/plans/:id` ne remplace que les propriétés envoyées. Les champs omis restent inchangés; un test couvre la préservation des limites et du prix.
- **B2 — Conversion d’une préinscription :** la création du tenant, du compte administrateur, du lien et du statut de préinscription est réalisée dans une transaction. Une conversion répétée est refusée avec `409`.
- **B3 — Téléphone de la préinscription :** le numéro est transmis au compte administrateur créé, sans ajouter une seconde source de vérité. Le test d’intégration vérifie ce mapping.
- **B4 — Sélecteur supprimé :** la recherche globale réalisée n’a pas relevé de référence orpheline nécessitant un nettoyage.
- **B5 — Activité récente :** le parcours existant agrège des événements réels associés à l’utilisateur et au tenant courant; il est conservé et couvert par le test d’intégration. Aucun widget fictif ni nouveau flux parallèle n’est ajouté.

### Lot 2 — Utilisateurs, réinitialisation et audit

- Liste paginée des utilisateurs filtrable par entreprise, rôle, statut et recherche; les coordonnées sont masquées dans la réponse de liste.
- La lecture directe d’un profil par l’API de plateforme répond `403`. L’accès support demande une justification, requiert le consentement ou une dérogation d’urgence explicite, et écrit l’événement d’audit avant de retourner les données.
- Modification de profil, blocage/déblocage et réinitialisation administrateur avec journalisation. Le blocage révoque les sessions existantes.
- Réinitialisation par email avec jeton aléatoire à usage unique, hashé en base, valable 30 minutes; le mot de passe est haché côté serveur. La réponse publique ne révèle pas si l’adresse existe.
- Écran Éditeur « Utilisateurs », filtres, consultation support contrôlée, actions de compte, journal d’audit et parcours public de mot de passe oublié/nouveau mot de passe.

### Lot 3 — Entreprises, équipe et chantiers

- Détail et modification d’entreprise, compteurs, archivage/réactivation; l’archivage remplace la suppression physique.
- À la création d’un compte administrateur client, l’Éditeur saisit le mot de passe provisoire dans le formulaire et le confirme. Le mot de passe n’est pas inclus dans l’audit ni réaffiché après création; sa remise au client doit se faire par un canal sécurisé.
- Réutilisation des comptes `users` existants comme membres d’équipe (aucun modèle Employé distinct n’existait); gestion des comptes et affectations de chantier, en conservant l’historique.
- Consultation détaillée et édition des chantiers, équipe affectée, archivage et audit des opérations.
- La transaction de création de l’entreprise initialise maintenant aussi ses paramètres légaux (`tenant_settings`). Cause racine : la migration 004 ne préremplit que les tenants présents au moment de son exécution; les tenants créés ensuite avaient une page Paramètres client qui répondait `404`.
- Dans la création d’un membre, les rôles avec périmètre chantier exigent une affectation active; le formulaire transmet maintenant l’identifiant stable du chantier plutôt que son nom. Les chantiers archivés ne sont plus proposés comme cible d’affectation, ce qui évite les erreurs pour les entreprises qui ont des chantiers homonymes ou archivés.

### Abonnements — activation, résiliation et expiration

- L’Éditeur peut toujours changer manuellement le plan et le statut. La résiliation est confirmée dans l’interface et bloque immédiatement le tenant. Elle reste possible même si le plan souscrit est devenu inactif; pour activer ou prolonger, un plan actif reste requis.
- L’activation ou le maintien en essai/actif exige désormais une date de fin de validité égale ou postérieure à la date du jour. Le jour de fin indiqué reste inclus; l’accès est bloqué à partir du lendemain.
- Les vérifications de session et de connexion refusent désormais les abonnements dont la date est échue **ou absente**. Ainsi, tous les comptes du tenant (administrateur et équipe) perdent l’accès aux API protégées au terme de l’abonnement; l’Éditeur peut réactiver le tenant avec une nouvelle date.
- Aucun job planifié ni modification automatique de données n’est requis : la règle est appliquée à chaque authentification et à chaque connexion, sur la base de la date PostgreSQL.

### Espaces entreprise et séparation des rôles

- Création de [GUIDE-ENTREPRISE.md](./GUIDE-ENTREPRISE.md), avec missions, espaces, limites, affectations et flux opérationnel recommandé.
- Séparation des responsabilités de rapport : le Chef de chantier rédige; le Conducteur de travaux valide et publie. Les permissions sont appliquées par les capacités backend, pas uniquement par la navigation.
- Séparation de la comptabilité : le Comptable peut lire et écrire les opérations financières et dossiers de paiement; l’Administrateur entreprise conserve une consultation financière en lecture seule via la nouvelle capacité `read_finance`. L’API refuse ses écritures et actions de réalisation.
- Le statut des tâches est maintenant modifiable par un sélecteur dédié dans la liste, afin que les membres autorisés puissent déclarer « En cours », « Bloquée » ou « Terminée » sans se limiter à terminer/réouvrir.
- Les créations et réalisations d’écritures financières ainsi que les créations et changements de statut des dossiers de paiement sont désormais consignés dans l’audit existant, dans la même transaction que la modification. Les transitions de dossiers verrouillent la ligne pour éviter deux changements concurrents fondés sur un même ancien statut. Aucune nouvelle migration n’est nécessaire.
- Le pointage des rôles terrain autorisés est également audité, sans recopier la latitude ou la longitude dans le journal. La recette vérifie les droits (refus au Sous-traitant), le refus d’une double arrivée, la clôture du pointage et l’absence de GPS dans le payload d’audit. Aucune nouvelle migration n’est nécessaire.

## Fichiers concernés

- Backend et schéma : `backend/src/auth.ts`, `backend/src/config.ts`, `backend/src/role-access.ts`, `backend/src/types.ts`, `backend/src/audit-log.ts`, `backend/src/mailer.ts`, `backend/src/password-reset.ts`, `backend/src/privacy.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/platform.ts`, `backend/src/routes/platform-users.ts`, `backend/src/routes/work.ts`, `backend/src/seed.ts`, `backend/migrations/010_platform_administration.sql` et `backend/migrations/rollback/010_platform_administration.sql`.
- Interface : `frontend/src/App.tsx` et `frontend/src/lib/api.ts`.
- Validation/documentation : `tests-audits/tests/check-tenant-isolation.mjs`, `backend/README.md`, `backend/.env.example`, `backend/.gitignore`.

## API touchée

- Plateforme : `GET /api/platform/users` (pagination et filtres), `GET /api/platform/users/:id` (refus direct), `POST /api/platform/users/:id/support-access`, `PATCH /api/platform/users/:id`, `PATCH /api/platform/users/:id/status`, `POST /api/platform/users/:id/password-reset`, `GET /api/platform/audit-logs`.
- Réinitialisation/consentement : `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/complete`, `PATCH /api/auth/privacy-consent`.
- Entreprises : `GET /api/platform/tenants/:id`, `PATCH /api/platform/tenants/:id`; la création/conversion utilise `POST /api/platform/tenants`.
- Plans : `PATCH /api/platform/plans/:id` accepte maintenant des mises à jour partielles.
- Chantiers : `GET /api/sites/:id`, `PATCH /api/sites/:id`; les routes existantes de liste/création et d’équipe sont conservées et complétées.

## Migration et configuration

- Appliquer `backend/migrations/010_platform_administration.sql` après sauvegarde et validation sur une base de recette, dans l’ordre numérique habituel.
- Le retour arrière manuel est `backend/migrations/rollback/010_platform_administration.sql`. Il supprime les tables et colonnes ajoutées; les statuts archivés sont convertis en statuts compatibles avec l’ancienne version (`Archivé` → `Suspendu` pour une entreprise, `Terminé` pour un chantier).
- Configurer `RESEND_API_KEY`, `EMAIL_FROM` et `APP_ORIGIN` dans l’environnement du backend pour activer l’envoi des emails. Aucun secret ne doit être placé dans le frontend ou dans `.env.example`.
- Aucun mot de passe en clair n’est envoyé ou journalisé. Les journaux masquent les coordonnées; les accès support et réinitialisations sont tracés.

## Tests et vérifications

- Le test d’intégration `tests-audits/tests/check-tenant-isolation.mjs` couvre l’isolation multi-tenant, l’activité réelle, les filtres et masquages, les refus d’accès, le mode support/consentement et son audit, les modifications de profil et leur audit, les blocages et révocations de session, le PATCH partiel des plans, la conversion/téléphone/idempotence, les permissions et périmètres des rôles Conducteur, Chef de chantier, Compagnon, Sous-traitant, Comptable et Maître d’ouvrage, la division création/validation des rapports, le statut de tâches assignées, la lecture/écriture financière entre Administrateur et Comptable, l’utilisation du mot de passe provisoire fourni par l’Éditeur et son absence de l’audit, l’accès client aux paramètres de l’entreprise, la création d’un chantier et d’un membre affecté à celui-ci, le refus d’affectation inter-entreprises, l’échéance d’abonnement pour l’admin et les membres, le blocage de connexion/session après expiration, la résiliation immédiate, la réactivation et l’exigence d’une date de fin, le reset à usage unique et l’archivage sans suppression d’historique.
- Le même test applique les migrations à une base PostgreSQL locale temporaire puis vérifie le retour arrière de la migration 010 et la conversion des statuts archivés. La base temporaire est supprimée en fin de test.
- Vérifications exécutées : build workspace, typecheck frontend, tests d’isolation/intégration et configuration de production.

## Sécurité et compatibilité

- Les routes de plateforme restent protégées par le RBAC existant (`manage_platform`); aucune seconde couche RBAC n’est créée.
- Les écritures sensibles sont journalisées; l’accès support est limité par le consentement ou une dérogation explicitement justifiée. Les jetons de reset ne sont conservés qu’en hash et les sessions précédentes sont invalidées après reset.
- Les données existantes sont conservées par archivage/désactivation plutôt que suppression. La migration initialise les nouvelles colonnes de façon compatible avec les comptes déjà présents et rattache les affectations historiques de chantier à partir du nom dans le tenant; en cas de doublon, la première correspondance ordonnée par date de création puis identifiant est retenue.
- Écart assumé au modèle métier : « Employé » continue de désigner un compte `users` existant, car le schéma ne contient pas d’entité Employé indépendante.
