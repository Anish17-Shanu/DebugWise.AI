FROM node:22-alpine AS builder
WORKDIR /app
ARG VITE_DEBUGWISE_GATEWAY_URL=/api
ARG VITE_DEBUGWISE_WS_URL=/ws
ENV VITE_DEBUGWISE_GATEWAY_URL=$VITE_DEBUGWISE_GATEWAY_URL
ENV VITE_DEBUGWISE_WS_URL=$VITE_DEBUGWISE_WS_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm ci
RUN npm --workspace @debugwise/web run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
