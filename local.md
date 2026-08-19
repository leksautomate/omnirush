# Self-Hosting Kakkao / VidRush Live on a VPS (`local.md`)

This guide covers installing Docker and setting up self-hosted infrastructure components for Kakkao / VidRush Live on your Virtual Private Server (VPS).

---

## 1. Installing Docker & Docker Compose

Run the official installer script on your Linux VPS (Ubuntu / Debian / CentOS):

```bash
# 1. Download & run official installer
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Enable Docker to start on system boot
sudo systemctl enable --now docker

# 3. Allow your current user to run Docker without sudo (optional)
sudo usermod -aG docker $USER
# (Log out of your SSH session and log back in for group changes to take effect)

# 4. Verify installation
docker --version
docker compose version
```

---

## 2. Docker Compose Stack (All-in-One Deployment)

You can run PostgreSQL, Redis, Garage S3, and the Watch Service in a single `docker-compose.yml` file.

Create `docker-compose.yml` on your VPS:

```yaml
version: '3.8'

services:
  # 1. PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: kakkao-postgres
    restart: always
    environment:
      POSTGRES_USER: kakkao
      POSTGRES_PASSWORD: super_secret_postgres_password
      POSTGRES_DB: kakkao
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  # 2. Redis KV Cache (Storyboard + Voiceover KV)
  redis:
    image: redis:alpine
    container_name: kakkao-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  # 3. Garage S3 Object Storage
  garage:
    image: dxflrs/garage:v1.0.1
    container_name: kakkao-garage
    restart: always
    ports:
      - "3900:3900"
    volumes:
      - ./garage.toml:/etc/garage.toml
      - garagemeta:/var/lib/garage/meta
      - garagedata:/var/lib/garage/data

volumes:
  pgdata:
  redisdata:
  garagemeta:
  garagedata:
```

Start all services:
```bash
docker compose up -d
```

---

## 3. Individual Service Setup & Configuration

### A. PostgreSQL

If installing natively via `apt` (without Docker):
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# Create Database and User
sudo -u postgres psql -c "CREATE DATABASE kakkao;"
sudo -u postgres psql -c "CREATE USER kakkao WITH ENCRYPTED PASSWORD 'super_secret_postgres_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kakkao TO kakkao;"
sudo -u postgres psql -c "ALTER DATABASE kakkao OWNER TO kakkao;"
```

**Connection String (`app-live/.env.local`):**
```bash
DATABASE_URL="postgresql://kakkao:super_secret_postgres_password@localhost:5432/kakkao"
```

---

### B. Redis

If installing natively via `apt` (without Docker):
```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping  # Should return PONG
```

---

### C. Garage S3 (Lightweight S3 Storage)

#### 1. Configuration File (`garage.toml`)
Create `garage.toml` in the same directory:

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

[replication_factor]
replication_factor = 1

[rpc_bind_addr]
rpc_bind_addr = "127.0.0.1:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

[s3_api]
s3_region = "garage"
api_bind_addr = "0.0.0.0:3900"
root_domain = ".s3.garage"

[s3_web]
bind_addr = "0.0.0.0:3902"
root_domain = ".web.garage"
index = "index.html"
```

#### 2. Initialize Node & Create S3 Bucket
```bash
# Get Node ID
NODE_ID=$(docker exec kakkao-garage garage status | grep -oE '[a-f0-9]{64}' | head -n 1)

# Assign capacity (50GB) and apply layout
docker exec kakkao-garage garage layout assign $NODE_ID -c 50G -z zone1
docker exec kakkao-garage garage layout apply --version 1

# Create key & public bucket
docker exec kakkao-garage garage key create kakkao-key
docker exec kakkao-garage garage bucket create user-uploads
docker exec kakkao-garage garage bucket allow user-uploads --read --write --owner --key kakkao-key
docker exec kakkao-garage garage bucket website --allow user-uploads

# View Access Key & Secret Key
docker exec kakkao-garage garage key info kakkao-key
```

**S3 Connection Settings (`app-live/.env.local`):**
```bash
R2_ACCESS_KEY_ID=<GK_KEY_FROM_GARAGE>
R2_SECRET_ACCESS_KEY=<SECRET_KEY_FROM_GARAGE>
R2_BUCKET_NAME=user-uploads
R2_PUBLIC_URL=http://YOUR_VPS_IP:3900/user-uploads
S3_ENDPOINT=http://YOUR_VPS_IP:3900
S3_FORCE_PATH_STYLE=true
S3_REGION=garage
```

---

### D. Watch Service (Video Frame Extraction Backend)

The watch service extracts video frames and audio transcripts for video understanding.

Build and run from `watch-service/`:
```bash
cd watch-service
docker build -t kakkao-watch .
docker run -d \
  --name watch-service \
  --restart always \
  -p 8080:8080 \
  -e WATCH_SERVICE_TOKEN=your_secure_random_token \
  kakkao-watch
```

**Environment Variables (`app-live/.env.local`):**
```bash
WATCH_SERVICE_URL=http://YOUR_VPS_IP:8080
WATCH_SERVICE_TOKEN=your_secure_random_token
```

---

### E. Ollama (Self-Hosted Local LLMs)

To run open-weights LLMs locally on your VPS:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (e.g., Qwen 2.5 or DeepSeek-R1)
ollama pull qwen2.5:7b
```

**Environment Variables (`app-live/.env.local`):**
```bash
OLLAMA_BASE_URL=http://localhost:11434
```

---

### F. SearXNG (Self-Hosted Meta Search Engine)

To replace commercial search APIs with a self-hosted search instance:

```bash
docker run -d \
  --name searxng \
  --restart always \
  -p 8081:8080 \
  -e "SEARXNG_BASE_URL=http://YOUR_VPS_IP:8081" \
  searxng/searxng
```

**Environment Variables (`app-live/.env.local`):**
```bash
SEARCH_API=searxng
SEARXNG_API_URL=http://YOUR_VPS_IP:8081
```

---

## 4. Connecting `vidrush-live` (Prisma & DB Push)

Once your PostgreSQL container is running, initialize your database schema from the `app-live/` directory:

```bash
cd app-live
npx prisma db push
```

Your VPS self-hosted infrastructure is fully installed and ready to use!
