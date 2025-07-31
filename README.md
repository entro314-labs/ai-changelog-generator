# AI Changelog Generator

<div align="center">

[![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@entro314labs/ai-changelog-generator)
[![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/entro314-labs/AI-changelog-generator)
[![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![OpenAI](https://img.shields.io/badge/OpenAI-74aa9c?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Claude](https://img.shields.io/badge/Claude-CC9A66?style=for-the-badge)](https://claude.ai/)
[![Google AI](https://img.shields.io/badge/Google%20AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google/)
[![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/npm/v/@entro314labs/ai-changelog-generator?style=for-the-badge&color=brightgreen)](https://www.npmjs.com/package/@entro314labs/ai-changelog-generator)

</div>

<div align="center">

<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="64" height="64" rx="12" fill="#6366F1"/>
<path d="M16 20h32v4H16v-4zm0 8h24v4H16v-4zm0 8h28v4H16v-4z" fill="white"/>
<circle cx="48" cy="44" r="8" fill="#10B981"/>
<path d="M44 44l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

**AI-powered changelog generation that analyzes your actual code changes**

Transform your git commits into professional, detailed changelogs using advanced AI analysis of diffs, file changes, and code context. Works with 10+ AI providers including OpenAI, Anthropic Claude, Google, Azure, Amazon Bedrock, and local models.

</div>

This tool revolutionizes changelog generation by analyzing actual code changes, not just commit messages. It helps developers create professional release notes automatically and provides intelligent categorization with user-focused summaries.

## Features

<table>
<tr>
<td align="center" width="50%">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" fill="#6366F1"/>
</svg>

**AI Code Analysis**
Analyzes actual diffs and code changes, not just commit messages, for intelligent categorization

</td>
<td align="center" width="50%">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="#10B981"/>
</svg>

**Multi-Provider Support**
Works with OpenAI, Claude, Google, Azure, Bedrock, and local models like Ollama

</td>
</tr>
<tr>
<td align="center">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#8B5CF6"/>
<path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
</svg>

**Multiple Output Formats**
Markdown, JSON, and customizable templates with conventional commits and emoji support

</td>
<td align="center">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="12" cy="12" r="3" fill="#F59E0B"/>
<path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="#F59E0B" stroke-width="2"/>
</svg>

**MCP Integration**
Model Context Protocol server for Claude Desktop and other MCP-compatible tools

</td>
</tr>
</table>

## Quick Start

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" fill="#059669"/>
</svg>

### Installation

```bash
# Install globally
npm install -g @entro314labs/ai-changelog-generator

# Or use directly with npx
npx @entro314labs/ai-changelog-generator init

# Or clone and run from source
git clone https://github.com/entro314-labs/AI-changelog-generator.git
cd AI-changelog-generator
npm install
```

### Basic Usage

#### Using installed package:
```bash
# Generate changelog from recent commits
ai-changelog

# Interactive mode with guided setup
ai-changelog --interactive

# Analyze working directory changes
ai-changelog working-dir

# Start MCP server
ai-changelog-mcp

# Get help
ai-changelog --help
```

#### Using bash wrappers (from source):
```bash
# Generate changelog from recent commits
./ai-changelog.sh

# Interactive mode with guided setup  
./ai-changelog.sh --interactive

# Analyze working directory changes
./ai-changelog.sh working-dir

# Start MCP server
./ai-changelog-mcp.sh

# Get help
./ai-changelog.sh --help
```

> **💡 Bash Wrappers**: The `.sh` scripts automatically validate your Node.js environment, install dependencies if needed, and provide helpful error messages. Perfect for development, CI/CD, and direct execution from source.

That's it! Your AI-powered changelog is ready to generate.

## How It Works

1. **Code Analysis**: Analyzes actual git diffs and file changes using advanced AI models
2. **Smart Categorization**: Automatically categorizes changes by type (feature, fix, refactor, etc.) and impact
3. **User-Focused Summaries**: Translates technical changes into clear, user-friendly descriptions
4. **Professional Output**: Generates conventional commit-compliant changelogs with links and formatting

## Supported Technologies

<div align="center">

<table>
<tr>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#FF6B6B">
<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FF6B6B"/>
</svg>

**AI Providers**
![OpenAI](https://img.shields.io/badge/OpenAI-74aa9c?style=flat&logo=openai&logoColor=white) ![Claude](https://img.shields.io/badge/Claude-CC9A66?style=flat) ![Google AI](https://img.shields.io/badge/Google%20AI-4285F4?style=flat&logo=google&logoColor=white)
![Azure](https://img.shields.io/badge/azure-%230072C6.svg?style=flat&logo=microsoftazure&logoColor=white) ![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=flat&logo=amazon-aws&logoColor=white) ![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat)

</td>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#339933">
<path d="M12 1.85c-.27 0-.55.07-.78.2l-7.44 4.3c-.48.28-.78.8-.78 1.36v8.58c0 .56.3 1.08.78 1.36l7.44 4.3c.46.26 1.04.26 1.5 0l7.44-4.3c.48-.28.78-.8.78-1.36V7.71c0-.56-.3-1.08-.78-1.36l-7.44-4.3c-.23-.13-.51-.2-.78-.2zm0 2.03c.13 0 .27.04.39.11l6.9 4v.81L12 12.6 4.71 8.8v-.81l6.9-4c.12-.07.26-.11.39-.11zM5.05 9.85l6.95 4.01v7.79c-.13 0-.27-.04-.39-.11l-6.9-4c-.23-.13-.39-.39-.39-.68v-6.68c0-.11.02-.22.05-.33zm13.9 0c.03.11.05.22.05.33v6.68c0 .29-.16.55-.39.68l-6.9 4c-.12.07-.26.11-.39.11v-7.79l6.95-4.01z"/>
</svg>

**Runtime**
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white) ![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=flat&logo=npm&logoColor=white) ![Yarn](https://img.shields.io/badge/yarn-%232C8EBB.svg?style=flat&logo=yarn&logoColor=white)
![PNPM](https://img.shields.io/badge/pnpm-%234a4a4a.svg?style=flat&logo=pnpm&logoColor=f69220)

</td>
</tr>
<tr>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#F1502F">
<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
</svg>

**Git Integration**
![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=flat&logo=github&logoColor=white) ![GitLab](https://img.shields.io/badge/gitlab-%23181717.svg?style=flat&logo=gitlab&logoColor=white) ![Bitbucket](https://img.shields.io/badge/bitbucket-%230047B3.svg?style=flat&logo=bitbucket&logoColor=white)
![Git](https://img.shields.io/badge/git-%23F05033.svg?style=flat&logo=git&logoColor=white)

</td>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#06B6D4">
<path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z"/>
</svg>

**Output Formats**
![Markdown](https://img.shields.io/badge/markdown-%23000000.svg?style=flat&logo=markdown&logoColor=white) ![JSON](https://img.shields.io/badge/JSON-000000?style=flat&logo=json&logoColor=white) ![YAML](https://img.shields.io/badge/yaml-%23ffffff.svg?style=flat&logo=yaml&logoColor=151515)
![Shell Script](https://img.shields.io/badge/shell_script-%23121011.svg?style=flat&logo=gnu-bash&logoColor=white)

</td>
</tr>
</table>

</div>

## Core Commands

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 6h16v2H4V6zm0 4h4v2H4v-2zm6 0h10v2H10v-2zm-6 4h4v2H4v-2zm6 0h10v2H10v-2z" fill="#374151"/>
</svg>

```bash
# Changelog generation
ai-changelog                              # Generate from recent commits
ai-changelog --since v1.0.0               # Generate since specific tag
ai-changelog --release-version 2.0.0      # Set release version

# Analysis modes
ai-changelog --detailed                    # Detailed technical analysis
ai-changelog --enterprise                  # Enterprise-grade analysis
ai-changelog --interactive                 # Interactive guided mode

# Working directory
ai-changelog working-dir                   # Analyze uncommitted changes
ai-changelog working-dir --dry-run         # Preview without saving

# Utilities
ai-changelog providers list                # List available AI providers
ai-changelog validate                      # Validate configuration
ai-changelog health                        # Repository health check
```

## Configuration

### AI Provider Setup

```bash
# Configure your preferred AI provider
ai-changelog providers configure openai

# Environment variables (.env.local)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
GOOGLE_API_KEY=your_google_key
```

### YAML Configuration (ai-changelog.config.yaml)

```yaml
changelog:
  commitTypes:
    - feat
    - fix
    - perf
    - refactor
    - docs
    - build
    - chore

  headlines:
    feat: "🚀 Features"
    fix: "🐛 Bug Fixes"
    perf: "⚡ Performance"
    refactor: "♻️ Refactoring"
    docs: "📚 Documentation"

  commitUrl: "https://github.com/user/repo/commit/%commit%"
  issueUrl: "https://github.com/user/repo/issues/%issue%"
```

## Examples

### Basic Project Setup

```bash
# Generate changelog for recent commits
ai-changelog

# Generate since specific version
ai-changelog --since v1.0.0 --release-version 2.0.0

# Interactive mode with provider selection
ai-changelog --interactive
```

### Advanced Usage

```bash
# Detailed analysis with custom model
ai-changelog --detailed --model gpt-4o

# Working directory analysis with preview
ai-changelog working-dir --dry-run --output CHANGES.md

# MCP server for Claude Desktop integration
ai-changelog-mcp
```

### CI/CD Integration

```bash
# Generate changelog in CI pipeline
ai-changelog --since $LAST_TAG --release-version $NEW_VERSION --silent

# Validate configuration
ai-changelog validate --exit-code

# Health check before release
ai-changelog health --detailed
```

## Documentation

- **[Getting Started Guide](./docs/getting-started.md)** - Complete setup and first changelog
- **[AI Provider Setup](./docs/providers.md)** - Configure OpenAI, Claude, and other providers
- **[Configuration Reference](./docs/configuration.md)** - All YAML and environment options
- **[MCP Integration](./docs/mcp-integration.md)** - Claude Desktop and MCP server setup
- **[API Reference](./docs/api-reference.md)** - All commands, options, and programmatic usage

## Contributing

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="#7C3AED"/>
</svg>

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

- [Report bugs](https://github.com/entro314-labs/AI-changelog-generator/issues)
- [Request features](https://github.com/entro314-labs/AI-changelog-generator/issues)
- [Improve documentation](./docs/)
- [Submit pull requests](https://github.com/entro314-labs/AI-changelog-generator/pulls)

## Roadmap

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z" fill="#0891B2"/>
</svg>

- [ ] **Visual Studio Code Extension** - Native VS Code integration with diff analysis
- [ ] **Semantic Release Integration** - Automatic version bumping and publishing
- [ ] **Multi-Repository Support** - Analyze and generate changelogs across multiple repos
- [ ] **Custom AI Model Training** - Fine-tuned models for specific project types

## Requirements

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 18c1.1 0 1.99-.9 1.99-2L22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2H0c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2h-4zM4 5h16v11H4V5zm8 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="#6B7280"/>
</svg>

- **Node.js**: >= 22.0.0
- **npm**: >= 8.0.0 or **pnpm** >= 7.0.0 (recommended)
- **Git**: Any recent version with repository history
- **AI Provider**: API key for at least one supported provider (or local Ollama setup)

## License

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#9CA3AF"/>
<path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
</svg>

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#059669"/>
</svg>

- **GitHub Issues**: [Report bugs and request features](https://github.com/entro314-labs/AI-changelog-generator/issues)
- **Discussions**: [Community discussions and Q&A](https://github.com/entro314-labs/AI-changelog-generator/discussions)
- **Documentation**: [Complete guides and API reference](https://github.com/entro314-labs/AI-changelog-generator#readme)
- **Examples**: [Real-world usage examples](./examples/)

---

<div align="center">

**Made with ❤️ by entro314labs**

[GitHub](https://github.com/entro314-labs) • [NPM Package](https://www.npmjs.com/package/@entro314labs/ai-changelog-generator) • [Issues](https://github.com/entro314-labs/AI-changelog-generator/issues) • [Discussions](https://github.com/entro314-labs/AI-changelog-generator/discussions)

</div>