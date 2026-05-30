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

# Create a non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy standalone server files
COPY --from=builder /app/.next/standalone ./

# Copy static files
COPY --from=builder /app/.next/static ./.next/static

# Copy public files
COPY --from=builder /app/public ./public

RUN chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE 3000

# Next.js standalone server.js binds to process.env.HOSTNAME. Docker sets
# HOSTNAME to the container ID, which makes it bind to only the container's
# network IP (so the healthcheck's loopback connect is refused). Pin it to
# 0.0.0.0 so it listens on all interfaces.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Use 127.0.0.1 (not localhost → ::1) since the server binds IPv4 0.0.0.0.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Run the application
CMD ["node", "server.js"]
