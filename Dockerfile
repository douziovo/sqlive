# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY sqlive-frontend/package.json sqlive-frontend/pnpm-lock.yaml sqlive-frontend/pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY sqlive-frontend/ ./
RUN pnpm run build

# Stage 2: Build backend JAR with frontend static files
FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app
# Gradle wrapper JAR not in git — download Gradle 9.6.0 directly
RUN apt-get update && apt-get install -y --no-install-recommends unzip wget && \
    rm -rf /var/lib/apt/lists/* && \
    wget -q https://services.gradle.org/distributions/gradle-9.6.0-bin.zip -O /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    rm /tmp/gradle.zip
ENV PATH="/opt/gradle-9.6.0/bin:$PATH"
COPY sqlive-backend/ ./
# Copy frontend dist into Spring Boot static resources
COPY --from=frontend /app/frontend/dist/ ./src/main/resources/static/
RUN gradle bootJar --no-daemon -x test

# Stage 3: Runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
