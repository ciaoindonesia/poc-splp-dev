FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --quiet --omit=dev
COPY src/ ./src/
EXPOSE 3002
USER node
CMD ["node", "src/index.js"]
