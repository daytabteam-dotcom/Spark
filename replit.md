# Spark — ADHD Companion

A mobile-first ADHD productivity companion (Expo) with AI-powered chat across 20 unlockable companion characters, AI-assisted task extraction from brain dumps, focus sessions, and an XP/leveling system.

## Architecture

- **Mobile app**: Expo Router (`artifacts/spark`), React Native with `react-native-web` for preview
- **API server**: Express on Node (`artifacts/api-server`), shared OpenAPI contract in `lib/api-spec/openapi.yaml`
- **Database**: Postgres via Drizzle ORM, schema in `lib/db/src/schema/index.ts`
- **AI**: Anthropic Claude via Replit AI Integration (no user API key required)
- **Generated client**: `lib/api-client-react` (orval-generated React Query hooks) + `lib/api-zod` (Zod schemas for server validation)

## Key features

- **Onboarding** (3 steps): name, starter character, difficulty tags
- **Today**: at-a-glance dashboard with active companion, XP progress, open tasks
- **Tasks**: brain-dump extraction (AI parses raw text into structured tasks with resistance levels), manual completion
- **Chat**: per-character chat history with AI responses + optional UI blocks (options, checklists, celebrations, timers)
- **Companions**: 20 characters across 6 personality modes (chaos, focus, calm, sarcasm, paradox, urgent), unlocked by XP
- **Focus mode**: timer + companion pep talk + XP rewards on completion

## Data model

- `users`: name, selected character, difficulty tags, xp
- `tasks`: title, status, scheduled/start/end times, durationMinutes, resistanceLevel, taskType
- `sessions`: focus session with active task and character
- `xp_events`: audit of XP grants
- `chat_messages`: per-character history with role + uiBlocks
- `behavior_log`: reserved for future behavior analytics

## Backend endpoints (under `/api`)

- `POST /users`, `GET /users/:id`, `PATCH /users/:id`
- `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- `POST /tasks/extract`, `POST /tasks/confirm-extract`
- `POST /chat`, `GET /chat/history`
- `POST /sessions`, `PATCH /sessions/:id`
- `POST /xp/award`
- `GET /characters`

## Dev

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client/schemas after editing openapi.yaml
- `pnpm --filter @workspace/db run push` — push schema changes to Postgres
- Workflows are managed automatically; the api-server, mockup-sandbox, and Expo dev server all run in parallel.

## Scope-reduced from original spec

- Replit Auth deferred — onboarding currently creates a user record stored in AsyncStorage on the device.
- Local Expo notifications instead of Firebase + Bull job queue.
- JSON chat responses (with embedded UI blocks) instead of SSE streaming.
