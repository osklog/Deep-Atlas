# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Includes an Express API server and a React Native (Expo) mobile app — **Deep Dive Atlas**.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (SDK 54) + Expo Router

## Deep Dive Atlas — App Overview

A mobile-first knowledge graph app for mapping rabbit holes and deep dives. Users create atlases, add typed nodes, connect them with labeled relationships, attach images, and generate AI insights.

### Features
- Atlas list / home screen
- Create/edit atlases with color picker
- Node creation/editing (9 types: concept, person, company, source, question, event, hypothesis, quote, media)
- Custom edge labels — any string via free-text input + 23 suggested labels (supports, contradicts, enables, operationalises, etc.)
- Draggable, pinch-to-zoom map canvas with fit-to-view and auto-layout
- Node detail view with connections
- Local persistence via AsyncStorage with Zod-validated storage and migration system (v2)
- Search across atlases and nodes
- AI summary, explanation, next questions, gaps generation via OpenAI (streaming SSE)
- Image attachments on nodes
- PDF import — server-side text extraction via `pdf-parse`
- JSON and Markdown export with system share sheet
- Copy AI insights to clipboard

### Key Libraries (Mobile)
- `expo-sharing` — file sharing
- `expo-clipboard` — copy text
- `expo-file-system` — file read/write (import from `expo-file-system/legacy`)
- `expo-document-picker` — file selection
- `expo-image-picker` — photo selection
- `expo-image-manipulator` — image resize/compress

### AI Integration
Uses Replit AI Integrations (OpenAI, model: `gpt-4o`, `max_tokens: 4096`).
- Import: `POST /api/atlas/import` — multimodal (text + images + PDFs), returns JSON atlas
- Generate: `POST /api/atlas/generate` — SSE streaming insights
- Backend uses `safeWriteSSE` pattern with client disconnect detection

### Data Architecture
- Zod schemas in `types/atlas.ts` for Atlas, AtlasNode, AtlasEdge
- Edge labels are free-form strings (not a fixed union)
- SUGGESTED_LABELS provides 23 common relationship labels
- Storage v2 includes migration from legacy format
- Import response validated with `ImportResponseSchema`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   │   └── src/routes/atlas.ts  # AI generate + import endpoints
│   └── mobile/             # Expo React Native app
│       ├── app/
│       │   ├── (tabs)/     # Home (atlas list) + Search tabs
│       │   ├── atlas/[id].tsx   # Atlas map view (fit-to-view, export, auto-layout)
│       │   ├── atlas/import.tsx # File import (text, images, PDFs)
│       │   └── atlas/[id]/      # node-form, edge-form, node-detail, ai-generate
│       ├── components/     # AtlasCard, MapView (forwardRef), NodeForm, EdgeForm
│       ├── constants/colors.ts  # Dark theme palette
│       ├── lib/api.ts      # Centralized API client (apiPost, apiStream)
│       ├── lib/export.ts   # JSON/Markdown export + share
│       ├── storage/atlasStorage.ts  # AsyncStorage CRUD with Zod migration
│       └── types/atlas.ts  # Zod schemas + TypeScript types
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI client wrapper
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Color Palette (Dark Mode)

- Background: `#0A0C10` (deepest), `#0E1117` (deep), `#141820` (card)
- Accent: `#C9A96E` (gold/amber)
- Text: `#EDF0F5` (primary), `#8A95A8` (secondary), `#4E5A6E` (muted)
- Node colors: concept (blue), person (orange), company (teal), source (purple), question (yellow), event (red), hypothesis (green), quote (pink), media (light blue)

## API URL Pattern

`https://${EXPO_PUBLIC_DOMAIN}/api` — no `/api-server/` prefix. Centralized in `lib/api.ts`.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm run test` — runs all tests recursively across packages
- `pnpm run verify` — runs `typecheck && test` in sequence

## Testing Infrastructure

Uses **Vitest** for both API server and mobile tests.

### API Server Tests (`artifacts/api-server/src/__tests__/`)
- `health.test.ts` — health endpoint
- `json-extract.test.ts` — `stripCodeFences()` and `extractJSON()` utility tests
- `routes.test.ts` — import route (happy paths, malformed AI, code-fenced JSON, PDF, images, errors), generate route (SSE, mode prompts, error handling)
- Mocks: `@workspace/integrations-openai-ai-server` (OpenAI), `pdf-parse`

### Mobile Tests (`artifacts/mobile/__tests__/`)
- `schemas.test.ts` — Zod schema validation (AtlasNode, AtlasEdge, Atlas, ImportResponse), constants completeness
- `storage.test.ts` — CRUD operations, migration (v1→v2, corrupted data, partial objects), search, import-from-data, roundtrip integrity
- `export.test.ts` — JSON export shape, markdown formatting (grouped by type, connections, unicode)
- `api.test.ts` — apiPost (timeout, abort, errors), apiStream (SSE parsing, error handling, malformed data)
- `layout.test.ts` — auto-layout (radial positioning), fit-to-view bounds, center-on-node, edge curve geometry
- Mocks: `async-storage`, `expo-file-system`, `expo-sharing`, `expo-haptics`

### Per-Package Scripts
- `pnpm --filter @workspace/api-server run test` / `verify`
- `pnpm --filter @workspace/mobile run test` / `verify`
- `test:unit`, `test:integration`, `test:watch` available in both packages
