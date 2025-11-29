# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for API URL (needed at build time for Next.js)
ARG NEXT_PUBLIC_API_URL=https://potatoes-backend.fly.dev/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy standalone server files
COPY --from=builder /app/.next/standalone ./

# Copy static files
COPY --from=builder /app/.next/static ./.next/static

# Copy public files
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "server.js"]
