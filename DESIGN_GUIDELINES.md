# Echoflow - Design Guidelines

## Contexte

L'application MVP fonctionne bien, mais le style actuel n'est pas optimal pour un usage intensif de lecture et de concentration. Le thème principal blanc fatigue les yeux et ne donne pas une impression "pro". L'objectif de ces guidelines est de définir un style cohérent, sombre et professionnel pour toutes les pages, en restant fidèle à l'expérience utilisateur déjà implémentée.

**Stack actuelle :**

- Frontend : React + Next.js
- UI : Shadcn/UI + TailwindCSS v4
- Composants interactifs : modals, boutons, icônes

---

## Thème général

- **Mode sombre** : couleurs de fond sombres (#1E1E2F ou #2A2A3B pour les sections principales)
- **Texte** : clair sur fond sombre (#F5F5F5)
- **Accent / éléments interactifs** : bleu clair / turquoise pour boutons et survols (#4FD1C5)
- **Contraste suffisant** pour lisibilité et accessibilité
- **Cohérence** : chaque page doit suivre le même thème sombre, y compris modals, menus, formulaires et dashboard

---

## Dashboard (Page principale)

### Structure

- **Header minimaliste** : accès aux zones principales de l'app (Profil, Paramètres, Nouvelle catégorie)
- **Liste des catégories** créées par l'utilisateur

### Catégorie

Chaque catégorie doit afficher :

1. **Titre** (bold, taille lisible)
2. **Description** (taille plus petite, subtile)
3. **Nombre de notes** (badge ou texte discret)

#### Actions sur une catégorie

- **Modifier** :
  - Bouton minimaliste avec icône "crayon"
  - Permet de changer titre, description et couleur
- **Supprimer** :
  - Petit bouton discret avec icône dédiée
  - Confirmer suppression via un modal
- **Créer nouvelle catégorie** :
  - Bouton + modal
  - Utiliser le formulaire existant, simplifié pour modal
- **Entrer dans la catégorie** :
  - Clique sur la carte de catégorie → accès à ses notes

---

## Notes (Page catégorie)

### Layout

- **Disposition simplifiée** : cartes de notes avec largeur et hauteur fixes
- **Effet visuel** : léger dégradé interne si contenu trop volumineux
- **Barre de recherche** : pour filtrer les notes par texte
- **Actions sur une note** :
  - **Voir / Modifier** : clic sur la carte → ouvre modal avec contenu complet
  - **Créer nouvelle note** : bouton + modal
  - **Modifier** : bouton "More" discret ou menu contextuel
  - **Supprimer** : icône subtile dédiée
  - **Quiz me** : bouton pour lancer le quiz sur la note

### UX

- Rendre la lecture confortable avec des cartes espacées
- Ne pas surcharger l'interface avec trop d'options visibles
- Tout bouton ou icône doit être **cohérent en style et couleur avec le thème sombre**

---

## Composants UI spécifiques

- **Modal** : fond légèrement plus sombre que le dashboard, coins arrondis, ombre subtile
- **Boutons** :
  - Minimalistes
  - Hover : légère augmentation de luminosité
  - Consistants dans toute l'app
- **Icônes** : Lucide React
- **Typographie** : font sans-serif, hiérarchie claire entre titres, sous-titres et texte normal

---

## Consignes générales

- **Ne rien casser** : conserver toute la logique actuelle (gestion des notes, API, état)
- **Uniformité** : même thème sombre sur toutes les pages, modals et formulaires
- **Lisibilité** : espaces suffisants, texte clair sur fond sombre
- **Performance** : éviter les effets trop lourds
- **Extensibilité** : permettre d’ajouter facilement de nouvelles actions ou composants

---

## Checklist rapide avant release

- [ ] Thème sombre appliqué sur toutes les pages
- [ ] Dashboard simplifié avec header + catégories
- [ ] Actions catégorie (modifier / supprimer / créer / entrer) opérationnelles
- [ ] Notes : layout cartes fixe, search, créer/modifier/supprimer fonctionnel
- [ ] Modals cohérentes et stylisées
- [ ] Tous boutons et icônes respectent les guidelines
- [ ] Pas de régression dans la logique métier existante
