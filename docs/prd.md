# Brain Loop Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Faciliter la mémorisation et la compréhension de sujets complexes grâce à l'interrogation ciblée (Active Recall).
- Offrir une solution d'apprentissage assistée par IA abordable, avec une gestion transparente des coûts et quotas.
- Fournir une interface intuitive pour la gestion des connaissances personnelles (PKM) et l'auto-évaluation sans friction.
- Permettre une flexibilité totale dans le choix des modèles d'IA via l'intégration OpenRouter.

### Background Context

Brain Loop est une application SaaS conçue pour les autodidactes, étudiants et professionnels en formation continue qui souhaitent optimiser leur processus d'apprentissage. Contrairement aux outils classiques de flashcards ou de quiz statiques, Brain Loop utilise l'IA générative pour interroger l'utilisateur directement sur le contenu de ses propres notes (texte libre), simulant ainsi un tuteur personnel.

Le projet répond à un besoin d'efficacité pédagogique tout en adressant la contrainte économique des LLM. En s'appuyant sur une architecture technique optimisée (ex: Next.js, Supabase) et l'agrégateur OpenRouter, Brain Loop vise à offrir un modèle freemium viable où l'utilisateur reste maître de sa consommation. **Les choix techniques mentionnés sont indicatifs et pourront être ajustés lors de la phase d’architecture.**

L'expérience utilisateur est centrée sur la fluidité : de la prise de note rapide à l'interrogation intelligente, avec des fonctionnalités innovantes comme la génération dynamique de liens de recherche pour approfondir les concepts.

### Change Log

| Date       | Version | Description                               | Author    |
| :--------- | :------ | :---------------------------------------- | :-------- |
| 2026-01-23 | 0.1     | Initial Draft based on Project Brief      | John (PM) |
| 2026-01-23 | 0.2     | Scope clarification & acceptance criteria | John (PM) |
| 2026-01-23 | 0.3     | Added UI Goals                            | John (PM) |
| 2026-01-23 | 0.4     | Added Technical Assumptions               | John (PM) |
| 2026-01-23 | 0.5     | Added Epic List                           | John (PM) |
| 2026-01-23 | 0.6     | Added Epic 1 Details                      | John (PM) |
| 2026-01-23 | 0.7     | Added Epic 2 Details                      | John (PM) |
| 2026-01-23 | 0.8     | Added Epic 3 Details                      | John (PM) |
| 2026-01-23 | 0.9     | Added Epic 4 Details                      | John (PM) |

## Requirements

### Functional Requirements

- **FR1:** L'utilisateur doit pouvoir s'inscrire et se connecter via Google Auth ou un "Magic Link" email (Passwordless).
- **FR2:** L'utilisateur doit pouvoir créer, éditer et supprimer des **Catégories** de connaissances.
- **FR3:** Pour chaque catégorie, l'utilisateur doit pouvoir sélectionner un modèle d'IA (via OpenRouter) et définir une description/prompt système spécifique (ex: "Expert en Biologie").
- **FR4:** L'utilisateur doit pouvoir créer, éditer et supprimer des **Notes** (texte riche/Markdown) illimitées au sein d'une catégorie.
- **FR5:** L'utilisateur doit pouvoir sélectionner une ou plusieurs notes pour lancer une session après l clique d'un bouton **"Interroge-moi"**.
- **FR6:** Le système doit générer des questions pertinentes basées _uniquement_ sur le contenu des notes sélectionnées.
- **FR7:** Le système doit fournir un feedback immédiat sur les réponses de l'utilisateur (correction, compléments).
- **FR8:** Le système doit identifier les termes clés dans les réponses et générer dynamiquement des boutons de recherche cliquables (Google/Interne) pour approfondir.
- **FR9:** L'utilisateur doit pouvoir visualiser son quota restant (tokens/crédits) via une jauge graphique en temps réel.
- **FR10:** Le système doit envoyer une alerte (Email ou In-App) lorsque le quota atteint un seuil critique (ex: 90% utilisé).

### Non-Functional Requirements

- **NFR1:** L'architecture doit reposer sur des services offrant un tiers gratuit généreux (ex: Supabase pour DB/Auth, Vercel pour hosting) pour minimiser les coûts de démarrage.
- **NFR2:** L'intégration LLM doit se faire exclusivement via l'API OpenRouter pour garantir l'indépendance vis-à-vis des modèles et l'optimisation des coûts.
- **NFR3:** L'interface frontend doit être développée en React/Next.js pour assurer réactivité et maintenabilité.
- **NFR4:** Le temps de réponse pour la génération d'une question ne doit pas dépasser 5 secondes (hors latence modèle).
- **NFR5:** Les données utilisateurs (notes, historiques) doivent être sécurisées via des règles RLS (Row Level Security) strictes au niveau de la base de données.
- **NFR6:** Le système doit être conçu pour une évolutivité future, permettant l'ajout de fonctionnalités payantes et d'analytics sans refonte majeure.
- **NFR7:** L'application doit être conforme aux réglementations de confidentialité des données (ex: GDPR).
- **NFR8:** En cas d'erreur LLM ou de dépassement de quota, le système doit afficher un message clair et non bloquant à l'utilisateur.

## User Interface Design Goals

### Overall UX Vision

Une interface **minimaliste et sans distraction** ("Distraction-free"), favorisant la concentration. Le design doit être épuré, mettant en avant le contenu (les notes) et l'interaction conversationnelle. L'ambiance doit être "académique mais moderne".

### Key Interaction Paradigms

1.  **Navigation hiérarchique simple :** Tableau de bord -> Catégorie -> Liste de notes -> Éditeur.
2.  **Sélection active :** Mécanisme de "Checkboxes" intuitif pour sélectionner les notes avant d'interroger.
3.  **Chat Augmenté :** L'interface de quiz ressemble à une messagerie instantanée, mais enrichie avec des éléments interactifs (boutons de recherche générés dynamiquement, feedbacks visuels de réussite/échec).
4.  **Navigation Contextuelle (Source Carousel) :** Lorsque plusieurs notes sont sélectionnées pour une session, l'interface maintient un chat unique pour éviter la surcharge cognitive, mais offre un carrousel (navigation gauche/droite) permettant de consulter les notes sources originales sans quitter la conversation.

### Core Screens and Views

- **Authentication Screen :** Login très simple (Bouton Google + Champ Email Magic Link).
- **Dashboard (Home) :** Grille des catégories avec indicateurs visuels (nombre de notes, modèle IA associé).
- **Category Detail View :** Liste des notes, barre de recherche, et configuration du modèle IA pour cette catégorie.
- **Note Editor :** Éditeur Markdown/Rich-text plein écran.
- **"Interroge-moi" Session (Active Recall) :** Interface de chat centralisée. Si plusieurs notes sont concernées, un volet rétractable ou un carrousel permet de naviguer horizontalement entre les notes sources pour vérification. Présence d'une jauge de quota discrète.
- **Settings/Quota :** Page de profil affichant la consommation de tokens et les graphiques d'utilisation.

### Accessibility

- **WCAG AA :** Contraste suffisant pour la lecture longue, support clavier complet pour la navigation.

### Branding

- Style propre, typographie lisible (Serif pour les notes, Sans-Serif pour l'UI), palette de couleurs apaisante (tons bleus/verts ou sépia pour réduire la fatigue oculaire).

### Target Device and Platforms

- **Web Responsive :** Priorité Desktop pour la prise de note et l'étude approfondie, mais entièrement fonctionnel sur Mobile pour les révisions rapides ("on the go").

## Technical Assumptions

### Repository Structure

- **Monorepo (Modular Monolith)** : Choix stratégique pour un développeur solo. Tout le code (Frontend + Backend API) réside dans un seul dépôt. Cela simplifie le partage de types (TypeScript), le refactoring et le déploiement atomique.
  - _Why?_ Évite la complexité des microservices ("Distributed Monolith") qui est often une cause d'échec prématuré pour les startups. La scalabilité est gérée par l'infrastructure Serverless, pas par la découpe du code.

### Service Architecture

- **Frontend & API :** **Next.js 14+ (App Router)**.
  - _Scalabilité :_ Les "Server Actions" et API Routes scalent automatiquement via le Serverless (Lambda/Edge functions).
  - _Performance :_ Permet le rendu hybride (Statique pour le landing, Dynamique pour l'app) et le Streaming UI (essentiel pour l'effet "chat" de l'IA).
- **Database & Auth :** **Supabase** (PostgreSQL).
  - _Performance :_ PostgreSQL est robuste et performant. Supabase ajoute une couche temps réel et une API simple.
  - _Sécurité :_ Utilisation native de RLS (Row Level Security) pour que la base de données elle-même empêche un utilisateur de lire les notes d'un autre, même en cas de faille backend.
- **AI Gateway :** **OpenRouter**.
  - _Stratégie :_ Agit comme un "Load Balancer" de modèles. Permet de switcher de `gpt-4o` à `claude-3-haiku` sans redéployer le code si un fournisseur est en panne ou trop cher. Indispensable pour la viabilité économique du projet.

### Testing Requirements

- **Integration Testing (Priorité 1) :** Playwright ou Cypress. On teste les parcours critiques (User Story "Happy Path").
  - _Why?_ En tant que dev solo, les tests unitaires sur chaque fonction sont chronophages. Tester que "Login -> Créer Note -> Interroger" fonctionne garantit que l'app est utilisable.
- **Unit Testing (Priorité 2) :** Uniquement pour la logique complexe (calcul des quotas, parsing des réponses IA).

### Additional Technical Assumptions

- **State Management :** **Zustand**. Plus simple et moins "boilerplate" que Redux, parfait pour gérer l'état global (session utilisateur, préférences) sans impacter les performances de React.
- **Styling :** **Tailwind CSS**. Permet d'itérer très vite sur le design sans gérer des fichiers CSS géants qui deviennent impossible à maintenir (Dette technique).
- **Type Safety :** **TypeScript** (Strict mode). Non-négociable pour la maintenabilité à long terme et l'autocomplétion qui aide l'apprentissage.

## Epic List

1.  **Epic 1: Foundation & Auth**
    - **Goal:** Mettre en place le socle technique (Next.js + Supabase), l'authentification (Google/Magic Link) et la gestion de base de données utilisateur.
    - _Why first?_ Sans utilisateurs et sans base de données sécurisée, on ne peut rien construire d'autre. C'est le "squelette".

2.  **Epic 2: Knowledge Management (CRUD)**
    - **Goal:** Permettre à l'utilisateur de gérer ses Catégories et ses Notes (Création, Lecture, Modification, Suppression).
    - _Why second?_ Il faut du contenu (les notes) avant de pouvoir interroger l'IA.

3.  **Epic 3: The "Brain Loop" (AI Engine)**
    - **Goal:** Implémenter le cœur du système : Connexion OpenRouter, sélection des notes, Chat interactif et Feedback IA.
    - _Why third?_ C'est la fonctionnalité la plus complexe. Elle nécessite que les Epics 1 et 2 soient solides. C'est ici qu'on implémente votre "PoC" de manière robuste.

4.  **Epic 4: Quota & Search Enhancements**
    - **Goal:** Ajouter la gestion des quotas (consommation tokens) et l'enrichissement des réponses (boutons de recherche générés).
    - _Why fourth?_ C'est la couche de "contrôle" et d'amélioration. Le système fonctionne sans ça, mais ce n'est pas viable économiquement ni complet pédagogiquement.

## Epic 1 Details - Foundation & Auth

### Goal

Mettre en place un socle technique robuste et sécurisé, permettant aux utilisateurs de s'inscrire et d'accéder à un tableau de bord vide.

### Stories

- **Story 1.1: Project Initialization & Infrastructure**
  - **As a** Developer,
  - **I want** to initialize the Next.js repository with Supabase and Tailwind CSS,
  - **so that** I have a clean environment to start building features.
  - _AC1:_ Repository created with latest Next.js 14 (App Router).
  - _AC2:_ Tailwind CSS configured and working.
  - _AC3:_ Supabase project connected (env vars set).
  - _AC4:_ Basic CI/CD pipeline (linting) is set up.

- **Story 1.2: Database Schema & RLS Policy**
  - **As a** System,
  - **I want** a secure database schema for Users and Quotas,
  - **so that** user data is stored safely and isolated.
  - _AC1:_ `users` table created (extends Supabase Auth).
  - _AC2:_ `user_quotas` table created.
  - _AC3:_ Row Level Security (RLS) policies enabled: Users can only read/write their own data.

- **Story 1.3: User Authentication (UI + Logic)**
  - **As a** User,
  - **I want** to sign up using Google or a Magic Link,
  - **so that** I can access my private notes without remembering a password.
  - _AC1:_ Login page with "Sign in with Google" button.
  - _AC2:_ Input field for Email with "Send Magic Link" button.
  - _AC3:_ Successful login redirects to `/dashboard`.
  - _AC4:_ Logout button works and redirects to `/login`.

- **Story 1.4: App Shell & Navigation**
  - **As a** User,
  - **I want** a consistent layout with navigation,
  - **so that** I can easily move between the dashboard and settings.
  - _AC1:_ Responsive Header/Sidebar created.
  - _AC2:_ Dashboard page placeholder exists.
  - _AC3:_ Settings/Profile page placeholder exists.
  - _AC4:_ Mobile menu works on small screens.

## Epic 2 Details - Knowledge Management (CRUD)

### Goal

Permettre à l'utilisateur de structurer ses connaissances en créant des catégories et d'y ajouter du contenu riche (notes) qui servira de base à l'IA.

### Stories

- **Story 2.1: Category Management**
  - **As a** User,
  - **I want** to create and manage categories (e.g., "History", "React.js"),
  - **so that** I can organize my learning topics.
  - _AC1:_ Create Category modal/page with fields: Name (Required), Description, AI Model Selection (Dropdown), System Prompt.
  - _AC2:_ Edit/Delete Category functionality.
  - _AC3:_ List of categories displayed on Dashboard with card UI.

- **Story 2.2: Notes List & Navigation**
  - **As a** User,
  - **I want** to see all notes within a category sorted by date,
  - **so that** I can find and review my content.
  - _AC1:_ Clicking a Category card navigates to `/category/[id]`.
  - _AC2:_ List of notes displayed (Title + Created Date + snippet).
  - _AC3:_ **Default sorting: Newest first** (Addresses ease of finding recent work).
  - _AC4:_ Search bar to filter notes by title.
  - _AC5:_ "Create New Note" button is prominent.

- **Story 2.3: Rich Text Note Editor**
  - **As a** User,
  - **I want** to write notes with formatting (bold, lists, code blocks),
  - **so that** my content is structured and easy to read.
  - _AC1:_ Integration of a Markdown editor (e.g., Tiptap or similar).
  - _AC2:_ Support for Headers, Bold, Italic, Lists, and Code Blocks.
  - _AC3:_ Auto-save or clear "Save" button.
  - _AC4:_ Preview mode to see rendered Markdown.

- **Story 2.4: Note Selection UI**
  - **As a** User,
  - **I want** to select specific notes from the list,
  - **so that** I can tell the IA exactly what to quiz me on.
  - _AC1:_ Checkboxes added to each note item in the list.
  - _AC2:_ "Select All" / "Deselect All" toggle.
  - _AC3:_ Floating action bar or button "Interrogation" appears when at least 1 note is selected, with a limit of 5 notes max (to control prompt size).
  - _AC4:_ The number of selected notes is clearly visible.

## Epic 3 Details - The "Brain Loop" (AI Engine)

### Goal

Implémenter l'interaction principale d'apprentissage, connectant les notes de l'utilisateur à l'intelligence artificielle pour générer des sessions d'interrogation personnalisées, tout en protégeant le mécanisme de rappel actif (Active Recall).

### Stories

- **Story 3.1: Session Context Engine**
  - **As a** System,
  - **I want** to construct an optimized prompt from selected notes,
  - **so that** the AI has the exact context to generate relevant questions.
  - _AC1:_ Utility function that concatenates content from selected notes (handling token limits).
  - _AC2:_ Retrieval of the Category's specific "System Prompt".
  - _AC3:_ Construction of the final payload to be sent to OpenRouter API.

- **Story 3.2: Chat Interface Implementation** (already implemented but needs refinement)
  - **As a** User,
  - **I want** a chat-like interface to interact with the quiz,
  - **so that** the experience feels conversational.
  - _AC1:_ Chat UI with distinct bubbles for AI (Left) and User (Right).
  - _AC2:_ "Send" button and text input area (auto-expanding).
  - _AC3:_ Loading states (typing indicators) while waiting for AI.

- **Story 3.3: Hint System & Active Recall Protection** (We can skip this for MVP, but it's a key differentiator for the product)
  - **As a** User,
  - **I want** to request a hint if I'm stuck, but without seeing the full note,
  - **so that** I am forced to make an effort to remember (Active Recall).
  - _AC1:_ **CRITICAL:** The source text of the notes is HIDDEN during the quiz session.
  - _AC2:_ A "Demander un indice" button is available.
  - _AC3:_ Clicking the button consumes a specific "Hint Quota" (limited per month for free users).
  - _AC4:_ The AI generates a subtle hint based on the context, not the direct answer.

- **Story 3.4: OpenRouter Integration & Streaming**
  - **As a** User,
  - **I want** to see the AI's question appear progressively (streaming),
  - **so that** the application feels fast and responsive.
  - _AC1:_ Backend API route connects to OpenRouter using the user's selected model.
  - _AC2:_ Frontend implements stream reading to display text as it arrives.
  - _AC3:_ Basic error handling (e.g., if OpenRouter is down).

- **Story 3.5: Multi-Note Session Navigation**
  - **As a** User,
  - **I want** to navigate between different active quizzes if I selected multiple notes,
  - **so that** I can focus on one specific note's context at a time without mixing everything.
  - _AC1:_ If multiple notes are selected for interrogation, the UI presents them as a "Carousel" or "Tabs" of separate chat sessions.
  - _AC2:_ Navigation controls (Left/Right arrows or Swiping) to switch between the active AI Chat for Note A and Note B.
  - _AC3:_ Each chat maintains its own independent conversation history.

## Epic 4 Details - Quota & Search Enhancements

### Goal

Gérer les limites d'utilisation de manière ludique et transparente pour contrôler les coûts, et enrichir l'apprentissage avec des suggestions de recherche intelligentes.

### Stories

- **Story 4.1: Token Accounting Logic (Backend)**
  - **As a** System,
  - **I want** to track exact token usage for every AI interaction,
  - **so that** I can monitor technical costs accurately.
  - _AC1:_ Database table `usage_logs` created to record every API call (tokens input/output, model used).
  - _AC2:_ Backend logic converts Tokens into "Learning Energy" points (Abstraction Layer).
  - _AC3:_ Handling of different token costs per model (e.g., GPT-4 costs more "Energy" than Llama 3).

- **Story 4.2: User Quota UI (The "Brain Energy" Bar)**
  - **As a** User,
  - **I want** to see my remaining "Energy" or "Credits" in a simple way,
  - **so that** I understand my usage without needing to know what a "token" is.
  - _AC1:_ Visual "Energy Bar" or "Neurone Points" display in the Header.
  - _AC2:_ Simple deduction rules shown to user (e.g., "1 Question = 10 Energy", "1 Hint = 5 Energy").
  - _AC3:_ "Low Energy" warning when close to depletion.

- **Story 4.3: Dynamic Search Buttons (Pedagogical Engine)**
  - **As a** User,
  - **I want** clickable buttons for key terms in the AI's answer,
  - **so that** I can instantly research concepts I didn't understand.
  - _AC1:_ AI Prompt engineering to request "Keywords" in a structured format (JSON or specific syntax) along with the chat response.
  - _AC2:_ Frontend parser to detect these keywords and render them as `<SearchButton />` components.
  - _AC3:_ Clicking the button opens a new tab with a Google/DuckDuckGo search for the term.

## Checklist Results Report

## Next Steps

### UX Expert Prompt

Create a high-level site map and wireframes for the Brain Loop application based on the PRD. Focus on the "Distraction-Free" Dashboard and the "Chat Augmenté" interface. Ensure the "Energy Bar" is visible but not intrusive.

### Architect Prompt

Design the Next.js + Supabase architecture. Define the database schema (Users, Categories, Notes, UsageLogs) and the OpenRouter integration pattern. Propose a folder structure for the Monorepo.
