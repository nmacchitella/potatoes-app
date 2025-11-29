#!/bin/bash

# Potatoes Development Setup Script
# Usage: ./setup.sh

set -e

echo "Setting up Potatoes development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Python 3 is required but not installed.${NC}"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is required but not installed.${NC}"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is required but not installed.${NC}"
        exit 1
    fi

    echo -e "${GREEN}All requirements met!${NC}"
}

# Setup backend
setup_backend() {
    echo -e "${YELLOW}Setting up backend...${NC}"
    cd backend

    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    # Activate and install dependencies
    source venv/bin/activate
    echo "Installing Python dependencies..."
    pip install -r requirements.txt --quiet

    # Create .env if it doesn't exist
    if [ ! -f ".env" ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
        echo -e "${YELLOW}Please edit backend/.env with your credentials${NC}"
    fi

    deactivate
    cd ..
    echo -e "${GREEN}Backend setup complete!${NC}"
}

# Setup frontend
setup_frontend() {
    echo -e "${YELLOW}Setting up frontend...${NC}"
    cd frontend

    # Install npm dependencies
    echo "Installing npm dependencies..."
    npm install --silent

    # Create .env.local if it doesn't exist
    if [ ! -f ".env.local" ]; then
        echo "Creating .env.local..."
        echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
    fi

    cd ..
    echo -e "${GREEN}Frontend setup complete!${NC}"
}

# Main
main() {
    check_requirements
    setup_backend
    setup_frontend

    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
    echo ""
    echo "To start the backend:"
    echo "  cd backend"
    echo "  source venv/bin/activate"
    echo "  uvicorn main:app --reload --port 8000"
    echo ""
    echo "To start the frontend:"
    echo "  cd frontend"
    echo "  npm run dev"
    echo ""
    echo "Or use Docker Compose:"
    echo "  docker-compose up"
}

main
