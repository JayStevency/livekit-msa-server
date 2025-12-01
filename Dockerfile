# Build stage
FROM node:22-alpine AS builder

ARG APP_NAME=api-gateway

WORKDIR /app

# Dummy DATABASE_URL for prisma generate (not used at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build:${APP_NAME}

# Production stage
FROM node:22-alpine AS production

ARG APP_NAME=api-gateway

WORKDIR /app

ENV NODE_ENV=production
ENV APP_NAME=${APP_NAME}

COPY package*.json ./

RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy public folder for static files
COPY --from=builder /app/public ./public

# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD node dist/apps/${APP_NAME}/apps/${APP_NAME}/src/main
