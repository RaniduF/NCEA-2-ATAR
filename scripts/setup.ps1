# NCEA2ATAR Docker Setup Script for Windows
Write-Host "🚀 Setting up NCEA2ATAR with Docker..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "   Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# Check if Docker Compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not available. Please ensure Docker Desktop is properly installed." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file with default values..." -ForegroundColor Blue
    @"
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
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✅ Created .env file" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Ask user for setup type
Write-Host ""
Write-Host "Choose setup type:"
Write-Host "1) Production (optimized builds)"
Write-Host "2) Development (with hot reloading)"
$choice = Read-Host "Enter choice (1 or 2)"

switch ($choice) {
    "1" {
        Write-Host "🔨 Building and starting production environment..." -ForegroundColor Blue
        docker-compose down 2>$null
        docker-compose up --build -d
        $containers = @("ncea-database", "ncea-backend", "ncea-frontend")
        $composeCmd = "docker-compose"
    }
    "2" {
        Write-Host "🔨 Building and starting development environment..." -ForegroundColor Blue
        docker-compose -f docker-compose.dev.yml down 2>$null
        docker-compose -f docker-compose.dev.yml up --build -d
        $containers = @("ncea-database-dev", "ncea-backend-dev", "ncea-frontend-dev")
        $composeCmd = "docker-compose -f docker-compose.dev.yml"
    }
    default {
        Write-Host "❌ Invalid choice. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if services are running
$allRunning = $true
foreach ($container in $containers) {
    $running = docker ps --format "table {{.Names}}" | Select-String "^$container$"
    if (-not $running) {
        Write-Host "❌ Container $container is not running" -ForegroundColor Red
        $allRunning = $false
    }
}

if ($allRunning) {
    Write-Host ""
    Write-Host "🎉 Setup complete! Services are running:" -ForegroundColor Green
    Write-Host ""
    Write-Host "   🌐 Frontend:  http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   🔧 Backend:   http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   📚 API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "   🗄️  Database:  localhost:3306" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Useful commands:" -ForegroundColor Yellow
    if ($choice -eq "1") {
        Write-Host "   View logs:    docker-compose logs -f"
        Write-Host "   Stop:         docker-compose down"
        Write-Host "   Restart:      docker-compose restart"
    } else {
        Write-Host "   View logs:    docker-compose -f docker-compose.dev.yml logs -f"
        Write-Host "   Stop:         docker-compose -f docker-compose.dev.yml down"
        Write-Host "   Restart:      docker-compose -f docker-compose.dev.yml restart"
    }
    Write-Host ""
    Write-Host "📖 For more information, see docker-setup.md" -ForegroundColor Blue
} else {
    Write-Host ""
    Write-Host "❌ Some services failed to start. Check the logs:" -ForegroundColor Red
    if ($choice -eq "1") {
        Write-Host "   docker-compose logs" -ForegroundColor Yellow
    } else {
        Write-Host "   docker-compose -f docker-compose.dev.yml logs" -ForegroundColor Yellow
    }
} 