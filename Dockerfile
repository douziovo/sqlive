# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY sqlive-frontend/package.json sqlive-frontend/pnpm-lock.yaml sqlive-frontend/pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY sqlive-frontend/ ./
RUN pnpm run build

# Stage 2: Build backend JAR with frontend static files
FROM eclipse-temurin:25-jdk AS backend
WORKDIR /app
COPY sqlive-backend/ ./
# Copy frontend dist into Spring Boot static resources
COPY --from=frontend /app/frontend/dist/ ./src/main/resources/static/
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon -x test

# Stage 3: Runtime
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=backend /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "--enable-native-access=ALL-UNNAMED", "-jar", "app.jar"]
