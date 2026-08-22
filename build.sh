#!/bin/bash

echo "🚀 Starting Catplay deployment..."
echo "📥 Pulling latest changes..."


echo "🔨 Building Docker images..."
docker compose build --no-cache

echo "🛑 Stopping existing containers..."
docker compose down --volumes --remove-orphans

echo "🏗️ Starting containers..."
docker compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

echo "🔍 Checking container status..."
docker compose ps
cat website/drizzle/*.sql | docker exec -i catplay-postgres psql -U catuser -d catplay

echo "📊 Checking service health..."
echo "Main app: http://localhost:5905"
echo "WebSocket: http://localhost:8082/health"

echo "📋 Tailing logs (press Ctrl+C to stop)..."
docker compose logs -f