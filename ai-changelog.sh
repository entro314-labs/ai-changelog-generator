#!/bin/bash

# AI Changelog Generator - Bash Wrapper
# Provides convenient bash execution for the Node.js CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to print colored output
print_error() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠️  Warning: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check Node.js version (require v18 or higher)
NODE_VERSION=$(node -v)
NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1 | sed 's/v//')

if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old"
    echo "Please upgrade to Node.js v18 or higher"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the right directory?"
    exit 1
fi

# Check if this is the AI Changelog Generator project
if ! grep -q "ai-changelog-generator" package.json 2>/dev/null; then
    print_warning "This doesn't appear to be the AI Changelog Generator project"
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Running npm install..."
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        print_error "Neither npm nor pnpm found. Please install Node.js package manager."
        exit 1
    fi
fi

# Check if the main CLI file exists
CLI_FILE="bin/ai-changelog.js"
if [ ! -f "$CLI_FILE" ]; then
    print_error "CLI file $CLI_FILE not found"
    exit 1
fi

# Show help if no arguments provided
if [ $# -eq 0 ]; then
    print_info "AI Changelog Generator - Bash Wrapper"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Examples:"
    echo "  $0                    # Generate changelog"
    echo "  $0 --detailed         # Detailed analysis"
    echo "  $0 --interactive      # Interactive mode"
    echo "  $0 --dry-run          # Preview mode"
    echo "  $0 --help             # Show help"
    echo ""
    echo "This wrapper will execute: node $CLI_FILE [options]"
    echo ""
fi

# Execute the Node.js CLI with all passed arguments
print_info "Executing: node $CLI_FILE $*"
exec node "$CLI_FILE" "$@"