FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules (canvas, sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    openssl \
    openssl-dev

COPY package*.json ./
RUN npm install --production=false

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Railway injects $PORT at runtime — EXPOSE is just documentation
EXPOSE 8080

# Run DB migrations then start the server (NO nodemon in production)
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
