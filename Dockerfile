FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the binary
RUN bun build src/index.ts --compile --outfile mcp-doppelganger

# Production stage - minimal image
FROM debian:bookworm-slim

WORKDIR /app

# Install ca-certificates for HTTPS support
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary
COPY --from=builder /app/mcp-doppelganger /usr/local/bin/mcp-doppelganger

# Create a non-root user
RUN useradd -m -s /bin/bash doppelganger
USER doppelganger

# Default working directory for configs
WORKDIR /config

# Expose default HTTP port
EXPOSE 3000

# Default command - serve with both transports
ENTRYPOINT ["mcp-doppelganger"]
CMD ["serve", "--http", "--stdio", "-f", "/config/doppelganger.yaml"]
