# Docker Setup for NCEA2ATAR Project

This guide will help you set up and run the NCEA2ATAR project using Docker containers.

## Prerequisites

- Docker Desktop installed on your machine
- Docker Compose (included with Docker Desktop)
- Git (to clone the repository)

## Project Structure

The project consists of three main components:
- **Frontend**: Next.js application (TypeScript + Tailwind CSS)
- **Backend**: FastAPI application (Python)
- **Database**: MySQL 8.0

## Environment Configuration

1. Create environment variables (optional - defaults are provided):

```bash
# Database Configuration
DB_NAME=ncea_atar
DB_USER=ncea_user
DB_PASSWORD=ncea_password
DB_ROOT_PASSWORD=root_password

# Backend Configuration
DB_HOST=database
DB_PORT=3306

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

You can either:
- Create a `.env` file in the root directory with these variables
- Use the default values (recommended for first-time setup)

## Quick Start

### Production Setup

1. **Build and start all services:**
```bash
docker-compose up --build
```

2. **Run in detached mode (background):**
```bash
docker-compose up -d --build
```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Database: localhost:3306

### Development Setup (with hot reloading)

1. **Start development environment:**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

2. **Access the application:**
   - Frontend: http://localhost:3000 (with hot reloading)
   - Backend API: http://localhost:8000 (with auto-reload)
   - Database: localhost:3307 (dev mode uses port 3307 to avoid conflicts)

## Available Commands

### Basic Operations
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove all data
docker-compose down -v

# Rebuild containers
docker-compose up --build

# View logs
docker-compose logs

# View logs for specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs database
```

### Development Commands
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Rebuild development environment
docker-compose -f docker-compose.dev.yml up --build

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Database Operations
```bash
# Access MySQL database directly
docker-compose exec database mysql -u ncea_user -p ncea_atar

# Import additional data
docker-compose exec database mysql -u ncea_user -p ncea_atar < your_data_file.sql

# Backup database
docker-compose exec database mysqldump -u ncea_user -p ncea_atar > backup.sql
```

### Container Management
```bash
# View running containers
docker-compose ps

# Access backend container shell
docker-compose exec backend bash

# Access frontend container shell
docker-compose exec frontend sh

# View container resource usage
docker stats
```

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   - Ensure ports 3000, 8000 are not in use by other applications
   - Production uses port 3306 for MySQL, development uses 3307
   - If you have local MySQL running, development mode will use port 3307 automatically
   - Modify ports in docker-compose.yml if needed

2. **Database connection issues:**
   - Wait for database health check to pass before backend starts
   - Check database logs: `docker-compose logs database`

3. **Frontend build issues:**
   - Clear Docker build cache: `docker-compose build --no-cache frontend`
   - Check Node.js version compatibility

4. **Backend dependency issues:**
   - Rebuild backend: `docker-compose build --no-cache backend`
   - Check Python requirements

### Useful Debug Commands
```bash
# Check container health
docker-compose ps

# View detailed logs with timestamps
docker-compose logs -f --timestamps

# Access running container for debugging
docker-compose exec backend bash
docker-compose exec frontend sh

# Remove all containers and start fresh
docker-compose down
docker system prune -a
docker-compose up --build
```

## Data Persistence

- **Database data** is persisted in Docker volumes
- **Development files** are mounted as volumes for hot reloading
- **Production builds** are contained within the Docker images

## Security Notes

- Default passwords are provided for development
- Change all passwords for production deployments
- Consider using Docker secrets for sensitive data
- Non-root users are used in all containers

## Performance Optimization

- Multi-stage builds reduce final image sizes
- .dockerignore files exclude unnecessary files
- Volume caching improves development experience
- Health checks ensure service reliability

## Production Deployment

For production deployment:

1. **Update environment variables** with secure values
2. **Use production docker-compose.yml** (not the dev version)
3. **Configure proper networking** and security groups
4. **Set up SSL/TLS termination** (reverse proxy)
5. **Configure log aggregation** and monitoring
6. **Set up automated backups** for the database

## Support

If you encounter issues:
1. Check the logs using `docker-compose logs`
2. Ensure all prerequisites are installed
3. Try rebuilding with `--no-cache` flag
4. Check for port conflicts on your system 