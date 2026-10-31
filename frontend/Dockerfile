# -----------------------------
# Stage 1: Build React/Vite app
# -----------------------------
FROM node:22.19.0-slim AS build

WORKDIR /app

# Install build tools (required for native modules)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy only package files first
COPY package*.json ./

RUN npm install

# Copy everything except node_modules (handled by .dockerignore)
COPY . .

RUN npm run build

# -----------------------------
# Stage 2: Nginx production
# -----------------------------
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config from root/nginx
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
