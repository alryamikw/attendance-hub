#!/bin/bash
# AttendanceHub Auto-Startup Script
# This script starts all required services automatically

echo "🚀 Starting AttendanceHub..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="/home/z/my-project"

# Function to check if a port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
    return $?
}

# Function to wait for a service
wait_for_service() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    while ! check_port $port; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            echo "⚠️  $name failed to start on port $port"
            return 1
        fi
        sleep 0.5
    done
    echo -e "${GREEN}✓${NC} $name running on port $port"
    return 0
}

# Start WebSocket Service
start_websocket() {
    echo -e "${BLUE}Starting WebSocket Service...${NC}"
    cd "$PROJECT_DIR/mini-services/realtime-service"
    
    if check_port 3003; then
        echo -e "${GREEN}✓${NC} WebSocket already running on port 3003"
    else
        bun run dev > /dev/null 2>&1 &
        wait_for_service 3003 "WebSocket Service"
    fi
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo "    AttendanceHub Service Manager"
    echo "========================================"
    echo ""
    
    # Start WebSocket
    start_websocket
    
    echo ""
    echo -e "${GREEN}✅ All services started successfully!${NC}"
    echo ""
    echo "📊 Dashboard: http://localhost:3000"
    echo "🔌 WebSocket: http://localhost:3003"
    echo "❤️  Health Check: http://localhost:3004/health"
    echo ""
}

main "$@"
