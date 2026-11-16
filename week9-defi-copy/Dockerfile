FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server ./server
COPY public ./public
EXPOSE 3000
USER node
CMD ["node","server/index.js"]
