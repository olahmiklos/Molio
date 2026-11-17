# Molio – helyi (rendelői) futtatás. A nyilvános demó statikus oldalként Cloudflare-en fut.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run generate

FROM nginx:1.27-alpine
COPY --from=build /app/.output/public /usr/share/nginx/html
EXPOSE 80
