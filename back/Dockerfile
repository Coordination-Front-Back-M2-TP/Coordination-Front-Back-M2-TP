# Image du back, en deux cibles :
# - « dev » : développement local, lancé par compose.yml à la racine (INSTALL.md, section 5) ;
# - la dernière étape (« production ») : l'image publiée sur GHCR par .github/workflows/cd.yml. Mode d'emploi : docs/deploiement.md.
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts ./scripts

# Développement : toutes les dépendances, et node --watch redémarre le back quand Compose recopie un fichier de src/.
FROM base AS dev
ENV NODE_ENV=development
RUN npm ci
COPY src ./src
ENV DATABASE_URL=file:/data/p1x3l.db
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate:deploy && npm run dev"]

FROM base AS production
ENV NODE_ENV=production
# Commit de l'image, renvoyé par /api/health : on voit ce qui tourne vraiment en production.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm ci --omit=dev && npm cache clean --force
RUN node scripts/prisma.js generate
COPY src ./src
# COPY donne les fichiers à root sans droit pour les autres : node ne pourrait pas les lire.
RUN mkdir -p /data && chown -R node:node /app /data
ENV DATABASE_URL=file:/data/p1x3l.db
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["npm", "start"]
