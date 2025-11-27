# 📦 Publishing Guide

## Pre-Publishing Checklist

### 1. Update Package Information

Update these fields in `package.json`:

- `author.email` - Your email address
- `repository.url` - Your GitHub repository URL
- `bugs.url` - Your GitHub issues URL
- `homepage` - Your GitHub repository homepage

### 2. Create a LICENSE file

```bash
# Add an MIT license (recommended)
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 Dominikos Pritis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

### 3. Set Up Git Repository

```bash
# Initialize git (if not already done)
git init

# Add remote origin
git remote add origin https://github.com/dominikospritis/ai-changelog-generator.git

# Add all files
git add .

# Commit
git commit -m "Initial release v2.2.0"

# Push to GitHub
git push -u origin main
```

### 4. Run Pre-publish Checks

```bash
# Run the pre-publish script
./scripts/pre-publish.sh
```

### 5. Create a Release Tag

```bash
# Create and push version tag
git tag v2.2.0
git push --tags
```

## Publishing to npm

### Option 1: Scoped Package (Recommended)

This publishes as `@dominikospritis/ai-changelog-generator`:

```bash
# Login to npm (if not already logged in)
npm login

# Publish (public scoped package)
npm publish --access public
```

### Option 2: Unscoped Package

If you want to publish as `ai-changelog-generator` (without the scope):

1. Update `package.json` name to just `"ai-changelog-generator"`
2. Check if the name is available: `npm view ai-changelog-generator`
3. If available: `npm publish`

⚠️ **Note**: Unscoped names are often taken. Scoped packages are recommended.

## Post-Publishing

### 1. Verify Installation

```bash
# Test global installation
npm install -g @dominikospritis/ai-changelog-generator

# Test CLI
ai-changelog --help
ai-changelog-mcp --help

# Test in a git repository
cd /path/to/some/git/repo
ai-changelog
```

### 2. Update Documentation

- Add npm badges to README
- Create a CHANGELOG.md for future releases
- Update examples with the published package name

### 3. Set Up CI/CD (Optional)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm run validate:mcp
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Distribution Strategy

### Single Package Approach (Current)

**Pros:**

- ✅ Single package to maintain
- ✅ Users get both CLI and MCP server
- ✅ Simpler publishing and versioning
- ✅ Shared dependencies and code

**Cons:**

- ❌ Larger package size for CLI-only users
- ❌ MCP dependency for CLI-only users

### Alternative: Separate Packages

If you want to split into separate packages:

1. **`@dominikospritis/ai-changelog-generator`** - Core CLI tool
2. **`@dominikospritis/ai-changelog-generator-mcp`** - MCP server

**Benefits:**

- Smaller individual packages
- Clearer separation of concerns
- Users can install only what they need

**Implementation:**

```bash
# Create separate repositories/packages
mkdir ai-changelog-generator-mcp
# Move MCP-specific code there
# Update dependencies and publishing
```

## Recommendation

**Stick with the single package approach** for now because:

- The MCP SDK adds minimal overhead (~2MB)
- Most users will want both functionalities
- Easier to maintain and version
- Growing MCP ecosystem makes the server valuable

You can always split later if needed!

## Marketing and Distribution

### npm Keywords

Already included in package.json:

- `changelog`, `git`, `ai`, `automation`
- `openai`, `azure`, `mcp`, `model-context-protocol`
- `claude`, `cli`

### Promotion Channels

1. **GitHub**
   - Add topics to your repository
   - Create detailed README with examples
   - Add to awesome lists (awesome-mcp, awesome-cli-tools)

2. **npm**
   - Good package description and keywords
   - Quality README that displays well
   - Regular updates and maintenance

3. **Community**
   - Share on relevant Discord/Slack channels
   - Reddit (r/nodejs, r/programming, r/MachineLearning)
   - Twitter/X with relevant hashtags

4. **Documentation**
   - Create a simple website with GitHub Pages
   - Video demos showing both CLI and MCP usage
   - Blog posts about the implementation

## Version Management

### Semantic Versioning

- **MAJOR** (3.0.0): Breaking changes
- **MINOR** (2.3.0): New features, backward compatible
- **PATCH** (2.2.1): Bug fixes, backward compatible

### Release Process

```bash
# For patches
npm version patch
git push && git push --tags
npm publish

# For minor features
npm version minor
git push && git push --tags
npm publish

# For major changes
npm version major
git push && git push --tags
npm publish
```

---

🎉 **You're ready to publish!** The single package approach gives users maximum value and keeps maintenance simple.
