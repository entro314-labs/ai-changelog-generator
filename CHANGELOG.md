# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Next Release
- TBD

## [3.6.0] - 2025-11-27

### Feat
- **MCPB Support**: Added full support for Model Context Protocol Bundle (MCPB) extension format.
- **Packaging**: Updated manifest and packaging for seamless MCP server integration.

### Fix
- **Dry Run**: Fixed `dry-run` mode to correctly skip file writing while preserving output preview.
- **CLI**: Fixed interactive mode timeouts in non-TTY/CI environments.
- **MCP Server**: Fixed `ReferenceError` by using dynamic imports for `child_process` in ESM environment.
- **Validation**: Fixed `WorkspaceChangelogService` validation to correctly detect git repositories.
- **UI**: Fixed `EnhancedConsole.metrics` method shadowing in CLI UI utilities.
- **Tests**: Fixed integration test failures in styling and workspace services.

### Test
- **Coverage**: Validated full test suite with 696 passing tests.
- **Mocking**: Fixed mocking strategies in styling integration tests.

### Chore
- **Dependencies**: Updated project dependencies and type definitions.
- **Audit**: Verified project robustness and MCP tool integration.

## [3.3.0] - 2025-10-19

### Refactor
- **Architecture**: Major refactor of git management with new `GitManager` and `CommitTagger` domains.
- **Services**: Re-architected `AnalysisEngine`, `ChangelogService`, and `WorkspaceChangelogService` for better separation of concerns.
- **Config**: Modernized `biome.json` and `package.json` configurations.

### Feat
- **Git Analysis**: Enhanced merge commit analysis and processing.
- **Configuration**: Added support for `merge` commit type in configuration.

### Fix
- **Reliability**: Resolved intermittent test failures and improved test suite reliability.
- **Error Handling**: Added comprehensive error classes and improved exception handling.

### Test
- **New Tests**: Added `missing-functionality.test.js` covering edge cases and new architectural components.

## [3.2.1] - 2025-08-10

### feat
- add comprehensive test coverage with 100% test success rate
- add missing method implementations across all service classes
- add modern CI/CD pipeline with automated testing and publishing
- add Biome linting configuration for code quality
- add comprehensive error handling and validation
- add robust CLI timeout handling and graceful failures
- add professional documentation and provider setup guides

### fix
- fix AI provider initialization and isAvailable method calls
- fix configuration manager null safety with proper error handling
- fix CLI test timeouts and hanging commands
- fix missing boolean getters (hasAI, gitExists) in main facade
- fix homepage URL typo in package.json
- fix CI/CD workflow paths to match current project structure
- fix Node.js version consistency across all configurations
- fix Vitest reporter deprecation warnings

### test
- add 658 comprehensive tests with 100% pass rate
- add missing service method implementations for test compatibility
- add resilient CLI end-to-end testing with proper timeouts
- add comprehensive architecture and functionality testing
- add provider integration testing and validation
- add performance and memory usage testing
- add cross-platform compatibility testing

### build
- update to Node.js 22.x across all environments
- add pnpm workspace configuration for monorepo structure
- add Vitest testing framework with coverage reporting
- add modern GitHub Actions workflows for CI/CD
- standardize package management with pnpm

### docs
- update comprehensive README with installation and usage
- add provider setup and troubleshooting documentation
- add environment variables and configuration guides
- update contributing guidelines and development setup

### chore
- update dependencies including version increments from 3.0.3 to 3.1.1
- downgrade @types/node from 24.2.0 to 22.17.1 for compatibility
- remove demo media files (GIFs, MP4s) and test scripts
- clean up unused variables in utils.js

## [3.1.2] - 2025-08-06

### build
- update package.json configuration

### ci
- improve deployment configuration

## [3.1.1] - 2025-08-06

### fix
- fix release workflow version handling
- update package configuration for proper publishing
- add publishConfig for public npm access
- remove references to non-existent test scripts

### refactor
- update utility imports from 'consolidated-utils.js' to 'utils.js'
- restructure MCP server entry point
- remove sample DXT extension files

### docs
- add comprehensive AI Provider Setup Guide
- consolidate provider configuration instructions

### chore
- add demo GIF files and video content
- expand color constants with Dracula theme variants

## [3.1.0] - 2025-08-01

### feat
- add interactive commit workflow with AI-powered commit message generation
- add commit staging and unstaging functionality
- add branch intelligence analysis for commit type suggestions
- add interactive file selection for staging
- add conventional commit format validation
- add advanced git repository analysis and health checks
- add `ai-changelog commit` command with interactive staging
- add dry-run mode and custom message support
- add provider-specific commit message optimization
- add real-time branch analysis and suggestions

### refactor
- improve orchestrator for commit workflow support
- extend application service with commit workflow methods
- add branch intelligence and staging utilities to utils
- add comprehensive commit command support to CLI controller

### perf
- optimize git operations with better error handling

### feat
- add interactive staging service for git operations
- add commit message validation service

## [3.0.3] - 2025-08-06

### fix
- fix intermittent "No working directory changes detected" issue
- resolve Azure OpenAI provider token counting issues
- improve error handling and fallback logic throughout system
- improve CLI output formatting with professional visual styling

### docs
- add comprehensive JSDoc documentation

### perf
- add robust handling of git edge cases and command failures
- clean error messages without technical implementation details
- add session management with deduplicated warnings
- improve fallback behavior when operations fail

## [3.0.0] - 2025-07-31

### feat
- add support for 10+ AI providers (OpenAI, Anthropic Claude, Google, Azure OpenAI, Amazon Bedrock, Vertex AI, Ollama, LM Studio, Hugging Face)
- add advanced code diff analysis and semantic understanding
- add intelligent commit categorization and breaking change detection
- add professional changelog formatting with multiple output formats
- add Model Context Protocol (MCP) server for Claude integration
- add real-time changelog generation through MCP tools
- add secure API key management and provider switching
- add interactive and non-interactive CLI modes
- add multiple analysis modes (standard, detailed, enterprise)
- add flexible output formats (Markdown, JSON, plain text)
- add advanced git integration with branch analysis
- add automatic model selection based on commit complexity
- add provider failover and load balancing
- add support for both cloud and local AI models
- add configurable model parameters and optimization

### refactor
- implement domain-driven design with clear separation of concerns
- add provider abstraction with base provider interface
- add model recommendation engine
- add advanced git integration with repository health assessment

### docs
- add extensive documentation and provider setup guides
- add troubleshooting documentation and environment variable reference
- add contributing guidelines with architecture overview

### build
- add shell wrapper scripts for cross-platform compatibility
- add automatic dependency detection

### feat
- add YAML-based configuration system (ai-changelog.config.yaml)
- add environment variable support with .env.local
- add customizable output templates and formatting

## [2.5.1] - 2025-08-01

### fix
- clean git error messages to display user-friendly warnings
- suppress stderr output from git commands
- simplify model availability error messages with session-based deduplication
- add `execGitShow()` method for safer operations with missing files
- add graceful handling of deleted/renamed files

### feat
- add `--health` CLI flag for repository health assessment
- add `assess_repository_health` MCP tool for AI assistants
- add 8-point commit message quality scoring system
- add repository hygiene recommendations and actionable insights
- add health scoring (0-100) with categorization

### perf
- clean console output with reduced error spam
- improve fallback messaging for model selection
- add informative warnings with actionable suggestions
- improve rule-based analysis reliability without AI providers

## [2.5.0] - 2025-08-01

### feat
- add repository health assessment with `--health` CLI flag and `assess_repository_health` MCP tool
- add real-time commit message quality detection and scoring (8-point scale)
- add automatic warnings for poor commit messages with actionable suggestions
- add repository hygiene metrics

### fix
- add graceful handling of missing files in git history
- improve error recovery for git command failures
- improve fallback analysis when git operations fail

### feat
- improve rule-based analysis to work without AI providers
- add commit message quality warnings to changelog output
- add `assess_repository_health` tool with JSON output format
- add color-coded health scores and proactive suggestions

## [2.4.0] - 2025-08-01

### feat
- add `generate_changelog_from_changes` MCP tool for working directory changelog generation
- add support for all analysis modes and model overrides in MCP tools
- add file writing behavior - MCP tools now write `AI_CHANGELOG.md` files to project root
- add `includeAttribution` parameter to `analyze_current_changes` MCP tool schema

### fix
- add attribution footer by default in MCP tools, matching CLI behavior
- eliminate functionality differences between CLI and MCP interfaces

### feat
- add `generateChangelogFromChanges()` and supporting helper methods
- add `generateWorkingDirChangelog()` for AI-powered changelog generation
- add `generateBasicChangelogFromChanges()` for rule-based fallback
- add changelog file writing to MCP tool workflows

## [2.3.1] - 2025-08-01

### feat
- add optional attribution footer to generated changelogs
- add `--no-attribution` CLI flag to disable attribution footer
- add `includeAttribution: false` MCP parameter to disable attribution

## [2.3.0] - 2025-08-01

### feat
- add `--model` CLI flag and MCP parameter for forcing specific AI models
- add model capability validation and feature support display
- add graceful fallback with capability warnings
- add `--comprehensive` CLI command and `analyze_comprehensive` MCP tool
- add repository statistics: commit count, contributor analysis, age calculation
- add branch analysis: local/remote branch enumeration, current branch detection
- add working directory status: staged/unstaged/untracked file counts
- add AI-powered health assessment with actionable recommendations
- add `--branches` CLI command and `analyze_branches` MCP tool
- add branch enumeration and unmerged commit identification
- add dangling commit detection and cleanup recommendations
- add `--untracked` CLI command with file categorization
- add risk assessment and automatic .gitignore recommendations

### fix
- fix multiline commit message handling in `parseCommitOutput()`
- fix commit retrieval format parameter in CLI argument processing
- add `analyzeRepositoryWithAI()` method implementation
- correct `generateText()` to `generateCompletion()` API calls

### refactor
- improve `selectOptimalModel()` to respect model override
- update CLI help documentation with new commands
- extend MCP server schema for new functionality

## [2.2.0] - 2025-08-01

### feat
- add Model Context Protocol server with 8 tools
- add `generate_changelog` for AI-powered changelog generation
- add `analyze_commits` for commit pattern analysis
- add `analyze_current_changes` for staged/unstaged file analysis
- add `get_git_info` for repository metadata and statistics
- add `configure_ai_provider` for AI provider testing and validation
- add `validate_models` for model availability and capability checking
- add dual CLI/MCP architecture with shared core libraries
- add intelligent model selection based on complexity with cost optimization
- add TypeScript definitions in `types/index.d.ts`

### refactor
- migrate from flat to modular package structure
- update Azure OpenAI integration to v1 API with 2025-04-01-preview version
- scope package to `@entro314-labs/ai-changelog-generator`

### build
- add `@modelcontextprotocol/sdk@1.12.1` dependency

## [2.1.0] - 2025-08-01

### feat
- add interactive CLI with commit selection
- add checkbox interface for commit cherry-picking
- add staged/unstaged change analysis
- add AI-powered commit message validation
- add configurable analysis depth modes
- add `--detailed` for comprehensive business and technical analysis
- add `--enterprise` for stakeholder-ready documentation
- add `--analyze` for current working directory analysis
- add extended git operation support
- add diff analysis with before/after context
- add file categorization by type
- add conventional commit parsing and validation
- add rule-based analysis fallback when AI unavailable

### refactor
- expand CLI options with version-specific changelog generation
- add date range filtering and output format selection
- extend AI model support with GPT-4 series and Azure OpenAI integration

### fix
- improve conventional commit detection
- improve handling of binary files
- improve resilience to git command failures

## [2.0.0] - 2025-08-01

### feat
- add OpenAI and Azure OpenAI API support
- add automated commit analysis and categorization
- add configurable changelog output formats
- add environment variable and config file support

### refactor
- migrate from manual to automated changelog generation
- redesign API for programmatic usage

### feat
- add direct git command integration
- add asynchronous batch processing
- add template-based markdown generation
- add comprehensive error recovery mechanisms

## [1.0.0] - 2025-07-31

### feat
- add basic changelog generation with git integration
- add command-line argument processing
- add markdown changelog generation
- add npm publishing setup with public access

### fix
- add publishConfig for npm publishing
- remove missing script references in package.json
- correct build and deployment processes

### feat
- add git commit history parsing
- add changelog file management
- add CLI argument handling

---

## VDK CLI Component

### [2.0.0]

### feat
- add detection for 20+ technology-specific rules including Tailwind CSS, shadcn/ui, Supabase, TypeScript
- add automatic package manager detection (pnpm, yarn, npm, bun) based on lock files
- add build tool recognition (Turbopack, Vite, Next.js) with version-specific features
- add IDE detection for VS Code, Cursor, Windsurf, JetBrains, Zed
- add library-specific guidelines for UI libraries like shadcn/ui and Radix UI
- increase rule limit from 10 to 20 for better technology coverage
- add real script extraction from package.json
- add AI Assistant field to generated configurations

### fix
- resolve GitHub Copilot adapter undefined property errors with optional chaining
- improve framework and library matching with better aliases
- fix library guidelines appearing in CLAUDE.md files
- add graceful degradation for edge cases and invalid paths

### perf
- improve relevance scoring algorithm with platform-specific filtering
- improve content processing with mobile pattern exclusion
- improve template processing for actionable guideline extraction
- add error recovery for missing dependencies

### docs
- add comprehensive MDX documentation system
- add blueprint specifications for all rule formats
- add IDE configuration reference guides
- add GitHub repository documentation templates

### refactor
- improve project documentation structure
- add integration guides with practical examples

### [1.0.0]

### feat
- add project analysis and pattern detection engine
- add multi-format rule generation (Markdown, MDC, XML, JSON)
- add AI assistant integrations (Claude Code, Cursor, Windsurf, GitHub Copilot)
- add VDK Hub for team collaboration and rule sharing
- add watch mode for continuous project monitoring
- add comprehensive CLI with 20+ commands
- add project templates for popular frameworks
- add rule validation and error checking
- add integration auto-detection and setup
- add configuration management system

### feat
- add project scanner with intelligent codebase analysis
- add rule generator with context-aware rule creation
- add integration manager for AI assistant setup and management
- add hub client for team collaboration through rule sharing
- add watch system for real-time monitoring and automatic updates
- add validation engine for rule and configuration validation

### feat
- add support for frontend frameworks (React, Vue, Angular, Svelte, Next.js, Nuxt.js, SvelteKit)
- add support for backend frameworks (Node.js, Express, FastAPI, Django, Rails)
- add support for languages (TypeScript, JavaScript, Python, Go, Rust)
- add support for tools (Tailwind CSS, Prisma, tRPC, GraphQL, Docker)

### feat
- add team creation and management
- add rule sharing and discovery
- add version control and rollback
- add public and private deployments
- add search and filtering
- add analytics and usage insights
- add collaborative rule development

---

*Generated using [ai-changelog-generator](https://github.com/entro314-labs/AI-changelog-generator) - AI-powered changelog generation for Git repositories*