<!-- generated-by: gsd-doc-writer -->

# Getting Started

## Prerequisites

Before you begin, ensure your system has the following installed:

| Tool | Version | Check Command |
|---|---|---|
| Java (JDK) | 21 (Zulu recommended) | `java -version` |
| Node.js | >= 18.0.0 | `node -v` |
| npm | >= 9.0.0 | `npm -v` |

The backend uses the Gradle Wrapper (`gradlew` / `gradlew.bat`), so you do not need to install Gradle separately. The wrapper downloads Gradle 9.2.1 automatically on first use.

**Ports:** The backend runs on port `8080` by default. The frontend dev server runs on port `5173`. Ensure these ports are available before starting.

**AI provider (optional):** If you plan to use AI features, you need an API key for the configured provider (DeepSeek by default). See the [Configuration](CONFIGURATION.md) docs for details.

## Installation steps

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd sqlive
   ```

2. **Install frontend dependencies:**

   ```bash
   cd sqlive-frontend
   npm install
   ```

3. **Verify the backend builds (optional, but recommended for first-time setup):**

   ```bash
   cd ../sqlive-backend

   # Windows
   gradlew.bat build

   # Linux / macOS
   ./gradlew build
   ```

   This step downloads Gradle, resolves Java dependencies, and compiles the backend. The `build` task also runs all backend tests. If any test fails, the build output will indicate the cause.

4. **Configure AI (optional):**

   If you want to use the AI assistant, set the environment variable for your provider. The default provider is DeepSeek:

   ```bash
   # Windows (Command Prompt)
   set DEEPSEEK_API_KEY=your-api-key

   # Windows (PowerShell)
   $env:DEEPSEEK_API_KEY = "your-api-key"

   # Linux / macOS
   export DEEPSEEK_API_KEY=your-api-key
   ```

   Alternatively, edit `sqlive-backend/src/main/resources/application.yml` and change `ai.provider` to use a different provider (`ollama`, `lmstudio`, or `openai-compatible`).

## First run

1. **Start the backend:**

   Open a terminal in the `sqlive-backend` directory:

   ```bash
   # Windows
   gradlew.bat bootRun

   # Linux / macOS
   ./gradlew bootRun
   ```

   You should see log output indicating the Spring Boot application has started. The backend is ready when you see:

   ```
   Started SqliveApplication in X.XXX seconds
   ```

   The API is available at `http://localhost:8080`. You can verify with:

   ```bash
   curl http://localhost:8080/actuator/health
   ```

2. **Start the frontend:**

   Open a second terminal in the `sqlive-frontend` directory:

   ```bash
   npm run dev
   ```

   The dev server starts with hot reload at `http://localhost:5173`. Vite automatically proxies `/api` requests to the backend on port `8080`.

3. **Open the app:**

   Navigate to `http://localhost:5173` in your browser. You should see the SQL editor on the left and the output panel on the right. Type some SQL and the result will render automatically after a 1-second debounce.

## Common setup issues

### Backend fails to start: wrong Java version

**Symptom:** `gradlew bootRun` fails with an error about an unsupported class file version or Java version mismatch.

**Cause:** The project requires JDK 21 as specified in `build.gradle` (`JavaLanguageVersion.of(21)`). An older JDK is on your `PATH`.

**Solution:** Install JDK 21 and point `JAVA_HOME` to it before running Gradle:

```bash
# Windows
set JAVA_HOME=C:\Program Files\Zulu\zulu-21

# Linux / macOS
export JAVA_HOME=/path/to/jdk-21
```

### Port 8080 or 5173 is already in use

**Symptom:** The backend fails with `Port 8080 was already in use`, or the frontend shows `Port 5173 is already in use`.

**Solution:** Free the port by stopping the process using it, or change the port:

- **Backend:** Add `server.port=8081` to `application.yml` under `spring:` and update `VITE_API_URL`, `VITE_AI_API_URL`, and `VITE_KNOWLEDGE_API_URL` in `sqlive-frontend/.env` to match.
- **Frontend:** Run `npm run dev -- --port 3000` to use a different port.

### AI features not working

**Symptom:** The app starts but AI chat returns errors or shows no response.

**Cause:** The `DEEPSEEK_API_KEY` environment variable is not set, or the configured AI provider is unreachable.

**Solution:** Set the `DEEPSEEK_API_KEY` environment variable (see step 4 of Installation). If you are not using DeepSeek, check that your selected provider in `application.yml` is running and accessible. If you only need the SQL execution features, you can ignore AI-related errors -- the core SQL playground works without any AI configuration.

### Frontend cannot reach backend API

**Symptom:** The frontend loads but the SQL editor shows network errors (e.g., "Failed to fetch" in the browser console).

**Cause:** The backend is not running or the Vite proxy cannot reach it.

**Solution:** Ensure the backend is running on `http://localhost:8080` before starting the frontend. The `.env` file in `sqlive-frontend/` configures API URLs to `localhost:8080`. If you changed the backend port, update the `.env` file accordingly.

## Next steps

- [Architecture](ARCHITECTURE.md) -- Understand the system design, data flow, and key abstractions.
- [Configuration](CONFIGURATION.md) -- Full reference for environment variables, `application.yml` settings, and per-environment overrides.
- `DEVELOPMENT.md` -- Branch conventions, PR process, code style, and local development setup (forthcoming).
- `TESTING.md` -- Test framework setup, running tests, coverage requirements, and CI integration (forthcoming).
- [README](/README.md) -- Project overview, feature list, tech stack, and usage examples.
