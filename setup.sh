#!/bin/bash

# NCEA2ATAR Docker Setup Script
echo "🚀 Setting up NCEA2ATAR with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Download from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not available. Please ensure Docker Desktop is properly installed."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file with default values..."
    cat > .env << EOL
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

# Development/Production Toggle
NODE_ENV=production
EOL
    echo "✅ Created .env file"
else
    echo "✅ .env file already exists"
fi

# Ask user for setup type
echo ""
echo "Choose setup type:"
echo "1) Production (optimized builds)"
echo "2) Development (with hot reloading)"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo "🔨 Building and starting production environment..."
        docker-compose down 2>/dev/null || true
        docker-compose up --build -d
        compose_file=""
        ;;
    2)
        echo "🔨 Building and starting development environment..."
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml up --build -d
        compose_file="-f docker-compose.dev.yml"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if [ "$choice" = "1" ]; then
    containers="ncea-database ncea-backend ncea-frontend"
else
    containers="ncea-database-dev ncea-backend-dev ncea-frontend-dev"
fi

all_running=true
for container in $containers; do
    if ! docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
        echo "❌ Container $container is not running"
        all_running=false
    fi
done

if [ "$all_running" = true ]; then
    echo ""
    echo "🎉 Setup complete! Services are running:"
    echo ""
    echo "   🌐 Frontend:  http://localhost:3000"
    echo "   🔧 Backend:   http://localhost:8000"
    echo "   📚 API Docs:  http://localhost:8000/docs"
    echo "   🗄️  Database:  localhost:3306"
    echo ""
    echo "📋 Useful commands:"
    if [ "$choice" = "1" ]; then
        echo "   View logs:    docker-compose logs -f"
        echo "   Stop:         docker-compose down"
        echo "   Restart:      docker-compose restart"
    else
        echo "   View logs:    docker-compose -f docker-compose.dev.yml logs -f"
        echo "   Stop:         docker-compose -f docker-compose.dev.yml down"
        echo "   Restart:      docker-compose -f docker-compose.dev.yml restart"
    fi
    echo ""
    echo "📖 For more information, see docker-setup.md"
else
    echo ""
    echo "❌ Some services failed to start. Check the logs:"
    if [ "$choice" = "1" ]; then
        echo "   docker-compose logs"
    else
        echo "   docker-compose -f docker-compose.dev.yml logs"
    fi
fi 