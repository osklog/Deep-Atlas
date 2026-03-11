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
- Labeled connections (supports, contradicts, influenced by, raises, belongs to, etc.)
- Draggable, pinch-to-zoom map canvas
- Node detail view with connections
- Local persistence via AsyncStorage
- Search across atlases and nodes
- AI summary, explanation, next questions, gaps generation via OpenAI
- Image attachments on nodes

### AI Integration
Uses Replit AI Integrations (OpenAI) for atlas insight generation. The backend endpoint is `POST /api/atlas/generate` and streams responses via SSE.

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   │   └── src/routes/atlas.ts  # AI generate endpoint
│   └── mobile/             # Expo React Native app
│       ├── app/
│       │   ├── (tabs)/     # Home (atlas list) + Search tabs
│       │   ├── atlas/[id].tsx   # Atlas map view
│       │   └── atlas/[id]/      # node-form, edge-form, node-detail, ai-generate
│       ├── components/     # AtlasCard, MapView, NodeForm, EdgeForm
│       ├── constants/colors.ts  # Dark theme palette
│       ├── storage/atlasStorage.ts  # AsyncStorage CRUD
│       └── types/atlas.ts  # Node, Edge, Atlas types
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

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
