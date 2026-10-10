# Image du back publiée sur GHCR par .github/workflows/cd.yml. Mode d'emploi : docs/deploiement.md.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
# COPY donne les fichiers à root sans droit pour les autres : node ne pourrait pas les lire.
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server.js"]
