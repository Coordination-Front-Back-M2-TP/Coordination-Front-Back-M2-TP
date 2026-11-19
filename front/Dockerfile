# Image du front, en deux cibles :
# - « dev » : serveur Vite de développement, lancé par compose.yml à la racine (INSTALL.md, section 5) ;
# - la dernière étape : nginx et les fichiers construits, l'image publiée sur GHCR par .github/workflows/cd.yml.
#   Mode d'emploi : docs/deploiement.md.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Développement : Vite recharge la page quand Compose recopie un fichier de src/.
# --host : Vite écoute hors du conteneur. BACK_URL : le back est joignable sous le nom « back » dans le réseau Compose.
FROM deps AS dev
COPY . .
ENV BACK_URL=http://back:3000
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
RUN npm run build

# nginx sert les fichiers construits et transmet /api au back : front et back restent sur la même origine, comme en local.
FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
