FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}

RUN test -n "${EXPO_PUBLIC_API_BASE_URL}" \
    && npm run typecheck \
    && npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1
