# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# We don't copy .env because of .dockerignore, build time secrets should be passed via --build-arg if needed
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js

# Expose port 8080 for Google Cloud Run
EXPOSE 8080

CMD ["node", "server.js"]