FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services/gateway ./services/gateway
RUN npm ci
RUN npm --workspace @debugwise/gateway run build
EXPOSE 4000
CMD ["node", "services/gateway/dist/server.js"]
