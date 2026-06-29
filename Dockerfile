# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY sqlive-frontend/package.json sqlive-frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY sqlive-frontend/ ./
RUN npm run build

# Stage 2: Build backend JAR with frontend static files
FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app
COPY sqlive-backend/ ./
RUN chmod +x gradlew
# Copy frontend dist into Spring Boot static resources
COPY --from=frontend /app/frontend/dist/ ./src/main/resources/static/
RUN ./gradlew bootJar --no-daemon -x test

# Stage 3: Runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
