# État de recette technique du pilote

Date : 18 octobre 2026

## Résultats vérifiés

- `pnpm.cmd build` : réussi; compilation TypeScript du backend et build de production Vite réussis. Vite affiche un avertissement de bundle JavaScript supérieur à 500 kB.
- `pnpm.cmd check:roles` : réussi sur l’API locale et la base connectée. Les connexions, rôles et accès aux parcours de lecture prévus ont été vérifiés pour `EDITOR`, `ADMIN_ENTERPRISE`, `CONDUCTEUR`, `CHEF_CHANTIER`, `COMPAGNON`, `SOUS_TRAITANT`, `COMPTABLE` et `MAITRE_OUVRAGE`.
- `pnpm.cmd check:tenant-isolation` : simulation réussie dans une base locale temporaire créée après application des sept migrations. Deux entreprises isolées ne voient chacune que leurs chantiers et tâches; les créations et modifications inter-entreprises sont refusées. La base temporaire a été supprimée.
- `pnpm.cmd check:production-config` : réussi; une configuration avec TLS et clé forte est acceptée, tandis que l’absence de TLS, une clé trop courte et la valeur d’exemple sont refusées.
- Syntaxe Node et formatage Oxfmt du script de recette : vérifiés.
- Le backend refuse en configuration `production` une connexion PostgreSQL sans TLS (`DATABASE_SSL=true`) et une clé JWT courte, de remplacement ou insuffisamment variée. Le contrôle automatisé de ces prérequis est fourni par `pnpm check:production-config`.
- Pour cette version, Mobile Money automatisé est explicitement hors périmètre; les routes préparatoires répondent HTTP 503. Les encaissements sont enregistrés manuellement.

## Résultats non vérifiés ou bloquants

- La configuration actuelle pointe sur PostgreSQL local (`127.0.0.1`), base `postgres`, en mode `development`; cette base contient un tenant et les sept migrations sont déjà appliquées. Elle n’a pas été utilisée comme préproduction ni modifiée par la simulation.
- La recette d’isolation en préproduction n’a pas été exécutée. La simulation locale temporaire ne valide ni les données, ni la configuration, ni les migrations de l’environnement de préproduction réel.
- Les garde-fous de configuration ne remplacent pas les secrets, TLS, domaine et configuration réseau effectifs de l’hébergeur; ceux-ci doivent être fournis et validés dans l’environnement de déploiement.
- La base de préproduction, l’application des migrations dans cet environnement et la recette sur mobile ne sont pas vérifiées par ces contrôles locaux.
- Les sauvegardes, leur restauration, la supervision, les alertes, le plan de reprise et les procédures opérationnelles ne sont pas testés.
- Le paiement Mobile Money automatisé est hors périmètre de cette version; les routes préparatoires répondent HTTP 503. Le processus de lancement doit utiliser les encaissements manuels uniquement.
- Les mentions fiscales et la conformité des factures doivent encore être confirmées pour le pays de commercialisation par un conseiller compétent.

## Conclusion

Les contrôles locaux réussis ne suffisent pas à autoriser une mise en production générale. Le statut reste « pilote accompagné » jusqu’à la recette en préproduction, aux validations opérationnelles et aux validations juridiques/fiscales applicables. L’absence de Mobile Money automatisé est une limite assumée de cette version, non un blocage si l’offre prévoit le règlement manuel.
