# Echoflow - AI-Powered Active Recall Learning Platform

![Echoflow Logo](../Frontend/public/images/echoflow_logo.png)

**Transform your notes into knowledge through AI-driven active recall.**

Echoflow helps students and lifelong learners solidify concepts by turning passive note-taking into active learning sessions powered by AI.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Development](#development)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

Echoflow addresses a common learning problem: **we take notes, but rarely review them effectively.**

### The Problem

- Students create detailed notes but struggle to retain information
- Traditional review methods are passive and ineffective
- No personalized feedback on knowledge gaps

### The Solution

Echoflow uses AI to:

- Generate contextual questions based on your notes
- Engage you in conversational learning sessions
- Track your progress and identify weak areas
- Provide adaptive follow-up questions

---

## ✨ Key Features

### Core Functionality (MVP)

- **📝 Note Management**: Organize notes by category with Markdown support
- **🤖 AI Questioning**: Get quizzed on individual or multiple notes
- **💬 Conversational Learning**: Chat with AI to deepen understanding
- **📊 Progress Tracking**: Monitor study sessions and performance
- **🎨 Beautiful UI**: Clean, modern interface with TailwindCSS 4.0

### Advanced Features

- **Multi-note Context**: Quiz across related topics for better retention
- **Adaptive Difficulty**: AI adjusts based on your responses
- **Study Analytics**: Visualize learning patterns and weak points
- **Freemium Model**: Free tier with weekly hint quota, premium for unlimited access

---

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS 4.0 + shadcn/ui
- **State Management**: Zustand
- **Markdown**: react-markdown + remark-gfm

### Backend

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Google OAuth + Magic Links)
- **AI Gateway**: OpenRouter (with model rotation for free tier)
- **API**: Next.js API Routes (BFF pattern)

### Infrastructure

- **Hosting**: Vercel
- **Package Manager**: pnpm
- **Version Control**: Git + GitHub

---

## 🏗️ Architecture

### Database Schema

```
users (Supabase Auth)
  └─ profiles (user_id, email, created_at, updated_at)

categories
  ├─ id (uuid)
  ├─ user_id (fk → profiles)
  ├─ name (text)
  ├─ color (text)
  └─ created_at, updated_at

notes
  ├─ id (uuid)
  ├─ category_id (fk → categories)
  ├─ user_id (fk → profiles)
  ├─ title (text)
  ├─ content (text, Markdown)
  └─ created_at, updated_at

study_sessions
  ├─ id (uuid)
  ├─ user_id (fk → profiles)
  ├─ category_id (fk → categories, nullable)
  ├─ note_ids (uuid[], array of note IDs)
  ├─ conversation (jsonb, chat history)
  ├─ model_used (text)
  ├─ ai_feedback (jsonb, analysis + conclusion)
  ├─ duration_seconds (integer)
  └─ created_at
```

### AI Integration Flow

1. **User initiates quiz** → API route receives note(s) + optional previous feedback
2. **OpenRouter API call** → Tries free models in rotation (deepseek, qwen, llama)
3. **Streaming response** → JSON format: `{ chat_response, analysis, weaknesses, conclusion }`
4. **Frontend parsing** → Displays only `chat_response`, stores full JSON
5. **Session tracking** → Saves conversation + AI feedback to `study_sessions`
6. **Adaptive learning** → Next quiz uses previous `conclusion` for context

### Model Rotation Strategy

```typescript
const FREE_MODELS = [
	"deepseek/deepseek-chat",
	"qwen/qwen-2.5-72b-instruct",
	"meta-llama/llama-3.1-8b-instruct:free",
];

// Fallback logic: try each model until success
for (const model of FREE_MODELS) {
	try {
		const response = await callOpenRouter(model, prompt);
		return response;
	} catch (error) {
		if (isRateLimitError(error)) continue;
		throw error;
	}
}
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x+
- pnpm 9.x+
- Supabase account
- OpenRouter API key

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/ElAkab/echoflow.git
cd echoflow
```

2. **Install dependencies**

```bash
cd Frontend
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Run database migrations**

- Go to Supabase Dashboard → SQL Editor
- Execute files in `/Backend/migrations/` in order

5. **Start development server**

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 💻 Development

### Project Structure

```
echoflow/
├── Frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   │   ├── (protected)/    # Authenticated routes
│   │   │   ├── api/            # API routes
│   │   │   └── auth/           # Auth pages
│   │   ├── components/         # React components
│   │   │   ├── ui/             # shadcn components
│   │   │   ├── notes/          # Note-related components
│   │   │   └── dashboard/      # Dashboard components
│   │   └── lib/                # Utilities & configs
│   └── public/                 # Static assets
├── Backend/
│   ├── migrations/             # SQL migrations
│   └── architecture.md         # Backend docs
└── docs/
    ├── prd.md                  # Product requirements
    └── project-brief.md        # Project overview
```

### Development Workflow

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature
```

2. **Follow BMade methodology**

- **Brief**: Define the feature clearly
- **Model**: Design architecture/schema
- **Act**: Implement with tests
- **Deploy**: Push to staging
- **Evaluate**: Review and iterate

3. **Commit conventions**

```
feat(notes): add markdown preview
fix(auth): resolve OAuth callback error
docs(readme): update installation steps
```

4. **Run tests** (when available)

```bash
pnpm test
```

---

## 🌐 Deployment

### Vercel (Recommended)

1. **Push to GitHub**

```bash
git push origin main
```

2. **Import project in Vercel**

- Root Directory: `Frontend`
- Build Command: `pnpm build`
- Install Command: `pnpm install`

3. **Configure environment variables**

- Add all `.env.local` variables to Vercel dashboard

4. **Deploy**

- Automatic deployments on push to `main`

### Database (Supabase)

- Already hosted on Supabase cloud
- Run migrations manually via SQL Editor
- Enable RLS policies for security

---

## 🗺️ Roadmap

### Phase 1: MVP ✅

- [x] User authentication (Google OAuth + Magic Link)
- [x] Note CRUD with categories
- [x] Single-note AI questioning
- [x] Multi-note quiz mode
- [x] Markdown support
- [x] Study session tracking

### Phase 2: Analytics 🚧

- [ ] Dashboard with progress charts
- [ ] Performance insights per category
- [ ] Weak area identification
- [ ] Study streak tracking

### Phase 3: Premium Features

- [ ] Unlimited AI interactions
- [ ] Advanced analytics
- [ ] Conversation history access
- [ ] Custom AI system prompts
- [ ] Spaced repetition algorithm

### Phase 4: Collaboration

- [ ] Share notes with peers
- [ ] Group study sessions
- [ ] Public note library

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commits
4. Submit a pull request

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add comments for complex logic only
- Run `pnpm lint` before committing

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **GitHub Copilot CLI**: For enabling vibe-driven development
- **BMade Method**: For structured project planning
- **OpenRouter**: For free-tier AI model access
- **Supabase**: For backend infrastructure
- **Next.js Team**: For an amazing framework

---

## 📬 Contact

**Adam El Akab**

- GitHub: [@ElAkab](https://github.com/ElAkab)
- Project Link: [https://github.com/ElAkab/echoflow](https://github.com/ElAkab/echoflow)
- Live Demo: [https://echoflow.vercel.app](https://echoflow-phi.vercel.app)

---

**Made with ❤️ and a lot of Copilot CLI magic ✨**
