# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VDO-GEN is an AI video generation workflow platform. Users build video production pipelines via a visual node-based editor, connecting text analysis, image generation, and video generation nodes from multiple AI providers.

## Tech Stack

- **Backend**: Node.js 20+, TypeScript 5.7, Fastify 5, Mongoose 8 (MongoDB 7), BullMQ (Redis 7), Socket.io, Zod, Pino, Vitest
- **Frontend**: React 19.2, TypeScript 5.9, Vite 7, React Flow 12, Zustand 5, React Router 7, TanStack Query 5, Tailwind CSS 4, Lucide icons
- **Infrastructure**: Docker Compose (MongoDB + Redis), local filesystem storage (S3 interface stub)

## Commands

### Backend (`cd backend/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (nodemon + tsx, watches `src/**/*.ts`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server from `dist/` |
| `npm run typecheck` | Type check without emit |
| `npm test` | Run Vitest (single run) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npx vitest run tests/unit/foo.test.ts` | Run single test file |
| `npx vitest --config vitest.unit.config.ts` | Run unit tests only (no DB/Redis) |
| `docker compose up -d` | Start MongoDB 7 + Redis 7 |

### Frontend (`cd frontend/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite build to `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |

## Architecture

### Backend — Modular Layered Architecture

```
backend/src/
├── index.ts                    # Entry: async main, graceful shutdown (SIGTERM/SIGINT)
├── app.ts                      # Fastify factory: CORS, Helmet, rate-limit, routes
├── config/                     # Zod-validated env vars, DB/Redis/storage connections
├── modules/                    # Feature modules (each has routes/controller/service/repository/model/schema/types)
│   ├── auth/                   # JWT auth: register, login, refresh (token rotation), logout
│   ├── users/                  # Profile, provider preferences, API key management
│   ├── projects/               # Project CRUD (container for workflows)
│   ├── workflows/              # Workflow CRUD + execution lifecycle
│   ├── nodes/                  # Node type registry + handlers
│   ├── assets/                 # File upload/serve, metadata
│   └── webhooks/               # AI service callback ingestion
├── providers/                  # AI provider adapters (Strategy + Adapter pattern)
│   ├── provider.interface.ts   # Core interfaces
│   ├── provider.registry.ts   # Dynamic resolution by category
│   ├── text-analysis/          # OpenAI, Anthropic
│   ├── image-generation/       # FAL, Stability, DALL-E, Ideogram, KIE
│   └── video-generation/       # Runway, Kling, Pika, Luma
├── engine/                     # DAG resolver, workflow executor, execution context
├── queue/                      # BullMQ: queue manager, per-category workers, FlowProducer DAG
├── storage/                    # Storage interface + local adapter (S3 stub)
├── realtime/                   # Socket.io: JWT-authenticated rooms per execution
└── common/                     # Error classes (AppError hierarchy), middleware, utils (Pino logger, JWT, nanoid)
```

Key patterns:
- **Dependency injection** via constructor in services/controllers
- **Repository pattern** for data access (Mongoose queries isolated from business logic)
- **Strategy + Adapter** for AI providers: new provider = 1 file + registry entry in `provider.factory.ts`
- **Zod schemas** at request entry point for validation
- **JWT access + refresh** with token rotation and reuse detection (Argon2 hashed)

Adding a new AI provider:
1. Create adapter file in `providers/<category>/<provider-name>.adapter.ts`
2. Implement the category interface (e.g., `ImageGenerationProvider`)
3. Register in `provider.factory.ts` switch statement

### Frontend — Component + Store + Hooks Architecture

```
frontend/src/
├── config/                     # env.ts, constants, nodeRegistry, nodeTypes/edgeTypes maps
├── types/                      # TypeScript interfaces (node, workflow, api, socket, provider)
├── stores/                     # Zustand: workflow (nodes/edges/undo-redo), project, UI, media, notifications
├── hooks/                      # Custom hooks: socket, execution, upload, templates, projects, providers, shortcuts
├── api/                        # Axios client with interceptors, TanStack Query queries/ and mutations/
├── services/                   # Socket.io singleton, workflow serializer, node execution orchestrator
├── components/
│   ├── ui/                     # Reusable: Button, Input, Modal, Toast, etc. (variant/size props, cn() utility)
│   ├── layout/                 # AppLayout, Header, Sidebar
│   ├── workflow/               # Canvas, Toolbar, NodePalette (drag-and-drop)
│   ├── nodes/                  # BaseNode wrapper + 9 custom node types
│   ├── edges/                  # DataFlowEdge (animated)
│   ├── panels/                 # NodeConfig, Provider, ExecutionLog
│   ├── media/                  # Uploader, Preview, Gallery, Player
│   ├── templates/              # Browser, Card, SaveModal
│   └── projects/               # Dashboard, Card, Wizard
├── pages/                      # Lazy-loaded: Dashboard, Editor, Templates, Settings, NotFound
├── router/                     # React Router v6 with lazy imports
└── styles/                     # globals.css, reactflow.css, animations.css
```

Key patterns:
- **Zustand** for client state, **TanStack Query** for server state — never mix
- **React Flow nodeTypes/edgeTypes** defined OUTSIDE components (prevents re-render loops)
- **BaseNode** wrapper for shared node functionality (handles, status, config)
- **cn()** utility (clsx + tailwind-merge) for conditional styling
- **Dark mode** via Tailwind class strategy + Zustand theme store
- Path alias: `@/` maps to `src/`

## Node Pipeline (9 types)

```
scriptInput → scriptAnalyzer → characterExtractor → sceneSplitter (fan-out)
                                                        ↓
                                              imageGenerator → frameComposer → videoGenerator → videoCombiner → output
```

Scene splitter creates dynamic fan-out (scene count unknown at build time), handled by BullMQ FlowProducer child jobs.

## API Routes

```
POST   /api/v1/auth/register|login|refresh|logout
GET|PATCH /api/v1/users/me
PUT    /api/v1/users/me/providers|api-keys
CRUD   /api/v1/projects
CRUD   /api/v1/projects/:id/workflows
GET|POST /api/v1/workflow-templates, POST .../clone
POST|GET /api/v1/executions, POST .../pause|resume|cancel|retry
GET|POST|DELETE /api/v1/projects/:id/assets
POST   /api/v1/executions/:id/nodes/:nodeId/override|retry
POST   /api/v1/webhooks/:provider
GET    /api/v1/providers, GET .../:category/:provider/models
```

## WebSocket Events

```
Server → Client: execution:started|progress|completed|failed|paused|cancelled
                 node:queued|started|progress|completed|failed|retrying
                 asset:generated|uploaded
Client → Server: execution:subscribe|unsubscribe, project:subscribe|unsubscribe
```

## Environment Variables

### Backend (`.env`)
Required: `MONGODB_URI`, `JWT_ACCESS_SECRET` (min 32 chars), `JWT_REFRESH_SECRET` (min 32 chars)
Defaults exist for: `NODE_ENV=development`, `PORT=3001`, `HOST=0.0.0.0`, `MONGODB_DB_NAME=vdo_gen`, `REDIS_HOST=localhost`, `REDIS_PORT=6379`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d`, `RATE_LIMIT_MAX=100`, `RATE_LIMIT_WINDOW=1 minute`

### Frontend (`.env.local`)
All optional with defaults: `VITE_API_URL` (default: `http://localhost:8000/api`), `VITE_WS_URL` (default: `http://localhost:6001`), `VITE_APP_NAME` (default: `VDO Gen`)

## MongoDB Collections

`users`, `projects`, `workflows`, `workflow_executions`, `assets`, `webhook_events`

## Development Setup

1. `cd backend && docker compose up -d` (MongoDB + Redis)
2. Copy `.env.example` to `.env`, set JWT secrets (min 32 chars each)
3. `cd backend && npm install && npm run dev` (runs on port 3001)
4. `cd frontend && npm install && npm run dev` (runs on port 5173)

## Test Structure

```
backend/tests/
├── setup.ts              # MongoDB Memory Server + Redis mock (used by integration/e2e)
├── helpers/              # Test factories, mock providers, request helpers
├── unit/                 # Pure unit tests (no DB/Redis, use vitest.unit.config.ts)
├── integration/          # Service/repository tests with MongoDB Memory Server
└── e2e/                  # Full API tests via supertest
```

## Conventions

- Both packages use ESM (`"type": "module"`)
- Both use `@/` path alias (tsconfig paths)
- Backend: strict TypeScript, Zod for validation, Pino for logging
- Frontend: strict TypeScript, ESLint with react-hooks + react-refresh plugins
- Error hierarchy: `AppError` → `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`
- Session docs in `docs/backend/` and `docs/frontend/` track incremental build decisions
