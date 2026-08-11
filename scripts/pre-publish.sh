#!/usr/bin/env bash

set -euo pipefail

# Pre-publish checklist script

echo "🚀 AI Changelog Generator - Pre-publish Checklist"
echo "=================================================="

# Check Node version
echo "📋 Checking Node.js version..."
node_version=$(node -v)
echo "   Node.js: $node_version"

# Check pnpm version
echo "📋 Checking pnpm version..."
pnpm_version=$(pnpm -v)
echo "   pnpm: $pnpm_version"

# Build package metadata helpers without relying on CommonJS require()
package_name=$(node --input-type=module -e "import { readFileSync } from 'node:fs'; const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')); console.log(pkg.name);")
package_version=$(node --input-type=module -e "import { readFileSync } from 'node:fs'; const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')); console.log(pkg.version);")
package_description=$(node --input-type=module -e "import { readFileSync } from 'node:fs'; const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')); console.log(pkg.description);")

# Run verification
echo "📋 Running checks..."
pnpm run check

# Build package
echo "📋 Building package..."
pnpm run build

# Run tests
echo "📋 Running tests..."
pnpm test

# Validate MCP package
echo "📋 Validating MCP server..."
pnpm run mcpb:validate

# Check for required files
echo "📋 Checking required files..."
required_files=(
    "README.md"
    "LICENSE"
    "package.json"
    "manifest.json"
    "dist/bin/ai-changelog.js"
    "dist/bin/ai-changelog-mcp.js"
    "dist/src/ai-changelog-generator.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file (missing)"
        exit 1
    fi
done

# Check package.json fields
echo "📋 Checking package.json..."
if ! grep -q '"name".*"@entro314labs/ai-changelog-generator"' package.json; then
    echo "   ❌ Package name not set correctly"
    exit 1
fi

if ! grep -q '"repository"' package.json; then
    echo "   ❌ Repository field missing"
    exit 1
fi

echo "   ✅ package.json looks good"

# Build info
echo "📋 Package info..."
echo "   Name: $package_name"
echo "   Version: $package_version"
echo "   Description: $package_description"

echo ""
echo "✅ All checks passed! Ready to publish."
echo ""
echo "📋 Next steps:"
echo "   1. Commit and push all changes"
echo "   2. Create a release tag: git tag v$package_version"
echo "   3. Push tags: git push --tags"
echo "   4. Publish: pnpm publish --access public"
echo ""
