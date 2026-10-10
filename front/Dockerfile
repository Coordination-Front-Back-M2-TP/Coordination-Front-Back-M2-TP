# Image du front publiée sur GHCR par .github/workflows/cd.yml. Mode d'emploi : docs/deploiement.md.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx sert les fichiers construits et transmet /api au back : front et back restent sur la même origine, comme en local.
FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
