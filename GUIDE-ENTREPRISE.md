# Guide de constitution et d’utilisation des équipes

Ce guide aide l’administrateur d’une entreprise à choisir les bons rôles,
affecter les comptes à leur périmètre et faire circuler les tâches, les rapports
et les informations financières sans confondre les responsabilités.

## 1. Préparer l’entreprise

Avant d’inviter l’équipe :

1. Complétez les informations légales et les coordonnées dans **Paramètres >
   Entreprise**.
2. Créez les chantiers actifs avec un nom distinctif, une localisation, un
   statut et, si nécessaire, les dates prévisionnelles.
3. Créez les comptes de l’équipe avec une adresse personnelle/professionnelle
   vérifiée, un rôle adapté et un mot de passe provisoire unique d’au moins
   12 caractères.
4. Remettez chaque mot de passe par un canal privé et sûr. La plateforme ne
   l’affiche pas après création. Chaque membre peut ensuite le remplacer via le
   parcours de réinitialisation.
5. Affectez les rôles terrain et le maître d’ouvrage au chantier auquel ils
   doivent accéder. Un compte limité à un chantier ne doit pas rester sans
   affectation.
6. Créez les tâches avec responsable et échéance; les membres mettent à jour
   leur statut et signalent les blocages.

Un compte de membre appartient à une seule entreprise. Les chantiers et
affectations sont cloisonnés côté serveur : une affectation vers un chantier
d’une autre entreprise est refusée.

## 2. Rôles et espaces

| Rôle | Mission principale | Espaces disponibles | Peut agir sur | Ne peut pas |
|---|---|---|---|---|
| **Administrateur entreprise** | Organiser l’entreprise et arbitrer les opérations | Tableau de bord, Chantiers, Mes tâches, Photos, Rapports, Équipe, Budget, Dossiers de paiement, Trésorerie, Paramètres, Profil | Modifier les paramètres, gérer les membres et chantiers, créer/affecter des tâches, consulter les opérations financières, créer et valider les rapports | Saisir ou clôturer une opération de trésorerie/dossier de paiement : ces écritures sont réservées au Comptable |
| **Conducteur de travaux** | Coordonner un chantier et contrôler les comptes rendus | Tableau de bord, Chantiers, Mes tâches, Photos, Rapports, Équipe, Profil | Gérer les tâches du chantier affecté, consulter l’équipe et les preuves, valider les rapports du chantier | Créer des rapports, gérer les comptes, changer les affectations, créer des chantiers, gérer la finance ou pointer |
| **Chef de chantier** | Diriger l’exécution quotidienne sur le terrain | Tableau de bord, Chantiers, Mes tâches, Photos, Rapports, Équipe, Pointage, Profil | Gérer les tâches du chantier, produire les rapports journaliers, ajouter des photos, pointer ses heures, consulter l’équipe du chantier | Valider/publier ses rapports, gérer les comptes ou les affectations, créer des chantiers, accéder à la finance |
| **Compagnon** | Réaliser et rendre compte de ses propres tâches | Tableau de bord, Mes tâches, Photos, Pointage, Profil | Consulter uniquement les tâches qui lui sont assignées, les faire passer à « En cours », « Bloquée » ou « Terminée », ajouter des photos, pointer ses heures | Consulter les tâches d’un autre membre, gérer l’équipe, rédiger/valider les rapports ou accéder à la finance |
| **Sous-traitant** | Exécuter les tâches confiées dans un périmètre externe | Tableau de bord, Mes tâches, Photos, Profil | Consulter et mettre à jour ses tâches assignées, ajouter des photos sur son chantier affecté | Pointer les heures, consulter les données financières, gérer l’équipe, les chantiers ou les rapports internes |
| **Comptable** | Tenir la trésorerie et les dossiers de paiement | Tableau de bord, Dossiers de paiement, Trésorerie, Rapports, Profil | Consulter les finances de l’entreprise et les rapports validés; enregistrer et réaliser les opérations financières; créer et faire évoluer les dossiers de paiement | Modifier les paramètres de l’entreprise, gérer l’équipe, les chantiers ou les tâches; consulter les rapports non validés |
| **Maître d’ouvrage** | Suivre le chantier et les livrables publiés | Tableau de bord, Chantiers, Photos, Rapports, Profil | Consulter l’avancement, les photos et les rapports validés du chantier affecté | Modifier quoi que ce soit, voir les rapports en attente ou accéder aux tâches internes, à l’équipe complète et aux finances |

L’espace **Éditeur** est le back-office de la plateforme, distinct des rôles
client. Il gère les comptes, les licences et l’assistance; il n’est pas un rôle
à attribuer à un employé d’entreprise.

## 3. Séparation des responsabilités

### Chantier et rapports

- Le **Chef de chantier** suit la journée, fait avancer ou bloque les tâches,
  prend des photos et rédige les rapports.
- Le **Conducteur de travaux** coordonne les tâches et valide les rapports
  produits sur le chantier affecté. La validation publie le rapport.
- Le **Maître d’ouvrage** ne voit que les rapports validés. Il ne voit ni brouillon
  ni rapport à valider.
- Le **Compagnon** et le **Sous-traitant** ne voient que les tâches qui leur sont
  affectées; ils peuvent signaler un blocage directement par le statut.
- L’**Administrateur entreprise** garde la supervision globale et peut gérer les
  comptes, chantiers et validations.

### Finance

- Le **Comptable** est le seul rôle client qui peut créer ou enregistrer une
  réalisation financière et faire progresser les dossiers de paiement.
- L’**Administrateur entreprise** conserve une vue de contrôle en lecture seule
  dans Budget, Trésorerie et Dossiers de paiement. Il ne peut pas modifier les
  écritures ni marquer une opération comme réalisée.
- Les autres rôles n’ont pas accès aux espaces financiers.
- Les **Rapports** visibles par le Comptable sont limités aux rapports validés.
  Aucun paiement Mobile Money automatique ou rappel client automatique n’est
  activé par cette version.

Cette séparation est appliquée côté API et ne dépend pas uniquement du masquage
des boutons dans l’interface.

## 4. Affectations et évolution des accès

- Les rôles Conducteur, Chef de chantier, Compagnon, Sous-traitant et Maître
  d’ouvrage doivent être affectés à un chantier actif.
- Le Comptable travaille à l’échelle de l’entreprise et n’a pas d’affectation
  chantier obligatoire.
- Modifier le rôle recalcule ses sections et permissions depuis la définition
  centrale des rôles. Une permission affichée dans l’interface n’accorde jamais
  un accès que l’API n’autorise pas.
- Pour suspendre un accès sans perdre l’historique, désactivez le membre au lieu
  de supprimer ses données.
- Un changement de chantier d’un employé terrain doit être effectué par
  l’administrateur de l’entreprise; les tâches et contenus déjà produits restent
  rattachés à leurs enregistrements d’origine.

## 5. Flux de travail recommandé

1. **Administrateur** crée les chantiers et les membres, puis affecte chaque
   équipe.
2. **Administrateur ou Conducteur** crée des tâches, choisit un responsable et
   fixe une échéance.
3. **Compagnon/Sous-traitant** met à jour ses propres tâches et dépose les preuves
   terrain autorisées.
4. **Chef de chantier** suit les blocages, le pointage et prépare le rapport
   journalier.
5. **Conducteur** contrôle et valide le rapport; le **Maître d’ouvrage** peut
   alors consulter la version publiée.
6. **Comptable** enregistre les encaissements/dépenses et suit les dossiers de
   paiement; l’administrateur consulte les indicateurs sans altérer les écritures.

## 6. Limites connues à ne pas confondre avec une fonction activée

- Les justificatifs et relances restent manuels; aucun email de relance client
  n’est envoyé automatiquement.
- Le pointage est individuel; le rôle Chef de chantier peut pointer ses propres
  heures, mais ne valide pas les heures de l’équipe.
- Le modèle Employé est actuellement représenté par un compte utilisateur
  (`users`); il n’existe pas de dossier RH séparé.
- La plateforme ne doit pas être utilisée pour partager les mots de passe ou
  enregistrer les données sensibles dans les descriptions de tâches et rapports.
