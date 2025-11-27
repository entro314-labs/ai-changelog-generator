# Building AI Changelog Generator as an MCPB Desktop Extension

This guide explains how to package the AI Changelog Generator as a Desktop Extension (`.mcpb` file) for one-click installation in Claude Desktop.

## What is MCPB?

MCPB (MCP Bundle) is the new format for Desktop Extensions that replaced the deprecated DXT format. It packages an entire MCP server with all dependencies into a single installable file.

**Migration Note:** This project was previously using the deprecated DXT format. We've migrated to MCPB following Anthropic's [Desktop Extensions announcement](https://www.anthropic.com/engineering/desktop-extensions).

## Prerequisites

```bash
# Install the MCPB CLI tool globally
npm install -g @anthropic-ai/mcpb

# Or use via npx
npx @anthropic-ai/mcpb --help
```

## Quick Start

### 1. Validate the Manifest

```bash
# Validate manifest.json
pnpm mcpb:validate

# Or directly
mcpb validate
```

### 2. Package the Extension

```bash
# Build the .mcpb file
pnpm mcpb:pack

# Or directly
mcpb pack
```

This creates `ai-changelog-generator.mcpb` in the current directory.

### 3. Test Locally

1. Open Claude Desktop
2. Go to Settings → Extensions
3. Drag and drop the `.mcpb` file
4. Click "Install"

## Manifest Structure

Our `manifest.json` follows the MCPB 0.3 specification:

```json
{
  "mcpb_version": "0.3",
  "name": "ai-changelog-generator",
  "display_name": "AI Changelog Generator",
  "version": "3.5.0",
  "server": {
    "type": "node",
    "entry_point": "bin/ai-changelog-mcp.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/bin/ai-changelog-mcp.js"],
      "env": {
        "AI_PROVIDER": "${user_config.AI_PROVIDER}",
        "OPENAI_API_KEY": "${user_config.OPENAI_API_KEY}"
        // ... other environment variables
      }
    }
  },
  "tools": [
    {
      "name": "generate_changelog",
      "description": "Generate AI-powered changelog",
      "arguments": [...]
    }
    // ... other tools
  ]
}
```

## Key Changes from DXT

### Version Field
- **Old (DXT):** `"dxt_version": "0.1"`
- **New (MCPB):** `"mcpb_version": "0.3"`

### File Extension
- **Old:** `.dxt` files
- **New:** `.mcpb` files

### Manifest Enhancements
- More detailed tool declarations with argument schemas
- Better user configuration UI support
- Enhanced platform-specific configurations
- Improved compatibility declarations

### Tool Declarations

MCPB supports detailed tool definitions:

```json
{
  "name": "generate_changelog",
  "description": "Generate AI-powered changelog from git commits",
  "arguments": [
    {
      "name": "repositoryPath",
      "description": "Path to the git repository",
      "required": false
    },
    {
      "name": "analysisMode",
      "description": "Analysis depth: 'basic', 'detailed', or 'comprehensive'",
      "required": false
    }
  ]
}
```

## User Configuration

The extension supports multiple AI providers. Users configure these in Claude Desktop:

### Required Configuration
- **None** - Extension works without configuration but with limited functionality

### Optional Configuration
- **AI_PROVIDER**: Choose provider (openai, azure, claude, google, ollama, lmstudio)
- **OPENAI_API_KEY**: OpenAI API key for GPT models
- **AZURE_OPENAI_KEY**: Azure OpenAI API key
- **ANTHROPIC_API_KEY**: Anthropic API key for Claude models
- **GOOGLE_API_KEY**: Google AI API key for Gemini models
- And more...

Configuration values are:
- Stored securely in OS keychain
- Injected as environment variables at runtime
- Validated before enabling the extension

## Development Workflow

### 1. Make Changes

Edit source code in `src/`, `bin/`, etc.

### 2. Update Manifest

If you add/remove tools or change configuration, update `manifest.json`:

```bash
# Validate changes
pnpm mcpb:validate
```

### 3. Test Locally

```bash
# Build and test
pnpm mcpb:pack

# Install in Claude Desktop by dragging .mcpb file
```

### 4. Version and Release

```bash
# Update version in both files
# - package.json
# - manifest.json

# Build release
pnpm mcpb:build
```

## Advanced Features

### Cross-Platform Support

The manifest supports platform-specific configurations:

```json
{
  "server": {
    "mcp_config": {
      "command": "node",
      "platforms": {
        "win32": {
          "command": "node.exe",
          "env": {
            "TEMP_DIR": "${TEMP}"
          }
        },
        "darwin": {
          "env": {
            "TEMP_DIR": "${TMPDIR}"
          }
        }
      }
    }
  }
}
```

### Template Variables

Available in manifest:
- `${__dirname}` - Extension installation directory
- `${user_config.key}` - User-provided configuration
- `${HOME}`, `${TEMP}`, etc. - System environment variables

### Compatibility Declaration

```json
{
  "compatibility": {
    "claude_desktop": ">=1.0.0",
    "platforms": ["darwin", "win32", "linux"],
    "runtimes": {
      "node": ">=22.x"
    }
  }
}
```

## Package Contents

The `.mcpb` file includes:

```
ai-changelog-generator.mcpb (ZIP archive)
├── manifest.json              # Extension metadata
├── bin/                       # Entry points
│   ├── ai-changelog.js
│   ├── ai-changelog-mcp.js   # Main MCP server
│   └── ai-changelog-dxt.js   # Legacy compatibility
├── src/                       # Source code
│   ├── application/
│   ├── domains/
│   ├── infrastructure/
│   └── shared/
├── types/                     # TypeScript definitions
├── package.json              # NPM package metadata
└── README.md                 # Documentation
```

## Troubleshooting

### Validation Errors

```bash
# Check manifest syntax
pnpm mcpb:validate

# Common issues:
# - Missing required fields (name, version, author, server)
# - Invalid mcpb_version (must be "0.3")
# - Malformed tool declarations
```

### Installation Issues

1. **Extension won't install**: Ensure Claude Desktop is updated to latest version
2. **Tools not appearing**: Check tools are properly declared in manifest.json
3. **Configuration not working**: Verify user_config field names match env variables

### Testing Tips

```bash
# Enable debug mode
export DEBUG=true
node bin/ai-changelog-mcp.js

# Test individual tools
# Use Claude Desktop with the extension installed

# Check logs
# Claude Desktop logs available in:
# macOS: ~/Library/Logs/Claude/
# Windows: %APPDATA%\Claude\logs\
```

## Publishing

To submit to Anthropic's extension directory:

1. Test on both macOS and Windows
2. Ensure manifest follows all guidelines
3. Submit via [Anthropic's extension form](https://docs.google.com/forms/d/14_Dmcig4z8NeRMB_e7TOyrKzuZ88-BLYdLvS6LPhiZU/edit)
4. Wait for security and quality review

## Resources

- [MCPB Specification](https://github.com/anthropics/mcpb)
- [Desktop Extensions Blog Post](https://www.anthropic.com/engineering/desktop-extensions)
- [MCPB Manifest Documentation](https://github.com/anthropics/mcpb/blob/main/MANIFEST.md)
- [Example Extensions](https://github.com/anthropics/mcpb/tree/main/examples)

## NPM Scripts Reference

```bash
pnpm mcpb:init       # Initialize manifest.json (interactive)
pnpm mcpb:validate   # Validate manifest.json
pnpm mcpb:pack       # Build .mcpb file
pnpm mcpb:build      # Validate + Pack (full build)
```

## Migration Notes

This project migrated from DXT to MCPB format:

### What Changed
- ✅ `dxt_version` → `mcpb_version`
- ✅ `.dxt` → `.mcpb` file extension
- ✅ Enhanced tool declarations with argument schemas
- ✅ Improved user configuration structure
- ✅ Better cross-platform support

### Backward Compatibility
- Legacy `server/index.js` maintained for old installations
- `bin/ai-changelog-dxt.js` retained with deprecation notice
- Existing DXT installations will continue to work
- New installations should use MCPB format

---

Built with ❤️ by [entro314-labs](https://github.com/entro314-labs)
