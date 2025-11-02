# Deployment Guide - Cloud Storage Sync Tool

## Overview

This guide covers deploying the FastAPI backend to production. The backend can be deployed to various platforms including:

- Heroku
- AWS (EC2, ECS, Lambda)
- Google Cloud (App Engine, Cloud Run)
- Azure (App Service, Container Instances)
- DigitalOcean
- Self-hosted VPS

## Pre-Deployment Checklist

### 1. Environment Variables

Ensure all required environment variables are set:

```bash
# Required
SECRET_KEY=<strong-random-key-32-chars-min>
TOKEN_ENCRYPTION_KEY=<32-char-fernet-key>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Azure (if using)
AZURE_STORAGE_CONNECTION_STRING=<your-azure-connection>

# Production settings
ENV=production
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/google/callback
```

### 2. Database Migration

For production, use PostgreSQL instead of SQLite:

```bash
# Update DATABASE_URL in .env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

# Run migrations (if using Alembic)
alembic upgrade head
```

### 3. Security Hardening

- [ ] Use strong SECRET_KEY and TOKEN_ENCRYPTION_KEY
- [ ] Enable HTTPS/TLS
- [ ] Restrict CORS_ORIGINS to your domain only
- [ ] Use environment-specific secrets management
- [ ] Enable rate limiting
- [ ] Review file upload limits
- [ ] Use secure database credentials
- [ ] Enable firewall rules
- [ ] Regular security updates

## Docker Deployment

### Build Docker Image

```bash
cd backend

# Build image
docker build -t cloud-sync-api:latest .

# Test locally
docker run -p 8000:8000 \
  -e SECRET_KEY=your-secret \
  -e TOKEN_ENCRYPTION_KEY=your-key \
  -e DATABASE_URL=postgresql+asyncpg://... \
  cloud-sync-api:latest
```

### Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend

  backend:
    build: .
    restart: always
    env_file:
      - .env.production
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - ./storage:/app/storage
    networks:
      - backend

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
    networks:
      - backend

volumes:
  postgres_data:

networks:
  backend:
```

Run:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Platform-Specific Deployments

### Heroku

1. **Install Heroku CLI**

```bash
heroku login
```

2. **Create app**

```bash
heroku create your-app-name
```

3. **Add PostgreSQL**

```bash
heroku addons:create heroku-postgresql:hobby-dev
```

4. **Set environment variables**

```bash
heroku config:set SECRET_KEY=your-secret-key
heroku config:set TOKEN_ENCRYPTION_KEY=your-encryption-key
heroku config:set GOOGLE_CLIENT_ID=your-google-client-id
heroku config:set GOOGLE_CLIENT_SECRET=your-google-client-secret
heroku config:set GOOGLE_REDIRECT_URI=https://your-app-name.herokuapp.com/auth/google/callback
heroku config:set FRONTEND_URL=https://your-frontend.com
heroku config:set CORS_ORIGINS=https://your-frontend.com
```

5. **Create Procfile**

```
web: uvicorn app.main:app --host=0.0.0.0 --port=${PORT:-8000}
```

6. **Deploy**

```bash
git push heroku main
```

### AWS EC2

1. **Launch EC2 instance** (Ubuntu 22.04 LTS)

2. **SSH into instance**

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

3. **Install dependencies**

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv nginx postgresql postgresql-contrib

# Install Docker (optional)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

4. **Clone repository**

```bash
git clone https://github.com/yourusername/cloud-sync.git
cd cloud-sync/backend
```

5. **Setup application**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and configure .env
cp .env.example .env
nano .env
```

6. **Setup PostgreSQL**

```bash
sudo -u postgres psql
CREATE DATABASE cloud_sync_db;
CREATE USER cloud_sync WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE cloud_sync_db TO cloud_sync;
\q
```

7. **Run with systemd**

Create `/etc/systemd/system/cloud-sync.service`:

```ini
[Unit]
Description=Cloud Sync API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/cloud-sync/backend
Environment="PATH=/home/ubuntu/cloud-sync/backend/venv/bin"
EnvironmentFile=/home/ubuntu/cloud-sync/backend/.env
ExecStart=/home/ubuntu/cloud-sync/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable cloud-sync
sudo systemctl start cloud-sync
sudo systemctl status cloud-sync
```

8. **Setup Nginx**

Create `/etc/nginx/sites-available/cloud-sync`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (for SSE)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/cloud-sync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

9. **Setup SSL with Let's Encrypt**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Google Cloud Run

1. **Install gcloud CLI**

2. **Build and push to Container Registry**

```bash
cd backend

# Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/cloud-sync-api

# Deploy
gcloud run deploy cloud-sync-api \
  --image gcr.io/YOUR_PROJECT_ID/cloud-sync-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "SECRET_KEY=your-secret,TOKEN_ENCRYPTION_KEY=your-key"
```

3. **Setup Cloud SQL (PostgreSQL)**

```bash
gcloud sql instances create cloud-sync-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create cloud_sync_db --instance=cloud-sync-db
```

4. **Connect Cloud Run to Cloud SQL**

```bash
gcloud run services update cloud-sync-api \
  --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:cloud-sync-db
```

### DigitalOcean App Platform

1. **Connect GitHub repository**

2. **Configure app**

```yaml
# .do/app.yaml
name: cloud-sync-api
services:
  - name: api
    github:
      repo: yourusername/cloud-sync
      branch: main
      deploy_on_push: true
    source_dir: /backend
    environment_slug: python
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 8000
    run_command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    envs:
      - key: SECRET_KEY
        value: ${SECRET_KEY}
      - key: TOKEN_ENCRYPTION_KEY
        value: ${TOKEN_ENCRYPTION_KEY}
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}

databases:
  - name: db
    engine: PG
    version: "14"
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Health check
curl https://api.yourdomain.com/health

# API docs
open https://api.yourdomain.com/docs
```

### 2. Test API Endpoints

```bash
# Register user
curl -X POST https://api.yourdomain.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","full_name":"Test"}'

# Upload file
curl -X POST https://api.yourdomain.com/api/v1/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf"
```

### 3. Monitor Logs

```bash
# Docker
docker-compose logs -f backend

# Systemd
sudo journalctl -u cloud-sync -f

# Heroku
heroku logs --tail

# Cloud Run
gcloud run services logs read cloud-sync-api --follow
```

### 4. Setup Monitoring

- Application performance monitoring (APM)
- Error tracking (Sentry)
- Uptime monitoring
- Database monitoring
- Storage usage alerts

## Scaling Considerations

### Horizontal Scaling

- Use load balancer (Nginx, AWS ALB, Google Cloud Load Balancer)
- Deploy multiple instances
- Use Redis for session storage
- Consider Celery for background tasks

### Database Optimization

- Connection pooling
- Read replicas
- Query optimization
- Regular backups

### Storage Optimization

- Use CDN for file downloads
- Implement file cleanup jobs
- Monitor storage quotas

## Backup Strategy

### Database Backups

```bash
# PostgreSQL backup
pg_dump -h host -U user -d dbname > backup_$(date +%Y%m%d).sql

# Restore
psql -h host -U user -d dbname < backup_20231201.sql
```

### File Storage Backups

```bash
# Backup local storage
tar -czf storage_backup_$(date +%Y%m%d).tar.gz ./storage

# Sync to S3
aws s3 sync ./storage s3://your-bucket/backups/storage/
```

## Troubleshooting

### Common Issues

**Issue: 502 Bad Gateway**
- Check if application is running
- Verify port bindings
- Check application logs

**Issue: Database connection failed**
- Verify DATABASE_URL
- Check database credentials
- Ensure database is accessible

**Issue: Google OAuth fails**
- Update redirect URI in Google Console
- Check HTTPS configuration
- Verify client ID/secret

**Issue: File upload fails**
- Check disk space
- Verify file size limits
- Check permissions on storage directory

## Security Best Practices

1. ✅ Use HTTPS everywhere
2. ✅ Keep dependencies updated
3. ✅ Use strong passwords and keys
4. ✅ Enable rate limiting
5. ✅ Regular security audits
6. ✅ Monitor for suspicious activity
7. ✅ Implement proper logging
8. ✅ Use secrets management (AWS Secrets Manager, Google Secret Manager)
9. ✅ Enable firewall rules
10. ✅ Regular backups

## Support

For deployment issues:
- Check backend logs
- Review API documentation
- Open GitHub issue
- Contact support

---

**Production Ready!** 🚀

Your Cloud Storage Sync Tool backend is now deployed and ready for production use.
