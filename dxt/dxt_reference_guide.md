# Claude Desktop Extensions (DXT) Reference Guide

## Overview

Desktop Extensions (.dxt files) are packaged MCP servers that install with one click in Claude Desktop. They eliminate the need for manual configuration, dependency management, and developer tools.

**Problem solved:** MCP servers previously required Node.js/Python installation, manual JSON editing, and dependency resolution. Extensions bundle everything into a single file.

## Architecture

A Desktop Extension is a ZIP archive containing:

```
extension.dxt (ZIP archive)
├── manifest.json      # Required: Extension metadata and configuration
├── server/           # MCP server implementation
│   └── [server files]
├── dependencies/     # All required packages/libraries
└── icon.png         # Optional: Extension icon
```

### Supported Runtime Types

**Node.js Extension:**
```
extension.dxt
├── manifest.json
├── server/
│   └── index.js     # Main entry point
├── node_modules/    # Bundled dependencies
├── package.json     # Optional: NPM package definition
└── icon.png        # Optional
```

**Python Extension:**
```
extension.dxt
├── manifest.json
├── server/
│   ├── main.py     # Main entry point
│   └── utils.py    # Additional modules
├── lib/           # Bundled Python packages
├── requirements.txt # Optional: Dependencies list
└── icon.png       # Optional
```

**Binary Extension:**
```
extension.dxt
├── manifest.json
├── bin/           # Executable files
└── icon.png      # Optional
```

## Manifest.json Specification

### Minimal Required Manifest

```json
{
  "dxt_version": "0.1",
  "name": "my-extension",
  "version": "1.0.0",
  "description": "A simple MCP extension",
  "author": {
    "name": "Extension Author"
  },
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.js"]
    }
  }
}
```

### Complete Manifest Fields

```json
{
  "dxt_version": "0.1",                    // Required: DXT spec version
  "name": "my-extension",                  // Required: Machine-readable name
  "display_name": "My Extension",          // Optional: Human-readable name
  "version": "1.0.0",                     // Required: Semantic version
  "description": "Brief description",      // Required: Short description
  "long_description": "Detailed description with markdown support",
  
  "author": {                             // Required
    "name": "Your Name",                  // Required
    "email": "name@example.com",          // Optional
    "url": "https://your-website.com"     // Optional
  },
  
  "repository": {                         // Optional
    "type": "git",
    "url": "https://github.com/user/repo"
  },
  
  "homepage": "https://example.com",      // Optional
  "documentation": "https://docs.example.com", // Optional
  "support": "https://github.com/user/repo/issues", // Optional
  "icon": "icon.png",                     // Optional
  "screenshots": ["screenshot1.png"],     // Optional
  
  "server": {                            // Required
    "type": "node",                      // Required: "node", "python", or "binary"
    "entry_point": "server/index.js",   // Required: Path to main file
    "mcp_config": {                      // Required
      "command": "node",                 // Required
      "args": ["${__dirname}/server/index.js"], // Required
      "env": {                          // Optional
        "API_KEY": "${user_config.api_key}"
      }
    }
  },
  
  "tools": [                            // Optional: Tool declarations
    {
      "name": "search_files",
      "description": "Search for files in a directory"
    }
  ],
  
  "prompts": [                          // Optional: Prompt declarations
    {
      "name": "poetry",
      "description": "Write poetry",
      "arguments": ["topic"],
      "text": "Write a poem about: ${arguments.topic}"
    }
  ],
  
  "tools_generated": true,              // Optional: Whether tools are dynamically generated
  "keywords": ["api", "automation"],    // Optional: Search keywords
  "license": "MIT",                     // Optional: License identifier
  
  "compatibility": {                    // Optional
    "claude_desktop": ">=1.0.0",
    "platforms": ["darwin", "win32", "linux"],
    "runtimes": {
      "node": ">=16.0.0"
    }
  },
  
  "user_config": {                      // Optional: User configuration schema
    "api_key": {
      "type": "string",
      "title": "API Key",
      "description": "Your API key",
      "sensitive": true,
      "required": true
    },
    "allowed_directories": {
      "type": "directory",
      "title": "Allowed Directories",
      "description": "Directories to access",
      "multiple": true,
      "required": true,
      "default": ["${HOME}/Documents"]
    },
    "max_file_size": {
      "type": "number",
      "title": "Max File Size (MB)",
      "description": "Maximum file size",
      "default": 10,
      "min": 1,
      "max": 100
    }
  }
}
```

### User Configuration Types

| Type | Description | Additional Fields |
|------|-------------|-------------------|
| `string` | Text input | `default`, `min_length`, `max_length` |
| `number` | Numeric input | `default`, `min`, `max` |
| `boolean` | Checkbox | `default` |
| `directory` | Directory picker | `multiple`, `default` |
| `file` | File picker | `multiple`, `extensions`, `default` |

**Common Fields for All Types:**
- `title`: Display name
- `description`: Help text
- `required`: Whether field is mandatory
- `sensitive`: Store in OS keychain (strings only)

### Template Variables

| Variable | Description |
|----------|-------------|
| `${__dirname}` | Extension's installation directory |
| `${user_config.key}` | User-provided configuration value |
| `${HOME}` | User's home directory |
| `${TEMP}` | System temporary directory |
| `${TMPDIR}` | System temporary directory (macOS/Linux) |

### Cross-Platform Configuration

```json
{
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.js"],
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

## Building Extensions

### Prerequisites

Install the DXT toolchain:
```bash
npm install -g @anthropic-ai/dxt
```

### Step 1: Initialize Manifest

```bash
# Interactive setup
npx @anthropic-ai/dxt init

# Quick setup with defaults
npx @anthropic-ai/dxt init --yes
```

### Step 2: Configure User Input

Define required user configuration in manifest:

```json
{
  "user_config": {
    "allowed_directories": {
      "type": "directory",
      "title": "Allowed Directories", 
      "description": "Directories the server can access",
      "multiple": true,
      "required": true,
      "default": ["${HOME}/Documents"]
    }
  }
}
```

Pass configuration to server via environment variables or arguments:

```json
{
  "server": {
    "mcp_config": {
      "env": {
        "ALLOWED_DIRECTORIES": "${user_config.allowed_directories}"
      }
    }
  }
}
```

### Step 3: Package Extension

```bash
npx @anthropic-ai/dxt pack
```

This command:
- Validates manifest.json
- Creates the .dxt archive
- Reports any errors

### Step 4: Test Installation

1. Drag .dxt file into Claude Desktop Settings
2. Review extension information
3. Configure required settings
4. Click "Install"

## Security Considerations

### For Users
- Sensitive data stored in OS keychain
- Extensions auto-update
- Can audit installed extensions
- Can disable individual extensions

### For Enterprises
- Group Policy (Windows) and MDM (macOS) support
- Pre-install approved extensions
- Block specific extensions or publishers
- Disable extension directory entirely
- Deploy private extension directories

## Toolchain Commands

### Initialize New Extension
```bash
dxt init [--yes]
```

### Validate Manifest
```bash
dxt validate
```

### Package Extension
```bash
dxt pack [--output filename.dxt]
```

### Extract Extension (for inspection)
```bash
dxt extract extension.dxt [--output directory]
```

## MCP Server Implementation

Extensions must implement MCP protocol via stdio transport. Use the official SDK:

```javascript
// Node.js example
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "my-extension",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "my_tool",
        description: "Tool description",
        inputSchema: {
          type: "object",
          properties: {
            param: { type: "string" }
          },
          required: ["param"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Tool implementation
  return {
    content: [
      {
        type: "text",
        text: "Tool result"
      }
    ]
  };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Limitations and Constraints

- Extensions run locally only
- No network access during installation
- Limited to stdio MCP transport
- Configuration changes require restart
- No dynamic dependency installation
- Platform-specific code requires separate builds

## Publishing Extensions

### Requirements
- Test on Windows and macOS
- Follow security guidelines
- Include proper documentation
- Validate manifest schema

### Submission Process
1. Complete extension development
2. Test across platforms
3. Submit via Google Form (linked in source)
4. Await review for quality and security

## Troubleshooting

### Common Issues

**Extension won't install:**
- Check manifest.json syntax
- Verify required fields present
- Ensure file structure matches type

**Server won't start:**
- Check entry_point path
- Verify dependencies included
- Review environment variables

**Configuration errors:**
- Validate user_config schema
- Check template variable syntax
- Ensure required fields marked

### Debug Information

Extensions log to Claude Desktop's console. Access via:
- macOS: Cmd+Option+I
- Windows: Ctrl+Shift+I

## Resources

- **Specification:** https://github.com/anthropics/dxt/blob/main/MANIFEST.md
- **Examples:** https://github.com/anthropics/dxt/tree/main/examples
- **MCP Documentation:** https://modelcontextprotocol.io
- **Enterprise Setup:** https://support.anthropic.com/en/articles/10949351

## Version Information

Current DXT specification version: 0.1

The specification is actively developed and may change. Always reference the latest documentation for current features and requirements.