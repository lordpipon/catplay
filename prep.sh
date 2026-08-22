docker network create shared_backend
docker run -d --name catplay-redis --network shared_backend -p 6379:6379 -v catplay_redisdata:/data --restart unless-stopped redis:8-alpine redis-server --save 60 1
docker run -d --name catplay-postgres --network shared_backend -e POSTGRES_USER=catuser -e POSTGRES_PASSWORD=urpass -e POSTGRES_DB=catplay -p 5432:5432 -v catplay_pgdata:/var/lib/postgresql/data --restart unless-stopped pgvector/pgvector:pg16
cd website
cp .env.example .env
cd ..
