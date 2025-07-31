# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.3]

### 🔧 **Maintenance & Bug Fixes**

**Key Changes:**
- Fixed intermittent "No working directory changes detected" issue caused by similar function mixups
- Enhanced CLI output formatting with professional visual styling
- Resolved Azure OpenAI provider token counting issues
- Improved error handling and fallback logic throughout the system
- Added comprehensive JSDoc documentation for better code maintainability

**Technical Improvements:**
- ✅ Fixed working directory change detection reliability
- ✅ Enhanced token usage tracking for Azure provider
- ✅ Improved CLI visual formatting with boxed metrics and color-coded outputs
- ✅ Standardized error messaging and provider warnings
- ✅ Added robust fallback handling for AI analysis failures
- ✅ Cleaned up debug output and improved user experience

**Breaking Changes:** None - this is a maintenance release

**Commits:**
- (refactor) Enhanced WorkspaceChangelogService with diff analysis and comprehensive cleanup
- (fix) Resolved Azure provider token counting and working directory detection issues
- (docs) Added JSDoc comments and improved code documentation
- (chore) Updated organization references and package metadata

---

## [Unreleased]

### 📋 Release Summary
Release latest includes 2 commits (1 docs, 1 feature). Complexity: high. Affected areas: configuration, documentation, other, source, build.

**Business Impact**: minor
**Complexity**: high

### Added
- Complete codebase and project structure for VibeKit VDK CLI
- 189 new files totaling 40,860 lines including CLI source code (cli.js)
- Installation and release scripts (install.sh, release.sh)
- Comprehensive documentation (README.md, GUIDE.md, ROADMAP.md, VDK_OVERVIEW.md, CONTRIBUTING.md)
- GitHub workflow and templates
- JavaScript CLI entry point with dotenv, commander support
- Package.json with bin entry for 'vdk' command

### Changed
- Updated repository references from 'idominikosgr' to 'entro314-labs' across 154 files
- Added new documentation files: VDK_AI_ASSISTANT_COMPATIBILITY_REPORT.md, VDK_DOCUMENTATION.md
- Updated installation instructions, badges, and URLs to new organization
- Minor dependency version bump for 'dotenv' in pnpm-lock.yaml
- Updated code comments and API URLs in JavaScript source files

### Removed
- Large 'GUIDE.md' file (net reduction of over 20,000 lines)

---

## [Unreleased]

### 📋 Release Summary
Release includes 4 new features, 1 bug fix, extensive refactoring

**Business Impact**: major
**Complexity**: high
**Deployment Requirements**: Database migration required

### 🚀 Features

#### CLI Reliability Improvements
- Fixed infinite loop issues in CLI interactions
- Removed conflicting readline interface
- Added detection for non-interactive environments
- Enhanced error handling for automated/scripted use cases

#### Template and Setup Standardization
- Refactored handlebar templates for consistency
- Updated references from 'VibeCodingRules' to 'Vibe-Coding-Rules'
- Introduced interactive setup wizard (setup-wizard.js)
- Improved project configuration experience

#### Project Planning and Documentation
- Added detailed ROADMAP.md outlining future development goals
- Updated README to reference roadmap
- Enhanced core agent documentation rules for clarity

#### Project Rebranding
- Renamed project from DevRulesPlus to CodePilotRules
- Updated all documentation, scripts, and setup files
- Maintained consistency across codebase

### 🐛 Bug Fixes
- Fixed execution order in installation script
- Ensured dependencies install before CLI execution
- Improved script reliability and error prevention

### ♻️ Code Refactoring

#### Documentation and Repository Cleanup
- Updated .gitignore to exclude additional documentation files
- Streamlined documentation with obsolete scripts removed
- Improved user guides for clarity and accuracy
- Standardized repository references across project files

#### Major Architectural Changes
- **BREAKING CHANGE**: Comprehensive refactor affecting 208 files
- Reduced codebase size and complexity (+2820/-12538 lines)
- Database schema and configuration updates
- Introduced new roadmap and publishing workflow

#### Branding Evolution
- Complete rebranding from 'Vibe Coding Rules' to 'VibeKit VDK CLI'
- Updated environment variables, configuration, and project metadata
- Added new documentation (CLI Reference, Getting Started)

#### Rule System Enhancements
- Extensive reorganization of configuration and rule files
- Added installation and sync system documentation
- Updated setup wizard and package scripts
- Comprehensive 'Vibe Coding Rules' for AI assistant standardization

#### Initial Foundation
- **BREAKING CHANGE**: Initial project setup with 109 files, 19,000 lines
- Core agent instructions and project context templates
- Language-specific best practices (TypeScript, Python, Swift, Kotlin, C++)
- AI assistant integrations (Cursor, Copilot, Windsurf)
- Model Context Protocol (MCP) servers configuration

### ⚠️ Migration Requirements
- Review database schema changes before deployment
- Update environment variables to new naming conventions
- Follow new INSTALLATION.md and SYNC-SYSTEM.md guides
- Update CI/CD pipelines referencing old project names
- Full regression testing recommended due to scope of changes

### 🎯 Affected Areas
- Database, configuration, documentation, source code, assets, scripts

---

## [3.0.0]

### 🚀 **Major Release: Universal AI Provider Ecosystem**

This major release transforms the tool into a universal AI changelog generator supporting 10+ AI providers with the latest 2025 models, enhanced architecture, and production-ready reliability.

#### ✨ **New AI Provider Support**

**Complete Provider Ecosystem (10+ providers)**
- ✨ **NEW**: Anthropic Claude integration with Sonnet 4 and Opus 4 (2025 latest models)
- ✨ **NEW**: Google AI (Gemini) with 2.5 Pro/Flash and thinking mode support
- ✨ **NEW**: Google Vertex AI with enterprise features and custom endpoints
- ✨ **NEW**: Hugging Face multi-provider routing (Replicate, Together, SambaNova, Fal)
- ✨ **NEW**: Ollama local model support (Llama, Mistral, CodeLlama, custom models)
- ✨ **NEW**: LM Studio local deployment with OpenAI-compatible API
- ✨ **ENHANCED**: OpenAI with GPT-4.1 series and o1 reasoning models
- ✨ **ENHANCED**: Azure OpenAI with exclusive o3/o4 models and v1 API support

**Latest 2025 Model Support**
- **OpenAI**: GPT-4.1 (nano, mini, standard), o1 reasoning models
- **Azure**: GPT-4.1 series + exclusive o3/o4 reasoning models
- **Anthropic**: Claude Sonnet 4, Claude Opus 4 (latest 2025 releases)
- **Google**: Gemini 2.5 Pro/Flash with multimodal and thinking capabilities
- **Hugging Face**: Qwen 2.5, Llama 3.3, Mixtral, 200k+ models via routing
- **Local**: Any Ollama or LM Studio compatible model

#### 🏗️ **Architecture Transformation**

**Plugin-Based Provider System**
- ✨ **NEW**: Universal base provider interface with consistent capabilities
- ✨ **NEW**: Automatic provider detection and smart selection
- ✨ **NEW**: Graceful fallback chain with priority ordering
- ✨ **NEW**: Provider-specific model recommendations and optimization
- ✨ **NEW**: Unified error handling and recovery across all providers

**Enhanced Configuration System**
- ✨ **NEW**: Zero-configuration auto-detection of available providers
- ✨ **NEW**: Flexible provider priority ordering
- ✨ **NEW**: Environment-based configuration for all providers
- ✨ **NEW**: Comprehensive validation and testing tools

#### 🔧 **Production Enhancements**

**Reliability & Error Handling**
- ✨ **IMPROVED**: Robust error handling with provider-specific recovery
- ✨ **IMPROVED**: Connection testing and validation for all providers
- ✨ **IMPROVED**: Model availability checking with alternatives
- ✨ **NEW**: Comprehensive diagnostic and troubleshooting tools

**Performance Optimization**
- ✨ **NEW**: Local model support eliminates API costs and latency
- ✨ **NEW**: Smart model selection optimizes cost and performance
- ✨ **NEW**: Multi-provider routing for best price/performance ratio
- ✨ **NEW**: Automatic fallback to rule-based analysis when needed

#### 🔄 **Enhanced MCP Integration**

**Extended MCP Tools**
- ✨ **NEW**: `switch_provider` tool for dynamic provider switching
- ✨ **NEW**: `list_providers` tool for provider status and capabilities
- ✨ **NEW**: Enhanced `configure_ai_provider` with multi-provider support
- ✨ **NEW**: `validate_models` tool with comprehensive capability checking
- ✨ **ENHANCED**: All existing tools now support provider selection

**Provider Management**
- ✨ **NEW**: Real-time provider switching in MCP sessions
- ✨ **NEW**: Provider capability reporting and model validation
- ✨ **NEW**: Comprehensive provider status and health monitoring
- ✨ **NEW**: Dynamic model selection based on commit complexity

#### 🛠️ **Developer Experience**

**Enhanced CLI Interface**
- ✨ **NEW**: Provider validation and status commands
- ✨ **NEW**: Model override with capability validation
- ✨ **NEW**: Comprehensive provider testing and diagnostics
- ✨ **IMPROVED**: Better error messages with actionable suggestions

**Advanced Features**
- ✨ **NEW**: Provider-aware model recommendations
- ✨ **NEW**: Cost optimization through provider selection
- ✨ **NEW**: Privacy-first local model options
- ✨ **NEW**: Enterprise-ready multi-provider deployments

#### 📦 **Updated Dependencies**

- **Added**: `@anthropic-ai/sdk@0.56.0` (Claude Sonnet 4 support)
- **Added**: `@google/genai@1.10.0` (Gemini 2.5 series)
- **Added**: `@huggingface/inference@4.5.3` (Multi-provider routing)
- **Added**: `ollama@0.5.16` (Local model support)
- **Added**: `@lmstudio/sdk@1.3.0` (LM Studio integration)
- **Updated**: `@modelcontextprotocol/sdk@1.16.0` (Latest MCP features)
- **Updated**: `openai@5.10.1` (GPT-4.1 and o1 support)
- **Updated**: Node.js requirement to 22+ for latest features

#### 🔄 **Migration Guide**

**From v2.x to v3.0.0**
- **Configuration**: Existing OpenAI/Azure configs continue to work unchanged
- **New Providers**: Add API keys for new providers you want to use
- **MCP Integration**: New tools available, existing tools enhanced
- **CLI Interface**: All existing commands work identically

**Recommended Migration Steps**
1. Update to Node.js 22+ if needed
2. Install v3.0.0: `npm install -g ai-changelog-generator@3.0.0`
3. Test existing configuration: `ai-changelog --validate`
4. Optionally add new provider API keys for expanded capabilities
5. Explore new providers: `ai-changelog configure`

#### 📊 **Impact**

- **10x Provider Support**: From 2 to 10+ AI providers
- **Latest Models**: Support for all 2025 flagship models
- **Zero Config**: Works out of the box with any available provider
- **Cost Optimization**: Local models and smart selection reduce costs
- **Enterprise Ready**: Multi-provider support for diverse requirements

#### 🎯 **Breaking Changes**

- **Node.js Requirement**: Now requires Node.js 22+ (was 18+)
- **Provider Interface**: Internal provider API changed (affects custom providers only)
- **No User Impact**: All CLI commands and MCP tools work identically

---

## [2.5.1]

### 🚀 **Point Release: Enhanced User Experience & Error Handling**

This point release significantly improves the tool's reliability and user experience with cleaner output, better error handling, and enhanced repository insights.

#### 🛠️ **Improvements**

**Enhanced Error Handling & User Experience**
- 🐛 **IMPROVED**: Git error messages now display clean, user-friendly warnings instead of raw technical output
- 🐛 **IMPROVED**: Suppressed stderr output from git commands to eliminate noise
- 🐛 **IMPROVED**: Model availability errors show simplified messages with session-based deduplication
- ✨ **NEW**: Added `execGitShow()` method for safer git operations with missing files
- ✨ **NEW**: Graceful handling of deleted/renamed files with contextual messaging

**Repository Health Enhancements**
- ✨ **NEW**: Added `--health` CLI flag for comprehensive repository health assessment
- ✨ **NEW**: Added `assess_repository_health` MCP tool for AI assistants
- ✨ **NEW**: 8-point commit message quality scoring system with real-time feedback
- ✨ **NEW**: Repository hygiene recommendations and actionable insights
- ✨ **NEW**: Health scoring (0-100) with categorization: Poor/Fair/Good/Excellent

**Developer Experience**
- ✨ **IMPROVED**: Cleaner console output with reduced error spam
- ✨ **IMPROVED**: Better fallback messaging for model selection
- ✨ **IMPROVED**: More informative warnings with actionable suggestions
- ✨ **IMPROVED**: Enhanced rule-based analysis reliability without AI providers

#### 🔧 **Technical Enhancements**

- **Error Recovery**: Robust handling of git edge cases and command failures
- **Output Sanitization**: Clean error messages without technical implementation details
- **Session Management**: Deduplicated warnings to prevent console spam
- **Graceful Degradation**: Better fallback behavior when operations fail

#### 📊 **Impact**

- **No Breaking Changes**: Full backward compatibility maintained
- **Improved Reliability**: Prevents crashes from git edge cases
- **Better UX**: Professional, clean output suitable for all skill levels
- **Enhanced Insights**: Repository health provides actionable development guidance

#### 🆙 **Migration Notes**

- No migration required - all improvements are additive
- New `--health` flag available for CLI users
- MCP users gain access to `assess_repository_health` tool
- All existing functionality works identically

---

## [2.5.0]

### 🆕 Major Improvements

**Repository Health Assessment & Commit Quality Analysis**
- ✨ **NEW**: Added comprehensive repository health assessment with `--health` CLI flag and `assess_repository_health` MCP tool
- ✨ **NEW**: Real-time commit message quality detection and scoring (8-point scale)
- ✨ **NEW**: Automatic warnings for poor commit messages with actionable suggestions
- ✨ **NEW**: Repository hygiene metrics including working directory status, commit frequency, and code diversity

**Enhanced Error Handling & Resilience**
- 🐛 **FIXED**: Graceful handling of missing files in git history (no more crashes on deleted/moved files)
- 🐛 **FIXED**: Improved error recovery for git command failures
- 🐛 **FIXED**: Better fallback analysis when git operations fail
- ✨ **NEW**: Comprehensive warnings and recovery suggestions

**Rule-Based Analysis Improvements**
- ✨ **NEW**: Enhanced rule-based analysis that works without AI providers
- ✨ **NEW**: Commit message quality warnings integrated into changelog output
- ✨ **NEW**: Repository health recommendations in generated output
- ✨ **NEW**: Better fallback behavior when AI analysis fails

**MCP Server Enhancements**
- ✨ **NEW**: Added `assess_repository_health` MCP tool for comprehensive health analysis
- ✨ **NEW**: Repository health metrics accessible via MCP for AI assistants
- ✨ **NEW**: Standardized JSON output format for health assessments
- ✨ **NEW**: Configurable analysis depth and recommendations

**Developer Experience**
- ✨ **NEW**: Clearer CLI help text with health assessment options
- ✨ **NEW**: Color-coded health scores and recommendations
- ✨ **NEW**: Proactive suggestions for repository hygiene improvements
- ✨ **NEW**: Better user guidance for poor commit message patterns

### 🔧 Technical Enhancements

- **Commit Message Analysis**: 8-point scoring system evaluating length, descriptiveness, conventional format compliance, and informational value
- **Repository Health Metrics**: Comprehensive scoring including commit quality, working directory status, activity patterns, and code diversity
- **Error Recovery**: Robust handling of git edge cases, deleted files, and command failures
- **Fallback Analysis**: Improved rule-based analysis that provides value even without AI providers
- **Attribution Updates**: Corrected repository references to match current GitHub location

### 📊 Impact

This release significantly improves the tool's reliability and usefulness by:
- **Preventing crashes** from git edge cases and missing files
- **Providing actionable insights** about repository health and commit quality
- **Working reliably** even without AI provider configuration
- **Offering proactive guidance** for better development practices

### 🆙 Migration Notes

- No breaking changes in this release
- New `--health` flag available for CLI users
- MCP users gain access to new `assess_repository_health` tool
- All existing functionality remains unchanged

---

## [2.4.0]

### Added
- **Complete MCP Server Feature Parity**: Achieved 100% feature parity between CLI and MCP server
  - New `generate_changelog_from_changes` MCP tool for working directory changelog generation
  - Equivalent to CLI's `--analyze` functionality with full AI-powered changelog creation
  - Supports all analysis modes (standard, detailed, enterprise) and model overrides
- **File Writing Behavior**: MCP tools now write `AI_CHANGELOG.md` files to project root
  - Both `generate_changelog` and `generate_changelog_from_changes` create persistent files
  - Ensures consistent behavior and proper attribution preservation
  - Prevents chat AI from modifying or stripping attribution from official output
- **Enhanced Attribution Support**: Fixed missing `includeAttribution` parameter in MCP tools
  - Added `includeAttribution` parameter to `analyze_current_changes` MCP tool schema
  - All MCP tools now support attribution control with proper defaults
  - Maintains promotional attribution while providing opt-out option

### Changed
- **MCP Tool Documentation**: Updated README with comprehensive MCP tool reference
  - Clarified distinction between analysis tools and changelog generation tools
  - Added file writing behavior documentation and feature parity notes
  - Updated examples to demonstrate working directory changelog generation
- **Tool Schema Enhancement**: Extended MCP tool schemas with missing parameters
  - More consistent parameter handling across all MCP tools
  - Better validation and documentation for tool parameters

### Fixed
- **Attribution Consistency**: Resolved discrepancy between CLI and MCP attribution behavior
  - MCP tools now include attribution footer by default, matching CLI behavior
  - Fixed missing attribution in working directory analysis workflows
- **Feature Gap**: Eliminated functionality differences between CLI and MCP interfaces
  - MCP server can now generate changelogs from working directory changes
  - No more reliance on chat AI interpretation of analysis data

### Technical Implementation
- **New MCP Methods**: Added `generateChangelogFromChanges()` and supporting helper methods
  - `generateWorkingDirChangelog()`: AI-powered changelog generation from file changes
  - `generateBasicChangelogFromChanges()`: Rule-based fallback for working directory changes
  - `getChangeDescription()`: Utility for describing file change types
- **File I/O Integration**: Added changelog file writing to MCP tool workflows
  - Consistent `AI_CHANGELOG.md` output across CLI and MCP interfaces
  - Proper error handling for file writing operations
  - Enhanced metadata with file path information

---

## [2.3.1]

### Added
- **Attribution Footer**: Added optional attribution footer to generated changelogs
  - Displays link to the project: "Generated using [ai-changelog-generator](https://github.com/entro314-labs/AI-changelog-generator)"
  - Enabled by default for promotional purposes while respecting user preferences
  - CLI flag `--no-attribution` to disable attribution footer
  - MCP parameter `includeAttribution: false` to disable attribution in MCP server
  - Promotes the tool while providing opt-out option for users who prefer clean output

---

## [2.3.0]

### Added
- **Model Override System**: CLI flag `--model` and MCP parameter for forcing specific AI models
  - Bypasses intelligent model selection logic when explicit model specified
  - Validates model capabilities and displays feature support (reasoning, context, caching)
  - Graceful fallback with capability warnings when model unavailable
- **Comprehensive Repository Analysis**: New `--comprehensive` CLI command and `analyze_comprehensive` MCP tool
  - Repository statistics: commit count, contributor analysis, age calculation
  - Branch analysis: local/remote branch enumeration, current branch detection
  - Working directory status: staged/unstaged/untracked file counts
  - AI-powered health assessment with actionable recommendations
- **Branch Analysis Tools**: New `--branches` CLI command and `analyze_branches` MCP tool
  - Enumerates all local and remote branches
  - Identifies unmerged commits across branches
  - Detects dangling commits unreachable from branch heads
  - Provides cleanup recommendations for repository maintenance
- **Untracked File Analysis**: New `--untracked` CLI command
  - Categorizes untracked files by type (source, config, docs, build artifacts, temp)
  - Risk assessment for each file category
  - Automatic .gitignore recommendations
  - AI-powered analysis when available
- **Enhanced Interactive Mode**: Repository status display in interactive interface
  - Shows current branch, staged/unstaged counts before menu presentation
  - Improved UX with contextual information for better decision making

### Fixed
- **Git Commit Parsing**: Fixed multiline commit message handling in `parseCommitOutput()`
  - Changed from `%b` to `%B` format specifier for proper body extraction
  - Added null byte separator support for complex commit messages
  - Resolves issue where commits with multiline descriptions were truncated
- **CLI Argument Processing**: Fixed `getCommitsSince()` format parameter
  - Changed from 'simple' to 'full' format to ensure hash field availability
  - Resolves "No commits found" error when commits existed in repository
- **Missing Method Implementation**: Added `analyzeRepositoryWithAI()` method
  - Implements AI-powered repository health analysis
  - Uses `generateCompletion()` API with proper message formatting
  - Provides structured health assessment with scoring and recommendations
- **AI Provider Method Calls**: Corrected `generateText()` to `generateCompletion()`
  - Updated untracked file analysis to use proper AI provider API
  - Fixed repository analysis to use correct message format structure

### Changed
- **Model Selection Logic**: Enhanced `selectOptimalModel()` to respect model override
  - Priority: manual override > intelligent selection > fallback
  - Added model capability validation and user feedback
  - Improved error handling for unavailable models
- **CLI Help Documentation**: Updated help text to include new commands
  - Added `--model` flag documentation with examples
  - Included `--branches`, `--comprehensive`, `--untracked` command descriptions
  - Updated examples section with model override usage patterns
- **MCP Server Schema**: Extended tool definitions for new functionality
  - Added `model` parameter to `generate_changelog` tool
  - Added `analyze_branches` and `analyze_comprehensive` tool definitions
  - Enhanced parameter validation and documentation

### Technical Implementation
- **Git Manager Extensions**: Added methods for comprehensive repository analysis
  - `getAllBranches()`: Returns local/remote branch enumeration
  - `getDanglingCommits()`: Identifies unreachable commits
  - `getRepositoryStats()`: Calculates repository metrics
- **AI Provider Integration**: Enhanced model override support
  - Model capability detection and validation
  - Intelligent fallback selection when override unavailable
  - Performance optimization with model-specific settings
- **Error Handling**: Improved robustness across git operations
  - Graceful degradation when git commands fail
  - Better error messages for troubleshooting
  - Consistent fallback behavior for offline scenarios

---

## [2.2.0]

### Added
- **MCP Server Implementation**: Complete Model Context Protocol server with 8 tools
  - `generate_changelog`: AI-powered changelog generation from git history
  - `analyze_commits`: Commit pattern analysis with configurable limits
  - `analyze_current_changes`: Staged/unstaged file analysis
  - `get_git_info`: Repository metadata and statistics
  - `configure_ai_provider`: AI provider testing and validation
  - `validate_models`: Model availability and capability checking
- **Dual CLI/MCP Architecture**:
  - `bin/ai-changelog.js`: Traditional CLI interface
  - `bin/ai-changelog-mcp.js`: MCP server executable
  - Shared core libraries for consistent functionality
- **Intelligent Model Selection**: Complexity-based model assignment
  - File count and line change analysis for model selection
  - Breaking change detection for advanced reasoning models
  - Cost optimization through efficient model usage
- **Model Support Matrix**:
  - `gpt-4.1-nano`: <3 files, <50 lines
  - `gpt-4.1-mini`: 3-10 files, <200 lines
  - `gpt-4.1`: 10-20 files, <1000 lines
  - `o4-mini`: 20+ files, architectural changes
- **TypeScript Definitions**: Complete type definitions in `types/index.d.ts`
- **Configuration System**: Environment variable and .env.local support

### Changed
- **Package Architecture**: Migrated from flat to modular structure
  - Core modules: `ai-provider.js`, `git-manager.js`, `templates.js`, `config.js`
  - Separated concerns: CLI, MCP server, shared libraries
  - Improved maintainability and testability
- **Azure OpenAI Integration**: Updated to v1 API with 2025-04-01-preview version
  - GPT-4.1 series support with 1M token context
  - Prompt caching for 75% cost reduction
  - Enhanced error handling and fallback mechanisms
- **Package Namespace**: Scoped to `@entro314-labs/ai-changelog-generator`
- **Import Resolution**: Relative paths for improved portability

### Fixed
- **Path Dependencies**: Eliminated absolute path requirements
- **Error Boundaries**: Improved error handling for network failures
- **Test Compatibility**: Updated test imports for new structure

### Technical Details
- **Dependencies**: Added `@modelcontextprotocol/sdk@1.12.1`
- **API Compatibility**: Supports both OpenAI and Azure OpenAI endpoints
- **Context Window**: 1M token support for large repository analysis
- **Caching Strategy**: Prompt caching implementation for cost optimization

---

## [2.1.0]

### Added
- **Interactive Mode**: Full interactive CLI with commit selection
  - Checkbox interface for commit cherry-picking
  - Staged/unstaged change analysis
  - AI-powered commit message validation
  - Commit suggestion generation
- **Analysis Modes**: Configurable analysis depth
  - `--detailed`: Comprehensive business and technical analysis
  - `--enterprise`: Stakeholder-ready documentation
  - `--analyze`: Current working directory analysis
- **Enhanced Git Integration**: Extended git operation support
  - Diff analysis with before/after context
  - File categorization by type (source, docs, tests, config)
  - Conventional commit parsing and validation
- **AI Provider Fallback**: Rule-based analysis when AI unavailable
  - Pattern recognition for commit classification
  - Basic impact assessment
  - Maintains functionality in offline scenarios

### Changed
- **Command Interface**: Expanded CLI options
  - Version-specific changelog generation
  - Date range filtering
  - Output format selection
- **AI Model Support**: Extended model compatibility
  - GPT-4 series support
  - Azure OpenAI integration
  - Model-specific optimizations

### Fixed
- **Commit Parsing**: Improved conventional commit detection
- **File Processing**: Better handling of binary files
- **Error Recovery**: Enhanced resilience to git command failures

---

## [2.0.0]

### Added
- **Core AI Integration**: OpenAI and Azure OpenAI API support
- **Git Analysis Engine**: Automated commit analysis and categorization
- **Template System**: Configurable changelog output formats
- **Configuration Management**: Environment variable and config file support

### Changed
- **Breaking**: Migrated from manual to automated changelog generation
- **API**: Redesigned for programmatic usage

### Technical Implementation
- **Git Operations**: Direct git command integration
- **AI Processing**: Asynchronous batch processing
- **Output Generation**: Template-based markdown generation
- **Error Handling**: Comprehensive error recovery mechanisms

---

## [1.0.0]

### Added
- **Initial Implementation**: Basic changelog generation
- **Git Integration**: Commit history parsing
- **CLI Interface**: Command-line argument processing
- **File Output**: Markdown changelog generation

### Technical Foundation
- **Node.js Runtime**: Core JavaScript implementation
- **Git Commands**: Shell command execution
- **File System**: Changelog file management
- **Process Management**: CLI argument handling

---

## VDK CLI Component

## [2.0.0]

### Major Improvements ✨
- **Enhanced Technology Detection**: Accurately detects 20+ technology-specific rules including Tailwind CSS, shadcn/ui, Supabase, TypeScript configurations
- **Intelligent Package Manager Detection**: Automatically detects pnpm, yarn, npm, bun based on lock files
- **Advanced Build Tool Recognition**: Detects Turbopack, Vite, Next.js with version-specific features
- **Smart IDE Detection**: Enhanced IDE detection without configuration folders, supports VS Code, Cursor, Windsurf, JetBrains, Zed

### New Features 🚀
- **Library-Specific Guidelines**: Dedicated processing for UI libraries like shadcn/ui and Radix UI
- **Comprehensive Rule Coverage**: Increased rule limit from 10 to 20 for better technology coverage
- **Real Script Extraction**: Reads actual npm/pnpm scripts from package.json instead of defaults
- **AI Assistant Integration**: Added AI Assistant field to generated configurations

### Bug Fixes 🐛
- **GitHub Copilot Adapter**: Resolved "Cannot read properties of undefined" errors with optional chaining
- **Rule Matching**: Improved framework and library matching with better aliases and normalization
- **Content Extraction**: shadcn/ui and other library guidelines now properly appear in CLAUDE.md files
- **Error Handling**: Graceful degradation for edge cases and invalid paths

### Technical Improvements 🔧
- **Rule Scoring**: Enhanced relevance scoring algorithm with platform-specific filtering
- **Content Processing**: Mobile patterns properly excluded from web projects
- **Template Processing**: Better extraction of actionable guidelines from remote rules
- **Error Recovery**: Continues operation with missing dependencies or invalid configurations

### Added
- Comprehensive MDX documentation system
- Blueprint specifications for all rule formats
- IDE configuration reference guides
- GitHub repository documentation templates

### Changed
- Improved project documentation structure
- Enhanced integration guides with practical examples

---

## [1.0.0]

### Added
- Initial release of VDK CLI
- Project analysis and pattern detection engine
- Multi-format rule generation (Markdown, MDC, XML, JSON)
- AI assistant integrations:
  - Claude Code with memory management
  - Cursor with MDC format support
  - Windsurf with XML-enhanced rules
  - GitHub Copilot with JSON configuration
  - Generic Markdown format for any AI assistant
- VDK Hub for team collaboration and rule sharing
- Watch mode for continuous project monitoring
- Comprehensive CLI with 20+ commands
- Project templates for popular frameworks
- Rule validation and error checking
- Integration auto-detection and setup
- Configuration management system

### Core Features
- **Project Scanner**: Intelligent analysis of codebase structure, patterns, conventions
- **Rule Generator**: Context-aware rule creation based on project analysis
- **Integration Manager**: Seamless setup and management of AI assistant integrations
- **Hub Client**: Team collaboration through rule sharing and synchronization
- **Watch System**: Real-time monitoring and automatic rule updates
- **Validation Engine**: Comprehensive rule and configuration validation

### Supported Frameworks
- **Frontend**: React, Vue, Angular, Svelte, Next.js, Nuxt.js, SvelteKit
- **Backend**: Node.js, Express, FastAPI, Django, Rails
- **Languages**: TypeScript, JavaScript, Python, Go, Rust
- **Tools**: Tailwind CSS, Prisma, tRPC, GraphQL, Docker

### CLI Commands
- `vdk init` - Initialize VDK in project with intelligent detection
- `vdk scan` - Analyze project and generate rules
- `vdk deploy` - Deploy rules to VDK Hub
- `vdk update` - Update rules from hub
- `vdk status` - Check project and integration status
- `vdk integrations` - Manage AI assistant integrations
- `vdk claude-code` - Claude Code specific management
- `vdk cursor` - Cursor IDE integration management
- `vdk windsurf` - Windsurf IDE integration management
- `vdk config` - Configuration management
- `vdk validate` - Validate rules and setup
- `vdk hub` - Hub collaboration commands
- `vdk watch` - Enable watch mode
- `vdk doctor` - Diagnose and troubleshoot issues
- `vdk clean` - Clean up generated files and caches

### Integration Features
- **Claude Code**: Memory file management, custom commands, watch mode
- **Cursor**: MDC format with directives, auto-completion, rule validation
- **Windsurf**: XML-enhanced rules, multi-agent support, persona routing
- **GitHub Copilot**: JSON configuration, VS Code integration, pattern learning
- **Auto-detection**: Automatic IDE detection and setup suggestions
- **Multi-integration**: Support for multiple AI assistants simultaneously

### Hub Features
- Team creation and management
- Rule sharing and discovery
- Version control and rollback
- Public and private deployments
- Search and filtering
- Analytics and usage insights
- Collaborative rule development

---

## [0.9.0]

### Added
- Beta release for early adopters
- Core project analysis engine
- Basic rule generation
- Initial Claude Code integration
- Simple CLI interface

### Changed
- Refactored scanner architecture
- Improved pattern detection algorithms

### Fixed
- Memory leaks in large project scanning
- Rule generation edge cases

---

## [0.8.0]

### Added
- Alpha release for testing
- Proof of concept implementation
- Basic framework detection
- Simple rule templates

---

## Known Issues

- Large TypeScript projects (>10k files) may experience slower scanning
- Windows path handling edge cases in monorepo scenarios
- Hub sync conflicts in high-concurrency team environments

### 🔧 Working Directory Changes

- (docs) Added and updated project documentation - Created a new comprehensive README.md with usage, configuration, and contribution guidelines. Added Untitled-1.md with project purpose and notes. Deleted outdated AI_CHANGELOG.md.backup. (85%)

- (feature) Introduced YAML-based configuration support - Added ai-changelog.config.yaml with customizable commit conventions and link generation options. Updated configuration.manager.js to load and parse YAML config, merging it with existing settings. Extended CLI and changelog orchestrator logic to utilize new configuration structure. (85%)

- (feature) Improved changelog generation with diff analysis and provider enhancements - Updated changelog.orchestrator.js and workspace-changelog.service.js to support enhanced diff processing and integration with AI providers. Refined changelog.service.js to better handle change data and formatting. (85%)

- (feature) Expanded provider support and CLI options - Enhanced provider-manager.service.js and ollama.js to support additional AI providers and improved error handling. Updated cli.controller.js to expose new configuration and provider selection options. (85%)

- (fix) Resolved utility and workflow issues - Fixed bugs in utils.js related to object merging and string formatting. Improved interactive-workflow.service.js for more robust user prompts and error handling. (85%)

- (chore) Updated dependencies and project metadata - Modified package.json to add new dependencies (js-yaml, yaml), update scripts, and adjust project metadata for configuration and documentation improvements. (85%)

- (other) Added placeholder and example files - Created empty files for future examples and project notes: examples/, "Let me validate and expand on those scen.md", and "we recentrly refactored this project, th.md". (85%)

---

*Generated using [ai-changelog-generator](https://github.com/entro314-labs/AI-changelog-generator) - AI-powered changelog generation for Git repositories*