# Brain Loop - GitHub Copilot CLI Instructions

This file contains project-specific instructions for GitHub Copilot CLI to ensure consistency and quality throughout development.

## Package Manager

**CRITICAL: Always use `pnpm`**

- Install packages: `pnpm add [package]`
- Install dev dependencies: `pnpm add -D [package]`
- Run scripts: `pnpm dev`, `pnpm build`, `pnpm test`
- Never use `npm` or `yarn` commands

## Technology Stack

### Required Technologies

- **Framework**: Next.js 15+ (App Router only, no Pages Router)
- **Language**: TypeScript (strict mode, no `any` types)
- **Database**: Supabase (PostgreSQL + Auth)
- **AI Gateway**: OpenRouter (via BFF pattern, API routes only)
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Shadcn/UI (copy/paste approach, not npm packages)
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod validation

### Version Requirements

- Node.js: 20.x or higher
- pnpm: 9.x or higher
- TypeScript: 5.x

## Code Style & Patterns

### React Components

- Use ESM imports/exports only (no CommonJS)
- **Default to Server Components** unless interactivity is required
- Use `'use client'` directive explicitly for Client Components
- Functional components only (no class components)
- Prefer composition over inheritance
- Use TypeScript interfaces for props

### API Routes & Backend

- All API routes in `/src/app/api/`
- Validate all inputs with Zod schemas
- Never expose API keys to the client
- Use Supabase RLS (Row Level Security) for data access control
- Return consistent error responses with proper HTTP status codes

### Database

- Use Supabase client (server-side and client-side versions appropriately)
- All migrations in `supabase/migrations/`
- Enable RLS on all tables
- Use UUID for primary keys
- Include `created_at` and `updated_at` timestamps

### Security

- Never commit `.env` files (use `.env.example` as template)
- API keys only in environment variables
- Implement proper authentication checks on protected routes
- Validate user ownership before any data modification

### File Naming

- Components: PascalCase (e.g., `NoteEditor.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- API routes: kebab-case (e.g., `create-note/route.ts`)
- Test files: `*.test.tsx` or `*.test.ts` (colocated with source)

## Testing Strategy

### Priority Order

1. **E2E Tests (Playwright)**: Cover critical user journeys (Happy Paths)
2. **Integration Tests**: Test API routes and database interactions
3. **Unit Tests**: Only for complex business logic (quota calculations, prompt engineering)

### Test Requirements

- All critical features must have E2E tests
- Test files colocated with source code
- Use descriptive test names following Given-When-Then pattern
- Mock external services (OpenRouter) in tests

## Commit Conventions

### Format

```
<type>(<scope>): <subject>

<body>

🤖 Generated with: GitHub Copilot CLI
🛠️ Tools: [list of Copilot CLI tools used]
📋 Epic: [Epic number and name]
✅ Story: [Story number and name]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(auth): implement Google OAuth with Supabase

- Configure Supabase Auth provider
- Add login/logout UI components
- Implement session management
- Add protected route middleware

🤖 Generated with: GitHub Copilot CLI
🛠️ Tools: create, edit, bash
📋 Epic: 1 - Foundation & Auth
✅ Story: 1.3 - User Authentication
```

## Documentation Requirements

### Always Update

- `DEVELOPMENT_LOG.md`: After each significant development session
- `COPILOT_FEATURES.md`: When using new Copilot CLI capabilities
- `docs/architecture.md`: When architectural decisions change
- Code comments: Only for complex logic that needs clarification

### Never Document

- Obvious code (self-explanatory functions)
- Auto-generated code (unless modified)
- Temporary debug code

## Performance & Optimization

### Build Optimization

- Use dynamic imports for large components
- Optimize images with Next.js Image component
- Implement proper caching strategies
- Use React.memo() sparingly and only when profiling shows benefit

### Database Optimization

- Index frequently queried columns
- Use database-level aggregations when possible
- Implement pagination for large datasets
- Avoid N+1 queries

## Error Handling

### Frontend

Frontend is in the folder: Frontend/

- Use Error Boundaries for component-level errors
- Display user-friendly error messages
- Log errors for debugging (console.error in development)

### Backend

Backend is in the folder: Backend/

- Return proper HTTP status codes
- Include error codes for client-side handling
- Log server errors with context
- Never expose internal error details to clients

## AI Integration (OpenRouter)

### Best Practices

- Always use streaming for better UX
- Implement token usage tracking
- Handle rate limits gracefully
- Cache responses when appropriate
- Set reasonable timeouts
- Provide fallback behavior on API failures

### Prompt Engineering

- Store prompts in versioned files (`src/lib/ai/prompts/`)
- Include system context from category configuration
- Implement token limit safeguards
- Test prompts with various models

## Accessibility

### Requirements

- WCAG AA compliance minimum
- Semantic HTML elements
- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Sufficient color contrast
- Focus indicators visible

## Environment Variables

### Required Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter
OPENROUTER_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

### Naming Convention

- Public variables (exposed to client): `NEXT_PUBLIC_*`
- Private variables (server-only): No prefix

## Development Workflow

### Before Starting Work

1. Pull latest changes
2. Check `DEVELOPMENT_LOG.md` for recent changes
3. Review related Epic/Story in `docs/prd.md`
4. Ensure all dependencies installed: `pnpm install`

### During Development

1. Follow TDD when applicable (write test first)
2. Run linter frequently: `pnpm lint`
3. Check TypeScript: `pnpm type-check`
4. Test in browser regularly

### Before Committing

1. Run all tests: `pnpm test`
2. Format code: `pnpm format` (if available)
3. Review changes: `git diff`
4. Use conventional commit format
5. Update documentation if needed

## Quality Standards

### Code Quality

- No TypeScript errors or warnings
- No ESLint errors
- 100% type coverage (no `any` types)
- Consistent code formatting

### Functionality

- All acceptance criteria met
- No regression bugs
- Works on latest Chrome, Firefox, Safari
- Mobile responsive

### Documentation

- All public functions have JSDoc comments
- Complex logic explained
- README updated with new features
- DEVELOPMENT_LOG.md reflects changes

---

**Remember**: Quality over speed. Take time to do it right the first time. This project use the BMade development methodology to ensure maintainability and scalability, so adhere strictly to these guidelines.
