<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide walks you through setting up SQLive for local development. By the end, you will have a running instance with the frontend dev server connected to the backend API.

---

## Prerequisites

| Dependency | Required Version | Notes |
|---|---|---|
| JDK | 21 (Zulu JDK 21 recommended) | Set `JAVA_HOME` to the JDK 21 installation path. |
| Gradle | 9.2.1 | Auto-downloaded by the Gradle wrapper -- no manual installation needed. |
| Node.js | 18+ | Check with `node --version`. |
| npm | 9+ | Ships with Node.js; check with `npm --version`. |

**Windows users:** The project is developed on Windows 11 with `C:\Program Files\Zulu\zulu-21\bin\` as the JDK path. Adjust `JAVA_HOME` if using a different JDK distribution.

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd sqlive
```

### 2. Start the backend

The backend is a Spring Boot 4 application located in `sqlive-backend/`. The Gradle wrapper (`gradlew` / `gradlew.bat`) handles dependency resolution and compilation automatically.

```bash
cd sqlive-backend

# Windows
set JAVA_HOME=C:\Program Files\Zulu\zulu-21
gradlew.bat bootRun

# Linux / macOS
./gradlew bootRun
```

The first build downloads Gradle 9.2.1 and all Maven dependencies (Aliyun mirror configured in `build.gradle`). Subsequent starts are faster.

The backend starts on `http://localhost:8080`. Verify with:

```bash
curl http://localhost:8080/actuator/health
```

Expected response: `{"status":"UP"}`

### 3. Install frontend dependencies

Open a separate terminal:

```bash
cd sqlive-frontend
npm install
```

### 4. Start the frontend

```bash
npm run dev
```

The Vite dev server starts on `http://localhost:5173`. During development, all `/api/*` requests are automatically proxied to the backend at `http://localhost:8080`.

---

## First Run

1. Open `http://localhost:5173` in your browser.
2. You should see the SQLive interface: a Monaco code editor on the left and an empty right panel.
3. Paste the following SQL into the editor:

```sql
CREATE TABLE hello (id INTEGER PRIMARY KEY, msg TEXT);
INSERT INTO hello VALUES (1, 'Hello, SQLive!');
SELECT * FROM hello;
```

4. Wait 1 second (the auto-execute debounce). The right panel renders a table named `hello` with one row and two columns.

If the table appears, the setup is complete. The ER diagram tab, metadata tab, and all data-visualization features are functional at this point.

---

## Common Setup Issues

### JAVA_HOME not set to JDK 21

The backend build requires JDK 21. If `JAVA_HOME` points to an older JDK, the build fails with a toolchain error.

**Solution:** Set `JAVA_HOME` to your JDK 21 installation:

```bash
# Windows
set JAVA_HOME=C:\Program Files\Zulu\zulu-21

# Linux / macOS
export JAVA_HOME=/path/to/jdk-21
```

To verify: `java -version` should show `21` (or `21.0.x`).

### Port conflict (8080 or 5173 already in use)

If another process is running on port 8080 (backend) or 5173 (frontend), startup fails with an address-in-use error.

**Solution (backend):** Edit `application.yml` or pass `--server.port=8081`:

```bash
./gradlew bootRun --args='--server.port=8081'
```

**Solution (frontend):** Vite auto-picks the next available port and displays it in the terminal output. If you need a specific port:

```bash
npx vite --host --port 5174
```

After changing the backend port, update `sqlive-frontend/.env` to match:

```
VITE_API_URL=http://localhost:8081/api/execute
VITE_AI_API_URL=http://localhost:8081/api/ai
VITE_KNOWLEDGE_API_URL=http://localhost:8081/api/knowledge
```

### DEEPSEEK_API_KEY not set

The default AI provider is DeepSeek. If `DEEPSEEK_API_KEY` is not set, AI chat features (the chat panel, error analysis, code explanation, performance optimization) return errors. SQL execution and data visualization work without any API key.

**Solution:** Either set the environment variable:

```bash
# Windows
set DEEPSEEK_API_KEY=sk-your-key-here

# Linux / macOS
export DEEPSEEK_API_KEY=sk-your-key-here
```

Or switch to a local AI provider by editing `sqlive-backend/src/main/resources/application.yml`:

```yaml
ai:
  provider: ollama    # or lmstudio / openai-compatible
```

See CONFIGURATION.md for all AI provider options.

### Frontend .env uses direct backend URL instead of proxy

The file `sqlive-frontend/.env` sets `VITE_API_URL` to `http://localhost:8080/api/execute` (the direct URL). During development, this works fine since the backend is on 8080 and CORS is preconfigured for `localhost:*`. If you prefer to use Vite's dev proxy (no CORS involvement), delete or comment out the `.env` file -- the frontend falls back to `/api/execute`.

---

## Next Steps

- **README.md** -- Feature overview, usage examples, project structure.
- **ARCHITECTURE.md** -- System architecture, component diagram, data flow.
- **CONFIGURATION.md** -- All environment variables, backend settings, AI provider configuration.
