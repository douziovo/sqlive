# Roadmap: sqlive Tech Debt Cleanup

## Overview

14 tech debt items across 5 categories (Core Correctness, Infrastructure, AI Robustness, Frontend Quality, Security) organized into 4 phases. Phase 1 clears all independent backend fixes. Phase 2 unifies the parser layer and fixes data-layer correctness. Phase 3 makes frontend interactions robust (truncation warnings, ghost row, ER diagram, type safety). Phase 4 hardens SQL execution against filesystem access. Dependencies flow naturally: Phase 1 is standalone, Phase 2 unblocks Phase 3 via canonical statement positions, and Phase 4 is last as defense-in-depth on SqlExecutionService.

## Phases

- [x] **Phase 1: Backend Infrastructure** - Independent backend fixes: LRU eviction, rate-limit cleanup, AI timeouts, volatile fix, log sanitization, warning scoping (completed 2026-05-29)
- [x] **Phase 2: Parser Unification & Data Layer** - Canonical statement boundaries, FK-safe clearDatabase, unified dbName validation (completed 2026-05-29)
- [ ] **Phase 3: Frontend Reliability** - Truncation warnings, ghost row persistence, ER diagram position fix, emit type safety
- [x] **Phase 4: Security Hardening** - Disable ATTACH DATABASE and dangerous PRAGMAs (completed 2026-05-30)

## Phase Details

### Phase 1: Backend Infrastructure

**Goal**: Backend services no longer leak memory, hang on slow AI providers, or leak API keys in logs
**Depends on**: Nothing (first phase)
**Requirements**: CORE-03, INFRA-01, INFRA-02, AI-01, AI-02, SEC-02
**Success Criteria** (what must be TRUE):

  1. Database pool evicts least recently used sessions when capacity is exceeded -- user with many tabs sees the oldest idle session evicted first, not a random one
  2. Rate limit filter entries do not accumulate indefinitely -- ConcurrentHashMap stays bounded as time passes
  3. AI provider calls respect per-provider connect/read/write timeout configuration -- slow or unreachable providers produce graceful timeout errors instead of hanging indefinitely
  4. Server error logs for AI calls show `[REDACTED]` instead of raw Authorization headers -- no API key leakage in log output
  5. `@SuppressWarnings("SqlSourceToSinkFlow")` is scoped to the exact `stmt.execute()` call line, not the entire method -- verified by build output

**Plans**: 2 plans

Plans:

- [x] 01-01-PLAN.md — AI timeout config, volatile fix + refreshProviders, log sanitization
- [x] 01-02-PLAN.md — Warning scoping, LRU eviction, rate-limit cleanup

### Phase 2: Parser Unification & Data Layer

**Goal**: SQL parsing is consistent between frontend and backend, the API exposes canonical statement boundaries, and clearDatabase cannot corrupt concurrent sessions
**Depends on**: Phase 1
**Requirements**: CORE-04, CORE-01, CORE-02
**Success Criteria** (what must be TRUE):

  1. Backend `/api/execute` response includes `canonicalStatements` array with start/end character offsets for each parsed statement -- frontend can use backend-provided boundaries instead of its own parser
  2. Inline cell editing works correctly on scripts containing `BEGIN...END` blocks and `CASE...END` statements -- the correct VALUES tuple is found and the edit succeeds (previously failed silently)
  3. `clearDatabase()` drops tables in FK-dependency order (leaf-to-root) without toggling `PRAGMA foreign_keys` -- no FK enforcement race on concurrent reset+insert requests to the same database
  4. dbName validation uses identical strict regex `^[a-zA-Z0-9_-]{1,64}$` in both `SqlRequest` DTO and `DatabasePoolManager` -- invalid names produce consistent 4xx errors, not 500

**Plans**: TBD

### Phase 3: Frontend Reliability

**Goal**: Frontend interactions are robust -- no silent data loss on truncation or failed inserts, no ER diagram collapse, proper TypeScript types
**Depends on**: Phase 2
**Requirements**: FRONT-01, FRONT-02, FRONT-03, FRONT-04
**Success Criteria** (what must be TRUE):

  1. User edits a VARCHAR cell with a value exceeding the column length -- a toast/notification warns about truncation instead of silently truncating the input
  2. User submits a row insert that fails (constraint violation, FK violation, timeout) -- the ghost row stays visible with all input preserved, allowing correction and retry
  3. User navigates away from the ER diagram tab and back -- nodes maintain their dagre-computed positions instead of collapsing to `{x: 0, y: 0}`
  4. TypeScript compilation passes without `any` casts in `useInlineEdit`'s emit signature -- `TableSection.vue` consumers get type-checked event payloads

**Plans**: 3 plans
**UI hint**: yes

Plans:

- [ ] 03-01-PLAN.md -- Emit type safety (useInlineEdit generic) + ER diagram v-show tab fix
- [ ] 03-02-PLAN.md -- VARCHAR truncation detection and inline tooltip warning
- [ ] 03-03-PLAN.md -- Ghost row persistence on failed insert with failure styling

### Phase 4: Security Hardening

**Goal**: SQL injection via ATTACH DATABASE and dangerous PRAGMAs is blocked, preventing server filesystem access
**Depends on**: Phase 3
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):

  1. User submits SQL containing `ATTACH DATABASE` referencing a server file path -- the statement is rejected with a clear error; no filesystem access occurs
  2. User submits SQL containing dangerous PRAGMAs (`database_list`, `page_count`, etc.) -- safely handled without exposing server-side information
  3. The ATTACH/dangerous-PRAGMA blocking works at the `SqlExecutionService` level before SQLite executes the statement (not relying on SQLite authorizer alone)

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Add isBlockedStatement() and inject ATTACH/PRAGMA blocking in execute() loop

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Add ATTACH/PRAGMA blocking tests and regression tests

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Infrastructure | 2/2 | Complete    | 2026-05-29 |
| 2. Parser Unification & Data Layer | 2/2 | Complete    | 2026-05-29 |
| 3. Frontend Reliability | 0/3 | Not started | - |
| 4. Security Hardening | 2/2 | Complete    | 2026-05-30 |
