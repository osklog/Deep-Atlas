# Deep Dive Atlas — Evidence-Based Smoke Test Results

Generated: 2026-03-11T22:05Z

## 1. Test Fixtures Created

| Fixture | Location | Purpose |
|---------|----------|---------|
| `short-note.txt` (370B) | `api-server/src/__tests__/fixtures/` | Plain text — quantum entanglement notes |
| `research-notes.md` (1363B) | same | Markdown — transformer architecture research |
| `messy-contradictions.txt` (1468B) | same | Contradictory nutrition claims — tests ambiguity handling |
| `unicode-heavy.txt` (1333B) | same | 6 languages (CJK, Cyrillic, Greek, Arabic, Korean, Latin) + emoji |
| `sample.pdf` (717B) | same | Minimal valid PDF with extractable text |
| `corrupt.pdf` (83B) | same | Invalid PDF — not a real PDF, used for error path testing |
| `image-payload.json` (190B) | same | 1x1 PNG base64 image payload for import testing |
| `test-image.png` (70B) | same | Raw 1x1 PNG for reference |

All fixtures are committed to the repo and used by automated tests.

## 2. Import Route — Proven with Real Fixtures

### Automated tests (9 tests, all pass)

| Test | Fixture | Result |
|------|---------|--------|
| Text import — content reaches AI prompt | `short-note.txt` | PASS — AI receives file content with "Quantum entanglement" text |
| Markdown import — structure preserved | `research-notes.md` | PASS — AI receives "Vaswani", "Self-Attention" |
| Contradictory text import | `messy-contradictions.txt` | PASS — AI receives full contradictory text |
| Unicode import — round-trip survival | `unicode-heavy.txt` | PASS — 6 languages preserved: Ελληνικά, 한국어, etc. |
| Corrupt PDF rejected | `corrupt.pdf` | PASS — returns 400, AI never called |
| Valid PDF text extracted | `sample.pdf` | PASS — PDF part labeled `[PDF: sample.pdf]` sent to AI |
| Image sent as image_url | `image-payload.json` | PASS — `data:image/png;base64,...` sent to AI, `[Image file: test-image.png]` label added |
| Unsupported type rejected | (inline .zip) | PASS — returns 400 "No readable content" |
| Mixed valid + corrupt files | `corrupt.pdf` + `short-note.txt` | PASS — corrupt skipped, text processed, skipped array contains "corrupt.pdf (could not extract text)" |

### Live server curl tests

```
# Health check
$ curl -s http://localhost:8080/api/healthz
{"status":"ok"}

# No files → 400
$ curl -s -X POST http://localhost:8080/api/atlas/import -H "Content-Type: application/json" -d '{"files":[]}'
{"error":"No files provided"}   HTTP_STATUS: 400

# Too short text → 400
$ curl -X POST ... -d '{"files":[{"name":"tiny.txt","mimeType":"text/plain","content":"hi","isBase64":false}]}'
{"error":"No readable content found in uploaded files"}   HTTP_STATUS: 400

# Unsupported type → 400
$ curl -X POST ... -d '{"files":[{"name":"test.zip","mimeType":"application/zip","content":"abc123","isBase64":true}]}'
{"error":"No readable content found in uploaded files"}   HTTP_STATUS: 400

# Valid text file → 200 with real AI response
$ curl -X POST ... -d '{"files":[{"name":"short-note.txt","mimeType":"text/plain","content":"<fixture content>","isBase64":false}]}'
HTTP_STATUS: 200
Result: 19 nodes, 20 edges
Title: "Entanglement's Infinite Threads"
Node types used: concept, source, person, quote, event, question, media
Edge labels: validated by, challenged by, enables, supports, expands into
Skipped: []
```

Full response saved to: `verification/sample-import-results/04-valid-txt.txt`

## 3. Component Logic Tests

Full React Native component rendering is **not possible** in this environment — here is the exact technical reason:

- React Native components require a native runtime (iOS/Android) or the React Native Testing Library's Jest-based renderer
- Vitest does not support `react-native` JSX rendering — it lacks the native module bridge and the `react-test-renderer` integration that RNTL provides via Jest
- We removed `@testing-library/react-native` and `@testing-library/jest-native` because they require Jest (not Vitest) and a React Native environment that doesn't exist in this Node.js container

**What we built instead**: 30 tests covering all extractable component logic:

### EdgeForm logic (7 tests)
- `computeEffectiveLabel`: defaults to "related to", uses selected, custom overrides selected, whitespace-only fallback
- SUGGESTED_LABELS: all 23 are non-empty, no duplicates
- Effective label always non-empty for all input combinations

### NodeForm logic (9 tests)
- `handleSave`: rejects empty title, trims title+note, preserves imageUri, works for all 9 types
- `addTag`: deduplicates, lowercases, ignores empty
- `removeTag`: filters correctly, no-op for missing tags
- All NODE_TYPES have labels and icons

### Import screen logic (8 tests)
- `isImageMime`: identifies 7 image types, case-insensitive, rejects non-images
- `isPdfMime`: identifies PDF, case-insensitive
- `dedup`: removes URI duplicates, preserves first-occurrence order
- `formatSize`: formats bytes/KB/MB correctly, handles undefined/0
- Stage transitions: pick → reading → importing → pick

### Atlas list logic (3 tests)
- Subtitle: "Your knowledge maps" for 0, "1 knowledge map" for 1, "5 knowledge maps" for 5

### sanitizeFilename (5 tests)
- Replaces spaces with underscores, strips special chars, strips unicode, truncates to 60 chars, returns "atlas" for empty result

## 4. SSE Streaming — Proven Concretely

### Direct SSE server test (8 tests, all pass)
Created a real Express SSE server in tests, streamed via raw `node:http`, parsed actual `data:` lines.

| Test | Result |
|------|--------|
| Multiple content chunks + done event | PASS — 5 words streamed, done event received, full text = "The transformer architecture is powerful." |
| Error event | PASS — `{"error":"Generation failed"}` received |
| Correct SSE headers | PASS — Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive |
| Single word stream | PASS — 1 content event + done event |
| Empty deltas filtered | PASS — only non-empty content forwarded |
| Raw format correct | PASS — `data: {"content":"X"}\n\n` format verified |
| 20 chunks without data loss | PASS — all 20 words received in order |
| Empty words → only done | PASS — 0 content events, 1 done event |

### SSE client consumption test (4 tests, all pass)
`apiStream()` function tested against a real local HTTP server — not mocked fetch.

| Test | Result |
|------|--------|
| Receives streamed chunks | PASS — ["First ", "chunk. ", "Final chunk."] received in order |
| Server error → onError | PASS — 500 response triggers "Failed to connect" |
| Interleaved comments + events | PASS — SSE comments filtered, only data: events parsed |
| Delayed chunks (20ms intervals) | PASS — ["Slow ", "stream ", "works."] received correctly |

### SSE route integration (2 tests, all pass)
Verified the `/api/atlas/generate` route calls OpenAI with correct parameters:
- Model: `gpt-4o`, max_tokens: 4096, stream: true
- All 4 mode prompts contain correct keywords (synthesizer/accessible/provocateur/contradictions)

### Live SSE — Not Verifiable
The live server's SSE endpoint returns `Content-Length: 0`. The Replit AI Integrations proxy does not appear to support OpenAI streaming mode (`stream: true`). Non-streaming import works (proven with real 19-node response). The SSE transport itself is proven via 14 tests using real HTTP servers.

## 5. Export — Proven with Actual Outputs

### Files generated
- `verification/sample-exports/proof-atlas.json` (5883 bytes)
- `verification/sample-exports/proof-atlas.md` (2623 bytes)

### JSON export verification
- Valid JSON: parses without error
- 11 nodes, 8 edges, all fields preserved
- Round-trips 2x without data loss: `JSON.stringify(JSON.parse(JSON.parse(JSON.stringify(atlas)))) === original`
- Unicode survives: `Über-Verschränkung (超纠缠)`, tag `物理学`, Greek `Ελληνικά`, Japanese `量子`
- Special characters in quotes: `"Nature isn't classical, dammit..."`
- Size: 5883 bytes (not empty, not bloated)

### Markdown export verification
- Title: `# Quantum Computing & Cryptography`
- Stats: `**11 nodes** | **8 connections**`
- All 9 node types present: Concept (3), Person (1), Company (1), Source (1), Question (1), Event (1), Hypothesis (1), Quote (1), Media (1)
- Connections section: `**Quantum Entanglement** → *enables* → **Shor's Algorithm**`
- Tags: `#physics`, `#物理学`
- Unicode: `Über-Verschränkung (超纠缠)`, `Ελληνικά: κβαντική`, `日本語: 量子`
- Readable as standalone document

### Filename sanitization
- `"Quantum Computing & Cryptography"` → `"Quantum_Computing_Cryptography"` (31 chars, ≤60, no special chars)
- Empty/special-char-only → `"atlas"` fallback

## 6. Dependencies Cleaned

### Removed (unused)
- `@testing-library/react-native@^13.3.3` — never imported in any test file
- `@testing-library/jest-native@^5.4.3` — never imported in any test file
- 17 transitive packages removed

### Kept (actively used)
- `vitest@^4.0.18` — test runner (both packages)
- `supertest@^7.2.2` — HTTP integration tests (api-server)
- `@types/supertest@^7.2.0` — TypeScript types for supertest

## 7. Full Test Count

| Package | Files | Tests | Status |
|---------|-------|-------|--------|
| api-server | 5 | 56 | ALL PASS |
| mobile | 8 | 152 | ALL PASS |
| **Total** | **13** | **208** | **ALL PASS** |

### Test file breakdown

**API Server (56 tests)**
- `health.test.ts` — 1 test
- `json-extract.test.ts` — 16 tests (stripCodeFences, extractJSON)
- `routes.test.ts` — 20 tests (import + generate routes, original test suite)
- `fixtures-import.test.ts` — 9 tests (real fixture files)
- `sse-streaming.test.ts` — 10 tests (direct SSE server + route integration)

**Mobile (152 tests)**
- `schemas.test.ts` — 27 tests
- `storage.test.ts` — 38 tests
- `export.test.ts` — 15 tests
- `export-proof.test.ts` — 5 tests (generates actual export files)
- `api.test.ts` — 12 tests
- `layout.test.ts` — 21 tests
- `component-logic.test.ts` — 30 tests (EdgeForm, NodeForm, import screen, atlas list logic)
- `sse-client.test.ts` — 4 tests (apiStream against real local SSE server)

## 8. Remaining Unverified Items

1. **Live SSE streaming end-to-end**: The Replit AI Integrations proxy returns empty body for `stream: true` OpenAI calls. The SSE transport is proven via 14 automated tests. The actual AI streaming would need a direct OpenAI API key or a proxy that supports streaming.

2. **React Native component rendering**: Cannot render JSX components in Vitest/Node.js. All testable logic is extracted and tested (30 tests). Visual rendering requires Expo Go on a device.

3. **PDF extraction with real pdf-parse**: The `pdf-parse` module is mocked in tests. The live import route works (proven via curl), but PDF-specific extraction depends on pdf-parse's behavior with real PDFs. The mock verifies the integration contract.

4. **PNG export**: Not implemented in the app. Export supports JSON and Markdown only.

5. **On-device user flows**: File picking, image picking, haptic feedback, share sheet — these require native device APIs not available in a Node.js container.
