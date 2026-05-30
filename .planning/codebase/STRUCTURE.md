# Codebase Structure

**Analysis Date:** 2026-05-30

## Directory Layout

```
sqlive/
├── .cleanuprc.json                # Cleanup tool configuration
├── CLAUDE.md                      # Project instructions for Claude
├── README.md
├── test-multi-table.sql           # Test SQL fixture
├── .planning/                     # Planning documents (not committed)
│   └── codebase/                  # Codebase analysis documents
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONCERNS.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       └── INTEGRATIONS.md
│
├── sqlive-backend/                # Spring Boot Java backend
│   ├── build.gradle               # Gradle build (Spring Boot 4.0.6, JDK 21)
│   ├── settings.gradle
│   ├── gradlew / gradlew.bat      # Gradle wrapper
│   ├── gradle/wrapper/            # Gradle wrapper distribution
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/douzi/sqlive/
│   │   │   │   ├── SqliveApplication.java        # Spring Boot entry point
│   │   │   │   ├── config/                       # Framework configuration
│   │   │   │   │   ├── WebConfig.java            # CORS, filter registration, ObjectMapper
│   │   │   │   │   ├── RateLimitFilter.java      # Per-IP rate limiting servlet filter
│   │   │   │   │   └── AiProperties.java         # AI provider configuration binding
│   │   │   │   ├── controller/                   # REST endpoints
│   │   │   │   │   ├── SqlController.java        # POST /api/execute
│   │   │   │   │   ├── AiController.java         # POST /api/ai/* (chat, analyze, fix, etc.)
│   │   │   │   │   ├── KnowledgeController.java  # GET /api/knowledge/graph
│   │   │   │   │   └── HealthController.java     # GET /health
│   │   │   │   ├── dto/                          # Data transfer objects
│   │   │   │   │   ├── SqlRequest.java           # POST /api/execute request body
│   │   │   │   │   ├── SqlResponse.java          # SQL execution response + nested DTOs
│   │   │   │   │   ├── TableSchema.java          # Table metadata DTO
│   │   │   │   │   ├── IndexInfo.java            # Index metadata DTO
│   │   │   │   │   ├── ViewInfo.java             # View metadata DTO
│   │   │   │   │   ├── TriggerInfo.java          # Trigger metadata DTO
│   │   │   │   │   ├── ForeignKeyInfo.java       # Foreign key metadata DTO
│   │   │   │   │   ├── ExecutionMetadata.java    # Execution stats DTO
│   │   │   │   │   └── ai/                       # AI-specific DTOs
│   │   │   │   │       ├── AiChatRequest.java    # AI request body
│   │   │   │   │       ├── AiChatResponse.java   # AI response body
│   │   │   │   │       ├── AiProviderConfig.java # Provider config DTO
│   │   │   │   │       └── StreamChunk.java      # SSE stream chunk types
│   │   │   │   ├── exception/                    # Error handling
│   │   │   │   │   ├── GlobalExceptionHandler.java  # @ControllerAdvice
│   │   │   │   │   └── AiProviderException.java     # AI provider error
│   │   │   │   └── service/                      # Business logic
│   │   │   │       ├── SqlExecutionService.java  # Core SQL execution orchestration
│   │   │   │       ├── ai/                       # AI service layer
│   │   │   │       │   ├── AiService.java        # Prompt building, provider selection, response parsing
│   │   │   │       │   ├── AiProvider.java       # Provider interface
│   │   │   │       │   ├── OpenAiCompatibleProvider.java  # Generic HTTP client
│   │   │   │       │   ├── Protocol.java         # Request/response format interface
│   │   │   │       │   ├── DeepSeekProtocol.java  # DeepSeek format
│   │   │   │       │   ├── OllamaProtocol.java   # Ollama format
│   │   │   │       │   ├── LmStudioProtocol.java # LM Studio format
│   │   │   │       │   ├── OpenAiProtocol.java   # OpenAI format
│   │   │   │       │   └── PromptBuilder.java    # System prompt construction
│   │   │   │       ├── database/                 # Database connection management
│   │   │   │       │   └── DatabasePoolManager.java  # In-memory SQLite pool
│   │   │   │       ├── knowledge/                # Knowledge graph
│   │   │   │       │   └── KnowledgeGraphService.java  # Topic graph loader
│   │   │   │       ├── metadata/                 # Schema introspection
│   │   │   │       │   └── MetadataExtractor.java  # sqlite_master + PRAGMA queries
│   │   │   │       └── sql/                      # SQL parsing
│   │   │   │           └── SqlParser.java        # Statement boundary parser
│   │   │   └── resources/
│   │   │       ├── application.yml               # Spring Boot config
│   │   │       └── knowledge-graph.json          # Knowledge graph data
│   │   └── test/java/com/douzi/sqlive/           # Backend tests
│   │       ├── config/
│   │       ├── controller/
│   │       ├── exception/
│   │       └── service/
│   │           ├── ai/
│   │           ├── database/
│   │           ├── knowledge/
│   │           ├── metadata/
│   │           └── sql/
│   ├── build/                      # Compiled artifacts (gitignored)
│   └── logs/
│       └── sqlive.log              # Rolling log file
│
├── sqlive-frontend/                # Vue 3 + Vite frontend
│   ├── index.html                  # HTML entry point
│   ├── package.json                # NPM dependencies
│   ├── package-lock.json           # Lockfile
│   ├── vite.config.ts              # Vite build + vitest config
│   ├── tsconfig.json               # TypeScript root config (references)
│   ├── tsconfig.app.json           # TypeScript app config (strict: true)
│   ├── tsconfig.node.json          # TypeScript Node config
│   ├── biome.json                  # Linting/formatting (Biome 2.4.16)
│   ├── components.json             # Reka UI / shadcn-vue component registry
│   ├── .env                        # Environment variables (gitignored)
│   ├── src/
│   │   ├── main.ts                 # Vue app bootstrap
│   │   ├── App.vue                 # Root component
│   │   ├── config.ts               # API URL constants (VITE_API_URL, etc.)
│   │   ├── input.css               # Global CSS + Tailwind imports
│   │   ├── assets/
│   │   │   └── default-sql.ts      # Default SQL template
│   │   ├── components/             # Vue SFC components
│   │   │   ├── AiChatPanel.vue              # Floating AI chat panel
│   │   │   ├── AiMessageFooter.vue          # AI message metadata footer
│   │   │   ├── ChartView.vue                # ECharts wrapper
│   │   │   ├── CodeEditor.vue               # Monaco editor + tab bar + DB selector
│   │   │   ├── CreateTableModal.vue         # New table creation dialog
│   │   │   ├── DataVisualizer.vue           # Main data view (tabs + tables)
│   │   │   ├── EmptyState.vue               # Empty state placeholder
│   │   │   ├── HoverPreview.vue             # Hover preview popup
│   │   │   ├── ResultTable.vue              # Query result display
│   │   │   ├── SortFilterToolbar.vue        # Sort/filter controls
│   │   │   ├── TableSection.vue             # Individual table display + inline edit
│   │   │   ├── ai-elements/                 # AI chat UI primitives
│   │   │   │   ├── conversation/            # Conversation container components
│   │   │   │   ├── loader/                  # Loading indicator components
│   │   │   │   ├── message/                 # Message bubble components (content, actions, branches, avatars)
│   │   │   │   ├── prompt-input/            # Rich prompt input with commands, tabs, attachments
│   │   │   │   ├── reasoning/              # AI reasoning block components
│   │   │   │   ├── shimmer/                # Loading shimmer effect
│   │   │   │   └── suggestion/              # AI suggestion chips
│   │   │   ├── chart/                       # Chart visualization
│   │   │   │   ├── chartOptionBuilder.ts    # ECharts option generator
│   │   │   │   ├── chartTheme.ts            # Chart color theming
│   │   │   │   └── useECharts.ts            # ECharts composable
│   │   │   ├── er/                          # ER diagram
│   │   │   │   ├── ErDiagram.vue            # Main vue-flow ER diagram
│   │   │   │   ├── ErSearchBar.vue          # ER search bar
│   │   │   │   ├── ErTableNode.vue          # Custom table node component
│   │   │   │   └── ErToolbar.vue            # ER toolbar (zoom, layout)
│   │   │   ├── knowledge/                   # Knowledge graph
│   │   │   │   ├── KnowledgeGraph.vue       # Vue-flow knowledge graph
│   │   │   │   ├── KnowledgeNode.vue        # Topic node component
│   │   │   │   ├── KnowledgePanel.vue       # Knowledge panel wrapper
│   │   │   │   ├── KnowledgeDetail.vue      # Topic detail view
│   │   │   │   └── LearningCompanion.vue    # Learning companion widget
│   │   │   └── ui/                          # Reka UI v2 primitives
│   │   │       ├── avatar/                  # Avatar component
│   │   │       ├── button/                  # Button component
│   │   │       ├── button-group/            # Button group component
│   │   │       ├── collapsible/             # Collapsible panel
│   │   │       ├── command/                 # Command palette
│   │   │       ├── dialog/                  # Modal dialog
│   │   │       ├── dropdown-menu/           # Dropdown menu
│   │   │       ├── hover-card/              # Hover card
│   │   │       ├── input/                   # Input field
│   │   │       ├── input-group/             # Input group
│   │   │       ├── scroll-area/             # Scroll area
│   │   │       ├── select/                  # Select dropdown
│   │   │       ├── separator/               # Visual separator
│   │   │       ├── textarea/                # Text area
│   │   │       └── tooltip/                 # Tooltip
│   │   ├── composables/                     # Stateful logic (16 files)
│   │   │   ├── useSqlEngine.ts              # Central state machine
│   │   │   ├── useMultiTabs.ts              # Multi-tab management
│   │   │   ├── useBidirectionalSync.ts      # Cell-edit-to-SQL reverse engineering
│   │   │   ├── useAiChat.ts                 # AI chat state
│   │   │   ├── useAiStreaming.ts            # SSE streaming
│   │   │   ├── useInlineActions.ts          # Inline AI actions
│   │   │   ├── useErDiagram.ts              # ER diagram node/edge generation
│   │   │   ├── useDagreLayout.ts            # Dagre auto-layout
│   │   │   ├── useKnowledgeGraph.ts         # Knowledge graph state
│   │   │   ├── useHighlight.ts              # SQL-aware highlighting
│   │   │   ├── useDatabaseLifecycle.ts      # Named database lifecycle
│   │   │   ├── useMonacoEditor.ts           # Monaco editor control
│   │   │   ├── useSortFilter.ts             # Generic sort/filter/paginate
│   │   │   ├── useTablePipeline.ts          # Table-specific sort/filter
│   │   │   ├── useInlineEdit.ts             # Inline cell editing
│   │   │   └── useFilteredList.ts           # Generic list filter
│   │   ├── model/                           # TypeScript type definitions
│   │   │   ├── ApiTypes.ts                  # ExecuteRequest, ExecuteResponse types
│   │   │   ├── DatabaseTypes.ts             # DatabaseModel, TableSchema, Row, etc.
│   │   │   ├── SchemaTypes.ts               # SchemaTableInfo for AI context
│   │   │   └── injectionKeys.ts             # Vue provide/inject symbols
│   │   ├── utils/                           # Pure utility functions
│   │   │   ├── aiFormatter.ts               # AI response display formatting
│   │   │   ├── file.ts                      # File download utility
│   │   │   ├── html.ts                      # HTML sanitization
│   │   │   ├── sql.ts                       # SQL type helpers (toSqlLiteral, parsePrimaryType, isNumericType)
│   │   │   ├── sqlStatements.ts             # Client-side SQL parsing, comparison, tuple finding
│   │   │   ├── sse.ts                       # SSE stream reader (readSseStream)
│   │   │   └── tupleParser.ts               # VALUES tuple extraction with nested parenthesis depth
│   │   ├── types/                           # Third-party type declarations
│   │   │   └── monaco.d.ts                  # Monaco editor type augmentation
│   │   ├── lib/                             # Third-party integrations
│   │   │   └── utils.ts                     # General utility (shadcn-vue class merge)
│   │   └── __tests__/                       # Vitest unit tests
│   │       ├── setup.ts                     # Vitest setup (mocks, globals)
│   │       ├── test-utils.ts                # Shared test helpers
│   │       ├── App.test.ts                  # Root component test
│   │       ├── composables/                 # Composable tests
│   │       │   ├── useAiChat.test.ts
│   │       │   ├── useAiStreaming.test.ts
│   │       │   ├── useBidirectionalSync.test.ts
│   │       │   ├── useDagreLayout.test.ts
│   │       │   ├── useDatabaseLifecycle.test.ts
│   │       │   ├── useErDiagram.test.ts
│   │       │   ├── useHighlight.test.ts
│   │       │   ├── useInlineActions.test.ts
│   │       │   ├── useInlineEdit.test.ts
│   │       │   ├── useKnowledgeGraph.test.ts
│   │       │   ├── useMonacoEditor.test.ts
│   │       │   ├── useMultiTabs.test.ts
│   │       │   └── useSqlEngine.test.ts
│   │       ├── components/                  # Component tests
│   │       │   ├── AiChatPanel.test.ts
│   │       │   ├── ChartView.test.ts
│   │       │   ├── DataVisualizer.test.ts
│   │       │   ├── ErDiagram.test.ts
│   │       │   └── TableSection.test.ts
│   │       └── utils/                       # Utility tests
│   │           ├── sql.test.ts
│   │           ├── sqlStatements.test.ts
│   │           └── tupleParser.test.ts
│   └── tests/
│       └── e2e/                             # Playwright E2E tests
│           ├── fixtures/                    # E2E test fixtures
│           │   └── e2e-server.ts            # E2E backend mock server
│           └── specs/                       # E2E test specs
│               ├── ai-chat.spec.ts
│               ├── create-table.spec.ts
│               ├── er-diagram.spec.ts
│               ├── error-handling.spec.ts
│               └── table-editing.spec.ts
│
├── config/                                  # Root configuration files
├── docs/                                    # Documentation
│   ├── screenshots/
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── misc/                                    # Miscellaneous files
└── logs/                                    # Root application logs
```

## Directory Purposes

**`sqlive-backend/src/main/java/com/douzi/sqlive/` — Backend Java Source Root:**
- Purpose: All backend application code organized into standard Spring Boot packages
- Contains: 1 entry point, 4 controllers, 8 DTOs, 2 exception classes, 9 services/interfaces, 3 config classes
- Key files:
  - `SqliveApplication.java` — `@SpringBootApplication` entry point
  - `config/WebConfig.java` — CORS, `RateLimitFilter` registration, `ObjectMapper` bean
  - `config/RateLimitFilter.java` — Per-IP sliding-window rate limiter (servlet `Filter`)
  - `config/AiProperties.java` — `@ConfigurationProperties(prefix = "ai")`
  - `controller/SqlController.java` — `@RestController @RequestMapping("/api")`
  - `controller/AiController.java` — `@RestController @RequestMapping("/api/ai")`
  - `controller/KnowledgeController.java` — `@RestController @RequestMapping("/api/knowledge")`
  - `controller/HealthController.java` — `@RestController` with `GET /health`
  - `service/SqlExecutionService.java` — SQL execution orchestration with topological FK sort
  - `service/ai/AiService.java` — AI orchestration: provider selection, prompt building, response parsing
  - `service/ai/AiProvider.java` — Interface: `complete()` + `streamChat()`
  - `service/ai/Protocol.java` — Interface: `buildRequest()` + `processStream()`
  - `service/ai/PromptBuilder.java` — Builds system prompts per mode with schema context
  - `service/database/DatabasePoolManager.java` — `Collections.synchronizedMap`-backed SQLite pool
  - `service/metadata/MetadataExtractor.java` — Schema introspection queries
  - `service/sql/SqlParser.java` — Statement boundary parser with quote/BEGIN/CASE depth tracking
  - `service/knowledge/KnowledgeGraphService.java` — Loads `knowledge-graph.json`, serves topics
  - `exception/GlobalExceptionHandler.java` — `extends ResponseEntityExceptionHandler`

**`sqlive-backend/src/main/resources/` — Backend Resources:**
- Purpose: Application configuration and static data
- Contains: `application.yml` (Spring Boot config, logging, AI providers, datasource), `knowledge-graph.json` (topic data)

**`sqlive-backend/src/test/` — Backend Tests:**
- Purpose: JUnit 5 unit and integration tests
- Mirrors `src/main/` package structure exactly
- Contains: Test classes for controllers, services, configs, exceptions

**`sqlive-frontend/src/components/` — Vue Components:**
- Purpose: All Vue SFC components organized by domain
- Top-level components (8 files): Core UI panels (CodeEditor, DataVisualizer, TableSection, ResultTable, ChartView, AiChatPanel, etc.)
- `ai-elements/` (7 subdirectories, ~50+ files): AI chat UI primitives — conversation container, loader, message bubbles, prompt input (with commands/tabs/attachments/speech), reasoning blocks, shimmer, suggestion chips. Each subfolder has barrel `index.ts` + Vue SFCs + optionally `types.ts` / `context.ts`.
- `chart/` (3 files): `chartOptionBuilder.ts` (ECharts option configs), `chartTheme.ts` (color palette), `useECharts.ts` (reactive ECharts initialization)
- `er/` (4 files): `ErDiagram.vue` (vue-flow canvas), `ErTableNode.vue` (custom node), `ErSearchBar.vue`, `ErToolbar.vue`
- `knowledge/` (5 files): `KnowledgePanel.vue` (panel wrapper), `KnowledgeGraph.vue` (vue-flow), `KnowledgeNode.vue`, `KnowledgeDetail.vue`, `LearningCompanion.vue`
- `ui/` (14 subdirectories, ~50+ files): Reka UI v2 primitives — avatar, button, button-group, collapsible, command, dialog, dropdown-menu, hover-card, input, input-group, scroll-area, select, separator, textarea, tooltip. Each has barrel `index.ts` + SFC(s).

**`sqlive-frontend/src/composables/` — Composables (Stateful Logic):**
- Purpose: All 16 Vue 3 composable functions
- Key dependency chains:
  - `useSqlEngine` imports `useBidirectionalSync`, `useMultiTabs`, `useHighlight`, `useDatabaseLifecycle`
  - `useAiChat` imports `useAiStreaming`
  - `useInlineActions` imports from `useAiChat` (messages ref) and utility functions
- All composables are self-contained factory functions returning plain objects of refs and functions

**`sqlive-frontend/src/utils/` — Pure Utility Functions:**
- Purpose: Stateless, dependency-free pure functions
- `sqlStatements.ts` (2166 lines): Largest file — client-side SQL extraction, value comparison, type enforcement
- `tupleParser.ts`: VALUES tuple parsing with nested parenthesis support
- `sql.ts`: SQL type inference and literal generation
- `sse.ts`: `readSseStream()` — reads `Response` body as SSE event stream
- `aiFormatter.ts`: AI response display formatting
- `file.ts`: `downloadFile()` utility

**`sqlive-frontend/src/model/` — Type Definitions:**
- Purpose: Shared TypeScript types
- `ApiTypes.ts`: `ExecuteRequest`, `ExecuteResponse`, `ErrorPayload` — mirrors backend DTOs
- `DatabaseTypes.ts`: `DatabaseModel`, `TableSchema`, `Row`, `CellUpdateEvent`, `HighlightState`, `CanonicalStatement`
- `SchemaTypes.ts`: `SchemaTableInfo` for AI context
- `injectionKeys.ts`: `SQL_CONTEXT_KEY`, `AI_ACTIONS_KEY` — Vue `InjectionKey` symbols with typed interfaces

**`sqlive-frontend/src/__tests__/` — Unit Tests:**
- Purpose: Vitest unit tests mirroring source structure
- Subdirectories mirror `composables/`, `components/`, `utils/`
- `setup.ts`: Vitest globals, mock setup
- `test-utils.ts`: Shared test helpers and factories
- 14 composable test files, 5 component test files, 3 utility test files

**`sqlive-frontend/tests/e2e/` — E2E Tests:**
- Purpose: Playwright end-to-end tests
- 5 spec files covering: AI chat, create-table modal, ER diagram, error handling, table editing
- `fixtures/e2e-server.ts`: Mock backend server for E2E testing

## Key File Locations

**Entry Points:**
- `sqlive-frontend/index.html` — HTML shell, loads `src/main.ts`
- `sqlive-frontend/src/main.ts` — `createApp(App).mount('#app')`
- `sqlive-frontend/src/App.vue` — Root component (Splitpanes layout, composable orchestration, provide/inject)
- `sqlive-backend/.../SqliveApplication.java` — `SpringApplication.run(SqliveApplication.class, args)`

**Configuration:**
- `sqlive-frontend/vite.config.ts` — Vite build + dev server + vitest
- `sqlive-frontend/biome.json` — Biome 2.4.16 linting/formatting
- `sqlive-frontend/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — TypeScript config (`strict: true`)
- `sqlive-frontend/components.json` — Reka UI component registry
- `sqlive-frontend/package.json` — NPM dependencies and scripts
- `sqlive-backend/build.gradle` — Gradle build (Spring Boot 4.0.6, JDK 21, JaCoCo 50%)
- `sqlive-backend/settings.gradle` — Gradle settings
- `sqlive-backend/src/main/resources/application.yml` — Spring Boot config (logging, AI providers, datasource)

**Core Logic:**
- `sqlive-frontend/src/composables/useSqlEngine.ts` — Central SQL execution state machine
- `sqlive-frontend/src/composables/useBidirectionalSync.ts` — Cell-edit-to-SQL reverse engineering
- `sqlive-frontend/src/composables/useAiChat.ts` — AI chat state management
- `sqlive-frontend/src/composables/useMonacoEditor.ts` — Monaco editor creation and control
- `sqlive-frontend/src/utils/sqlStatements.ts` — Client-side SQL parsing (largest frontend file)
- `sqlive-frontend/src/utils/tupleParser.ts` — VALUES tuple extraction
- `sqlive-backend/.../service/SqlExecutionService.java` — SQL execution orchestration
- `sqlive-backend/.../service/ai/AiService.java` — AI orchestration
- `sqlive-backend/.../service/database/DatabasePoolManager.java` — SQLite connection pool
- `sqlive-backend/.../service/sql/SqlParser.java` — SQL statement parsing

**Testing:**
- `sqlive-frontend/src/__tests__/` — Vitest unit tests (19+ test files)
- `sqlive-frontend/tests/e2e/` — Playwright E2E tests (5 spec files)
- `sqlive-backend/src/test/` — JUnit 5 tests (JaCoCo coverage)

## Naming Conventions

**Files:**
- **Java:** PascalCase — `SqlExecutionService.java`, `GlobalExceptionHandler.java`
- **Vue SFC:** PascalCase — `CodeEditor.vue`, `DataVisualizer.vue`, `ErDiagram.vue`
- **TypeScript composables:** camelCase with `use` prefix — `useSqlEngine.ts`, `useAiChat.ts`
- **TypeScript utilities:** camelCase — `sqlStatements.ts`, `tupleParser.ts`, `sse.ts`
- **TypeScript model files:** PascalCase — `DatabaseTypes.ts`, `ApiTypes.ts`, `SchemaTypes.ts`
- **Config files:** kebab-case — `application.yml`, `vite.config.ts`, `tsconfig.app.json`

**Directories:**
- **Java packages:** Lowercase dotted — `com.douzi.sqlive.service.ai`
- **Vue component subdirectories:** kebab-case — `ai-elements/`, `chat/`, `er/`, `knowledge/`, `ui/`
- **UI primitive subdirectories:** kebab-case — `dropdown-menu/`, `hover-card/`, `scroll-area/`
- **AI element subdirectories:** kebab-case — `conversation/`, `loader/`, `message/`, `prompt-input/`, `reasoning/`, `shimmer/`, `suggestion/`

**Functions:**
- **JavaScript/TypeScript:** camelCase — `executeSqlRemote()`, `sendMessage()`, `rebuild()`, `beginReconcile()`
- **Java:** camelCase — `getOrCreateJdbcTemplate()`, `parseStatementsPrecise()`, `extractAllTables()`, `locateErrorLine()`

**Variables:**
- **JavaScript/TypeScript:** camelCase — `activeTabId`, `debouncedFilter`, `currentSchema`, `lastValidCode`
- **CSS classes:** kebab-case — `er-diagram-wrapper`, `knowledge-panel__topbar`, `animate-flash`

**Types:**
- **TypeScript interfaces/types:** PascalCase — `DatabaseModel`, `TableSchema`, `HighlightState`, `AiMessage`, `AiPanelMode`
- **Java classes:** PascalCase — `SqlRequest`, `SqlResponse`, `AiChatRequest`, `StreamChunk`, `ForeignKeyInfo`

## Where to Add New Code

**New Feature (Frontend):**
- Stateful logic: `sqlive-frontend/src/composables/` — create new `useFeature.ts` composable
- Component: `sqlive-frontend/src/components/` — create PascalCase `.vue` file or kebab-case subdirectory
- Types: `sqlive-frontend/src/model/` — extend existing or create new PascalCase type file
- Pure logic: `sqlive-frontend/src/utils/` — create new camelCase utility file
- Tests: `sqlive-frontend/src/__tests__/` — mirror source location in subdirectory
- E2E tests: `sqlive-frontend/tests/e2e/specs/` — create new `.spec.ts` file

**New Feature (Backend):**
- Controller: `sqlive-backend/.../controller/` — new `@RestController` class
- Service: `sqlive-backend/.../service/` (or sub-package) — new `@Service` class
- DTO: `sqlive-backend/.../dto/` (or `dto/ai/`) — new Lombok `@Data` POJO
- Config: `sqlive-backend/.../config/` — new `@Configuration` or `@ConfigurationProperties`
- Tests: `sqlive-backend/src/test/` — mirror source package structure

**New Component/Module (Frontend UI):**
- Main components: `sqlive-frontend/src/components/` — create kebab-case directory with Vue SFC + `index.ts`
- Reka UI primitives: `sqlive-frontend/src/components/ui/` — create kebab-case subdirectory
- AI primitives: `sqlive-frontend/src/components/ai-elements/` — create kebab-case subdirectory
- All UI subdirectories follow barrel export pattern: `index.ts` re-exports all variants

**New API Endpoint (Backend):**
- Add method to existing controller or create new controller under `controller/`
- Add DTO class under `dto/` if new request/response shape is needed
- Add service method under `service/` (or new service)
- Register in `WebConfig` CORS if needed (already covers `/api/**`)

**New AI Provider (Backend):**
- Implement `Protocol` interface: `sqlive-backend/.../service/ai/` (e.g., `ClaudeProtocol.java`)
- Add provider config in `application.yml` under `ai.providers`
- `OpenAiCompatibleProvider.create()` handles it generically — no code change needed unless the protocol differs from OpenAI-compatible

**Utilities:**
- Backend shared helpers: `sqlive-backend/.../service/` or new utility class
- Frontend shared helpers: `sqlive-frontend/src/utils/` (pure functions only, no state, no imports from composables)

## Special Directories

**`sqlive-frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (via `npm run build`)
- Committed: No (gitignored)

**`sqlive-backend/build/`:**
- Purpose: Gradle compiled artifacts and reports
- Generated: Yes (via `./gradlew build`)
- Committed: No (gitignored)

**`sqlive/.planning/`:**
- Purpose: GSD workflow planning and analysis documents
- Subdirectories: `codebase/` (maps), `phases/` (01-03), `research/`, `ui-reviews/`
- Generated: Yes (by `/gsd-map-codebase`, `/gsd-plan-phase`)
- Committed: No (by convention — see memory `feedback_no-plan-commits.md`)

**`sqlive-frontend/src/components/ai-elements/`:**
- Purpose: AI chat UI primitives (auto-generated by AI CLI tools)
- Structure: Each subfolder has `index.ts` barrel that re-exports the primary component
- Generated: Partially — core structural files are hand-written, Vue SFCs may be AI-generated
- Committed: Yes

**`sqlive-frontend/src/components/ui/`:**
- Purpose: Reka UI v2 primitive components (shadcn-vue style)
- Structure: Each subfolder has `index.ts` barrel that re-exports all component variants
- Generated: Partially (installed via CLI, may be customized)
- Committed: Yes

**`sqlive-backend/logs/`:**
- Purpose: Application log files (rolling policy)
- Generated: Yes (at runtime)
- Committed: No (gitignored)

**`sqlive-backend/src/main/resources/`:**
- Purpose: Non-code application resources
- Contains: `application.yml` (config), `knowledge-graph.json` (static data)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-30*
