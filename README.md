# VDO Gen

AI video generation workflow platform. Build video production pipelines via a visual node-based editor, connecting text analysis, image generation, and video generation nodes from multiple AI providers.

## Features

- **Visual Workflow Editor** — Drag-and-drop node-based canvas powered by React Flow
- **9-Node Pipeline** — Script input through to final video output with automatic scene fan-out
- **Multi-Provider AI** — 12+ AI providers across text analysis, image generation, and video generation
- **Real-Time Execution** — WebSocket-based live progress updates per node and execution
- **Job Queue** — BullMQ-powered DAG execution with FlowProducer for parallel scene processing
- **Template System** — Save, browse, and clone workflow templates
- **Asset Management** — Upload, preview, and manage media assets per project
- **Dark Mode** — Full dark theme support via Tailwind CSS class strategy
- **Undo/Redo** — Workflow canvas state history

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Node.js 20+, TypeScript 5.7, Fastify 5, Mongoose 8 (MongoDB 7), BullMQ (Redis 7), Socket.io, Zod, Pino, Vitest |
| **Frontend** | React 19.2, TypeScript 5.9, Vite 7, React Flow 12, Zustand 5, React Router 7, TanStack Query 5, Tailwind CSS 4, Lucide |
| **Infrastructure** | Docker Compose (MongoDB + Redis), local filesystem storage (S3 interface stub) |

## Architecture

### Backend — Modular Layered Architecture

```
backend/src/
├── index.ts                  # Entry: async main, graceful shutdown
├── app.ts                    # Fastify factory: CORS, Helmet, rate-limit, routes
├── config/                   # Zod-validated env vars, DB/Redis/storage connections
├── modules/                  # Feature modules (auth, users, projects, workflows, nodes, assets, webhooks)
├── providers/                # AI provider adapters (Strategy + Adapter pattern)
├── engine/                   # DAG resolver, workflow executor, execution context
├── queue/                    # BullMQ: queue manager, per-category workers, FlowProducer DAG
├── storage/                  # Storage interface + local adapter
├── realtime/                 # Socket.io: JWT-authenticated rooms per execution
└── common/                   # Error classes, middleware, utils (Pino logger, JWT, nanoid)
```

Key patterns: dependency injection via constructor, repository pattern for data access, Strategy + Adapter for AI providers, Zod schemas for validation, JWT access + refresh with token rotation.

### Frontend — Component + Store + Hooks

```
frontend/src/
├── config/                   # env, constants, nodeRegistry, nodeTypes/edgeTypes maps
├── types/                    # TypeScript interfaces
├── stores/                   # Zustand: workflow (nodes/edges/undo-redo), project, UI, media, notifications
├── hooks/                    # Custom hooks: socket, execution, upload, templates, providers, shortcuts
├── api/                      # Axios client with interceptors, TanStack Query queries & mutations
├── services/                 # Socket.io singleton, workflow serializer, node execution orchestrator
├── components/               # UI, layout, workflow, nodes, edges, panels, media, templates, projects
├── pages/                    # Lazy-loaded: Dashboard, Editor, Templates, Settings, NotFound
├── router/                   # React Router v6 with lazy imports
└── styles/                   # globals.css, reactflow.css, animations.css
```

Key patterns: Zustand for client state, TanStack Query for server state, React Flow nodeTypes/edgeTypes defined outside components, BaseNode wrapper for shared node functionality, `cn()` utility (clsx + tailwind-merge).

## Node Pipeline

```
scriptInput → scriptAnalyzer → characterExtractor → sceneSplitter (fan-out)
                                                        ↓
                                              imageGenerator → frameComposer → videoGenerator → videoCombiner → output
```

The scene splitter creates dynamic fan-out (scene count unknown at build time), handled by BullMQ FlowProducer child jobs.

## Supported AI Providers

| Category | Providers |
|----------|-----------|
| **Text Analysis** | OpenAI, Anthropic |
| **Image Generation** | FAL AI, Stability AI, DALL-E, Ideogram, KIE AI |
| **Video Generation** | Runway, Kling, Pika, Luma |

## Prerequisites

- **Node.js** 20+
- **Docker** and Docker Compose
- **npm** (comes with Node.js)

## Getting Started

### 1. Start infrastructure

```bash
cd backend
docker compose up -d
```

This starts MongoDB 7 (port 27017) and Redis 7 (port 6379).

### 2. Configure backend environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set the required JWT secrets (minimum 32 characters each):

```
JWT_ACCESS_SECRET=your-access-secret-min-32-chars-long
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-long
```

### 3. Start backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`.

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:6200`.

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default |
|----------|----------|---------|
| `MONGODB_URI` | Yes | — |
| `JWT_ACCESS_SECRET` | Yes (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Yes (min 32 chars) | — |
| `NODE_ENV` | No | `development` |
| `PORT` | No | `3001` |
| `HOST` | No | `0.0.0.0` |
| `MONGODB_DB_NAME` | No | `vdo_gen` |
| `REDIS_HOST` | No | `localhost` |
| `REDIS_PORT` | No | `6379` |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` |
| `RATE_LIMIT_MAX` | No | `100` |
| `RATE_LIMIT_WINDOW` | No | `1 minute` |

### Frontend (`.env.local`)

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:8000/api` |
| `VITE_WS_URL` | `http://localhost:6001` |
| `VITE_APP_NAME` | `VDO Gen` |

## API Routes

```
POST   /api/v1/auth/register|login|refresh|logout
GET    /api/v1/users/me
PATCH  /api/v1/users/me
PUT    /api/v1/users/me/providers
PUT    /api/v1/users/me/api-keys

CRUD   /api/v1/projects
CRUD   /api/v1/projects/:id/workflows

GET    /api/v1/workflow-templates
POST   /api/v1/workflow-templates
POST   /api/v1/workflow-templates/:id/clone

POST   /api/v1/executions
GET    /api/v1/executions
POST   /api/v1/executions/:id/pause|resume|cancel|retry
POST   /api/v1/executions/:id/nodes/:nodeId/override|retry

GET    /api/v1/projects/:id/assets
POST   /api/v1/projects/:id/assets
DELETE /api/v1/projects/:id/assets/:assetId

GET    /api/v1/providers
GET    /api/v1/providers/:category/:provider/models

POST   /api/v1/webhooks/:provider
```

## WebSocket Events

### Server to Client

| Event | Description |
|-------|-------------|
| `execution:started` | Workflow execution began |
| `execution:progress` | Overall execution progress update |
| `execution:completed` | Workflow execution finished successfully |
| `execution:failed` | Workflow execution failed |
| `execution:paused` | Workflow execution paused |
| `execution:cancelled` | Workflow execution cancelled |
| `node:queued` | Node job queued |
| `node:started` | Node processing started |
| `node:progress` | Node processing progress |
| `node:completed` | Node processing completed |
| `node:failed` | Node processing failed |
| `node:retrying` | Node processing retrying |
| `asset:generated` | Asset generated by a node |
| `asset:uploaded` | Asset uploaded |

### Client to Server

| Event | Description |
|-------|-------------|
| `execution:subscribe` | Join execution room for live updates |
| `execution:unsubscribe` | Leave execution room |
| `project:subscribe` | Join project room |
| `project:unsubscribe` | Leave project room |

## Scripts

### Backend

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (nodemon + tsx, watches `src/**/*.ts`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server from `dist/` |
| `npm run typecheck` | Type check without emit |
| `npm test` | Run Vitest (single run) |
| `npm run test:watch` | Vitest in watch mode |

### Frontend

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |

## Testing

Tests are located in `backend/tests/`:

```
backend/tests/
├── setup.ts              # MongoDB Memory Server + Redis mock
├── helpers/              # Test factories, mock providers, request helpers
├── unit/                 # Pure unit tests (no DB/Redis)
├── integration/          # Service/repository tests with MongoDB Memory Server
└── e2e/                  # Full API tests via supertest
```

```bash
# Run all tests
cd backend && npm test

# Run unit tests only (no DB/Redis required)
cd backend && npx vitest --config vitest.unit.config.ts

# Run a specific test file
cd backend && npx vitest run tests/unit/foo.test.ts

# Watch mode
cd backend && npm run test:watch
```

## Adding a New AI Provider

1. Create an adapter file in `backend/src/providers/<category>/<provider-name>.adapter.ts`
2. Implement the category interface (e.g., `ImageGenerationProvider`)
3. Register in `provider.factory.ts` switch statement

## MongoDB Collections

`users`, `projects`, `workflows`, `workflow_executions`, `assets`, `webhook_events`
