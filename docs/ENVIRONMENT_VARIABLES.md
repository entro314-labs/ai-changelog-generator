# Environment Variables Configuration

This document lists all environment variables supported by the AI Changelog Generator. Copy the variables you need to your `.env.local` file.

## Quick Start

1. Copy the template: `cp .env.local.example .env.local`
2. Configure at least one AI provider
3. Test: `ai-changelog --validate`
4. Generate: `ai-changelog`

## AI Provider Selection

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `AI_PROVIDER` | Which AI provider to use | `auto` | `auto`, `openai`, `azure`, `anthropic`, `google`, `vertex`, `huggingface`, `ollama`, `lmstudio` |

## OpenAI Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key from platform.openai.com | Yes | `sk-...` |

## Azure OpenAI Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Yes | - | `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_KEY` | Azure OpenAI API key | Yes* | - | `your-azure-key` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Model deployment name | No | `gpt-4o` | `o4`, `gpt-4`, `gpt-35-turbo` |
| `AZURE_OPENAI_API_VERSION` | API version | No | `2024-10-21` | `2025-04-01-preview` |
| `AZURE_USE_AD_AUTH` | Use Azure AD authentication | No | `false` | `true`, `false` |
| `AZURE_USER_ID` | Azure AD user ID | No | - | `user-123` |
| `AZURE_OPENAI_USE_V1_API` | Use v1 API compatibility | No | `true` | `true`, `false` |

*Required unless using Azure AD authentication

## Anthropic (Claude) Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key from console.anthropic.com | Yes | `sk-ant-...` |

## Google AI Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `GOOGLE_API_KEY` | Google AI API key | Yes | - | `your-google-key` |
| `GOOGLE_API_ENDPOINT` | Custom Google AI endpoint | No | `https://generativelanguage.googleapis.com` | Custom endpoint URL |

## Google Vertex AI Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `VERTEX_PROJECT_ID` | Google Cloud Project ID | Yes | - | `my-project-123` |
| `VERTEX_LOCATION` | Google Cloud region | No | `us-central1` | `us-central1`, `europe-west1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | No | - | `/path/to/credentials.json` |

## Hugging Face Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `HUGGINGFACE_API_KEY` | Hugging Face token | Yes | `hf_...` |
| `HUGGINGFACE_ENDPOINT_URL` | Custom endpoint for private deployments | No | `https://your-endpoint.endpoints.huggingface.cloud` |

## Ollama Configuration (Local Models)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `OLLAMA_HOST` | Ollama server URL | No | `http://localhost:11434` | `http://localhost:11434` |
| `OLLAMA_MODEL` | Default model to use | No | `llama3` | `llama3`, `codellama`, `mistral` |

## LM Studio Configuration (Local Models)

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `LMSTUDIO_BASE_URL` | LM Studio server URL | No | `http://localhost:1234/v1` | `http://localhost:1234/v1` |
| `LMSTUDIO_API_KEY` | LM Studio API key | No | `lm-studio` | `lm-studio` |

## Application Behavior Settings

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `DEFAULT_ANALYSIS_MODE` | Default analysis depth | `standard` | `standard`, `detailed`, `enterprise` |
| `GIT_PATH` | Git repository path | Current directory | `/path/to/repo` |
| `OUTPUT_FORMAT` | Output format | `markdown` | `markdown`, `json` |
| `INCLUDE_ATTRIBUTION` | Include attribution footer | `true` | `true`, `false` |

## Performance & Rate Limiting

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `RATE_LIMIT_DELAY` | Delay between API requests (ms) | `1000` | `1000`, `2000` |
| `MAX_RETRIES` | Maximum retry attempts | `3` | `3`, `5` |

## Debugging & Development

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `DEBUG` | Enable debug mode | `false` | `true`, `false` |
| `VERBOSE` | Enable verbose output | `false` | `true`, `false` |
| `NO_COLOR` | Disable colored output | `false` | `true`, `false` |
| `NODE_DISABLE_COLORS` | Alternative color disable | - | `1` |
| `TERM` | Terminal type override | - | `dumb` |

## Advanced Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `npm_package_version` | Package version (auto-detected) | `3.0.2` |

## Usage Examples

### Minimal OpenAI Setup

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

### Azure OpenAI with o4 Model

```bash
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=o4
AZURE_OPENAI_API_VERSION=2025-04-01-preview
```

### Local Ollama Setup

```bash
AI_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3
```

### Multiple Providers (Auto-Selection)

```bash
AI_PROVIDER=auto
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key
```

### Development/Debug Mode

```bash
DEBUG=true
VERBOSE=true
DEFAULT_ANALYSIS_MODE=detailed
```

## Security Best Practices

- ✅ Never commit `.env.local` to version control
- ✅ Keep API keys secure and rotate regularly
- ✅ Use environment variables in production
- ✅ Consider Azure Key Vault for production secrets
- ✅ Monitor API usage for unauthorized access
- ✅ Use least-privilege API keys when possible

## Troubleshooting

### Provider Not Loading

1. Check API key format and validity
2. Verify endpoint URLs are correct
3. Run `ai-changelog --validate` to test configuration
4. Enable debug mode: `DEBUG=true`

### Rate Limiting Issues

1. Increase `RATE_LIMIT_DELAY` (e.g., `2000`)
2. Reduce batch sizes in requests
3. Check provider-specific rate limits

### Authentication Errors

1. Verify API keys are active and valid
2. Check account quotas and billing
3. For Azure: verify endpoint and deployment names match

## Complete .env.local Template

Copy the following template to your `.env.local` file and uncomment/configure the variables you need:

```bash
# ==============================================================================
# AI Changelog Generator - Environment Configuration
# ==============================================================================
# Copy this file to .env.local and configure your settings
# 
# Quick Start:
# 1. Copy relevant sections below to .env.local
# 2. Configure at least one AI provider
# 3. Run: ai-changelog --validate
# 4. Generate: ai-changelog
# ==============================================================================

# ==============================================================================
# AI PROVIDER SELECTION
# ==============================================================================
# Which AI provider to use by default
# Options: auto, openai, azure, anthropic, google, vertex, huggingface, ollama, lmstudio
AI_PROVIDER=auto

# ==============================================================================
# OPENAI CONFIGURATION
# ==============================================================================
# Get your API key from: https://platform.openai.com/account/api-keys
# OPENAI_API_KEY=

# ==============================================================================
# AZURE OPENAI CONFIGURATION
# ==============================================================================
# Azure OpenAI Service configuration
# AZURE_OPENAI_ENDPOINT=
# AZURE_OPENAI_KEY=
# AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
# AZURE_OPENAI_API_VERSION=2024-10-21
# AZURE_USE_AD_AUTH=false
# AZURE_USER_ID=
# AZURE_OPENAI_USE_V1_API=true

# ==============================================================================
# ANTHROPIC (CLAUDE) CONFIGURATION
# ==============================================================================
# Get your API key from: https://console.anthropic.com/
# ANTHROPIC_API_KEY=

# ==============================================================================
# GOOGLE AI CONFIGURATION
# ==============================================================================
# Get your API key from: https://aistudio.google.com/app/apikey
# GOOGLE_API_KEY=
# GOOGLE_API_ENDPOINT=

# ==============================================================================
# GOOGLE VERTEX AI CONFIGURATION
# ==============================================================================
# For Google Cloud Vertex AI (enterprise version)
# VERTEX_PROJECT_ID=
# VERTEX_LOCATION=us-central1
# GOOGLE_APPLICATION_CREDENTIALS=

# ==============================================================================
# HUGGING FACE CONFIGURATION
# ==============================================================================
# Get your token from: https://huggingface.co/settings/tokens
# HUGGINGFACE_API_KEY=
# HUGGINGFACE_ENDPOINT_URL=

# ==============================================================================
# OLLAMA CONFIGURATION (LOCAL MODELS)
# ==============================================================================
# Local Ollama server configuration
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=llama3

# ==============================================================================
# LMSTUDIO CONFIGURATION (LOCAL MODELS)
# ==============================================================================
# Local LM Studio server configuration
# LMSTUDIO_BASE_URL=http://localhost:1234/v1
# LMSTUDIO_API_KEY=lm-studio

# ==============================================================================
# APPLICATION BEHAVIOR SETTINGS
# ==============================================================================
# DEFAULT_ANALYSIS_MODE=standard
# GIT_PATH=
# OUTPUT_FORMAT=markdown
# INCLUDE_ATTRIBUTION=true

# ==============================================================================
# PERFORMANCE & RATE LIMITING
# ==============================================================================
# RATE_LIMIT_DELAY=1000
# MAX_RETRIES=3

# ==============================================================================
# DEBUGGING & DEVELOPMENT
# ==============================================================================
# DEBUG=false
# VERBOSE=false
# NO_COLOR=false
# NODE_DISABLE_COLORS=
# TERM=

# ==============================================================================
# ADVANCED CONFIGURATION
# ==============================================================================
# npm_package_version=
```

## Getting API Keys

| Provider | Where to Get API Key | Documentation |
|----------|---------------------|---------------|
| OpenAI | [platform.openai.com](https://platform.openai.com/account/api-keys) | [OpenAI Docs](https://platform.openai.com/docs) |
| Azure OpenAI | [Azure Portal](https://portal.azure.com) | [Azure OpenAI Docs](https://docs.microsoft.com/azure/cognitive-services/openai/) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | [Anthropic Docs](https://docs.anthropic.com/) |
| Google AI | [aistudio.google.com](https://aistudio.google.com/app/apikey) | [Google AI Docs](https://ai.google.dev/) |
| Hugging Face | [huggingface.co](https://huggingface.co/settings/tokens) | [HF Docs](https://huggingface.co/docs) |
| Local Models | Install Ollama or LM Studio | [Ollama](https://ollama.ai/), [LM Studio](https://lmstudio.ai/) |
