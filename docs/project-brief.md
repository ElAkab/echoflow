# Brief de Projet : Echoflow (Interface d'Auto-Interrogation IA)

## 1. Résumé Exécutif

Création d'une interface web SaaS (Freemium/Gratuit) permettant aux utilisateurs autodidactes de stimuler leur apprentissage via des interrogations générées par IA (Active Recall) basées sur leurs propres notes. L'application vise à minimiser les coûts en utilisant OpenRouter et offrira une gestion transparente des quotas. L'IA agit comme un assistant pédagogique, guidant l'utilisateur dans sa mémorisation et sa compréhension des concepts.

## 2. Objectifs du Projet

- **Principal :** Faciliter la mémorisation et la compréhension de sujets complexes grâce à l'interrogation ciblée sur des notes personnelles.
- **Technique :** Intégrer divers modèles d'IA via OpenRouter avec une gestion fine des coûts et des quotas utilisateurs. Prévoir une architecture évolutive et scalable pour un passage éventuel en mode payant.
- **Expérience Utilisateur :** Offrir une interface fluide pour la prise de notes, la catégorisation et l'interaction conversationnelle avec l'IA. Minimiser la friction lors de l'inscription (passwordless ou Google Auth).

## 3. Public Cible

- Étudiants et autodidactes.
- Professionnels en formation continue.
- Toute personne souhaitant structurer ses connaissances (PKM - Personal Knowledge Management).
- Utilisateurs souhaitant un apprentissage efficace sans perte de temps.

## 4. Fonctionnalités Clés (MVP)

### A. Gestion de Contenu

- **Catégories Personnalisées :** Création, édition, suppression de catégories (matières/sujets).
- **Configuration IA par Catégorie :** Association d'un modèle spécifique (ex général: Claude 3 Haiku, Llama 3) et d'une description contextuelle (ex: "Tu es un assistant pédagogique" ou plus précis "Tu es un expert en biologie").
- **Prise de Notes :** Éditeur de texte riche (Markdown ou Rich Text) pour créer un nombre illimité de notes par catégorie. Possibilité d’ajouter images ou code si nécessaire. Les notes peuvent également être initialement générées par l’IA à partir d’une image, puis modifiées et complétées librement par l’utilisateur.
- **Prévisualisation des notes après sauvegarde :** Affichage agrandi des notes avec options d’édition rapide, incluant les boutons "Modifier", "Supprimer" et "Interroger".

### B. Moteur d'Interrogation ("Interroge-moi")

- **Sélection :** L'utilisateur sélectionne une ou plusieurs notes.
- **Génération de Quiz :** L'IA génère des questions basées _uniquement_ sur le contenu sélectionné.
- **Feedback :** Analyse de la réponse utilisateur avec correction, explications et suggestions de mots-clés.
- **Mode Discussion :** Approfondir un point précis via un chat contextuel.
- **Aide à la Recherche :** Détection de mots-clés dans les réponses IA → boutons cliquables pour lancer une recherche (Google/Interne).

### C. Gestion Utilisateur & Quotas

- **Authentification :** "Passwordless" (Magic Link) ou Google Auth.
- **Gestion des Coûts et Quotas :**
  - Visualisation graphique du quota restant (tokens/crédits).
  - Alertes (Email/In-App) avant épuisement.
  - Prévoir une option payante si quota dépassé ou fonctionnalités premium ajoutées.
  - Intégration OpenRouter pour le backend LLM.
- **Sécurité et Confidentialité :** Les notes personnelles et l’historique de quiz sont protégés et stockés de manière sécurisée.

## 5. Fonctionnalités Post-MVP (Phase 2)

- **Analytics :** Graphiques de progression basés sur les feedbacks de l'IA.
- **Gamification :** Suivi des séries, badges de régularité.
- **Mode Révision Espacée (SRS) :** L'IA suggère quand réviser quelles notes.
- **Scalabilité et Évolution :** Concevoir l’application pour qu’elle puisse s’améliorer et évoluer progressivement avec le temps, en gérant plus de notes et d’utilisateurs au fur et à mesure que le projet grandit.

## 6. Contraintes Techniques

- **Coût :** Architecture optimisée pour limiter les coûts (Serverless, DB gratuite type Supabase/Firebase).
- **Modèles IA :** Utilisation exclusive d'OpenRouter pour l’agilité, le choix des modèles et le contrôle des quotas.
- **Frontend :** Réactif et intuitif (React/Next.js recommandé).
- **Backend :** Prévoir une structure évolutive pour l’intégration future de fonctionnalités payantes et analytics.

## 7. Indicateurs de Succès

- Nombre d'utilisateurs actifs quotidiens.
- Coût moyen par utilisateur vs quota gratuit offert.
- Taux de rétention après la première interrogation.
- Pourcentage de notes interrogées et progression utilisateur.
- Engagement avec la fonctionnalité “Interroge-moi” et feedback IA.
