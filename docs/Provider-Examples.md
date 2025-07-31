# AI Provider Configuration Examples

This document provides comprehensive configuration examples for all supported AI providers in v3.0.0.

## Quick Start

The tool automatically detects and uses any configured provider. Simply add the relevant environment variables to your `.env.local` file:

```env
# Add one or more providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key
```

## Provider-Specific Configuration

### OpenAI (GPT-4.1 Series)

```env
# Required
OPENAI_API_KEY=sk-your-api-key

# Optional
OPENAI_ORGANIZATION=org-your-org-id
OPENAI_PROJECT_ID=proj_your-project-id
OPENAI_TIMEOUT=60000
OPENAI_MAX_RETRIES=2
```

**Available Models:**
- `gpt-4o` (flagship model)
- `gpt-4.1-standard` (balanced performance)
- `gpt-4.1-mini` (cost-optimized)
- `gpt-4.1-nano` (ultra-efficient)
- `o1` (reasoning model)

### Azure OpenAI (o3/o4 Reasoning Models)

```env
# Required
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=o4
AZURE_OPENAI_API_VERSION=2025-04-01-preview

# Optional - Azure AD Authentication
AZURE_USE_AD_AUTH=true
AZURE_USER_ID=user-123
```

**Available Models:**
- `o4` (latest reasoning model - Azure exclusive)
- `o4-mini` (efficient reasoning)
- `o3` (previous generation reasoning)
- `o3-mini` (cost-optimized reasoning)
- `gpt-4o` (multimodal flagship)
- `gpt-35-turbo` (legacy)

### Anthropic Claude (Sonnet 4)

```env
# Required
ANTHROPIC_API_KEY=sk-ant-your-key

# Optional
ANTHROPIC_API_URL=https://api.anthropic.com
ANTHROPIC_TIMEOUT=60000
ANTHROPIC_MAX_RETRIES=2
```

**Available Models:**
- `claude-sonnet-4-20250514` (latest balanced model)
- `claude-opus-4-20250617` (most capable)
- `claude-3-5-sonnet-20241022` (previous generation)
- `claude-3-5-haiku-20241022` (fast and efficient)

### Google AI (Gemini 2.5)

```env
# Required
GOOGLE_API_KEY=your-api-key

# Optional
GOOGLE_DEFAULT_MODEL=gemini-2.5-flash
GOOGLE_API_VERSION=v1
GOOGLE_API_ENDPOINT=https://generativelanguage.googleapis.com
GOOGLE_TIMEOUT=60000
GOOGLE_MAX_RETRIES=3
```

**Available Models:**
- `gemini-2.5-pro` (most capable with thinking mode)
- `gemini-2.5-flash` (fastest)
- `gemini-2.0-flash` (multimodal)
- `gemini-1.5-pro` (legacy)

### Google Vertex AI

```env
# Required
VERTEX_PROJECT_ID=your-project-id
VERTEX_LOCATION=us-central1

# Authentication (choose one)
VERTEX_KEY_FILE=/path/to/service-account.json
VERTEX_CREDENTIALS={"type":"service_account",...}
# Or use GOOGLE_APPLICATION_CREDENTIALS

# Optional
VERTEX_MODEL=gemini-2.5-flash
VERTEX_API_VERSION=v1
VERTEX_TEMPERATURE=0.7
VERTEX_MAX_TOKENS=8192
```

### Hugging Face (Multi-Provider Routing)

```env
# Required
HUGGINGFACE_API_KEY=hf_your-token

# Optional
HUGGINGFACE_MODEL=Qwen/Qwen2.5-72B-Instruct
HUGGINGFACE_PROVIDER=auto
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
HUGGINGFACE_TIMEOUT=120000
```

**Available Models:**
- `Qwen/Qwen2.5-72B-Instruct` (best performance)
- `meta-llama/Llama-3.3-70B-Instruct` (strong reasoning)
- `meta-llama/Llama-3.1-8B-Instruct` (balanced)
- `mistralai/Mixtral-8x22B-Instruct-v0.1` (coding)

**Providers:** `auto`, `replicate`, `together`, `sambanova`, `fal`

### Ollama (Local Models)

```env
# Required
OLLAMA_HOST=http://localhost:11434

# Optional
OLLAMA_MODEL=llama3.1
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

**Available Models:** Any model you have installed locally
- `llama3.1` (recommended default)
- `codellama` (coding tasks)
- `mistral` (alternative)
- `phi` (small model)

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Start server (usually auto-starts)
ollama serve
```

### LM Studio (Local Deployment)

```env
# Required
LMSTUDIO_API_BASE=http://localhost:1234/v1

# Optional
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=local-model
LMSTUDIO_TIMEOUT=120000
LMSTUDIO_MAX_RETRIES=2
```

**Setup:**
1. Download and install LM Studio
2. Load a model in LM Studio
3. Start the local server (Developer > Local Server)
4. Use OpenAI-compatible endpoint

## Multi-Provider Configuration

### Complete Setup (All Providers)

```env
# Cloud Providers
OPENAI_API_KEY=sk-your-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_DEPLOYMENT_NAME=o4
ANTHROPIC_API_KEY=sk-ant-your-key
GOOGLE_API_KEY=your-google-key
HUGGINGFACE_API_KEY=hf_your-token

# Local Providers
OLLAMA_HOST=http://localhost:11434
LMSTUDIO_API_BASE=http://localhost:1234/v1

# Provider Selection
AI_PROVIDER=auto
PROVIDER_PRIORITY=["azure","anthropic","openai","google","ollama","lmstudio"]
```

### Cost-Optimized Setup

```env
# Prioritize cost-effective providers
HUGGINGFACE_API_KEY=hf_your-token
OLLAMA_HOST=http://localhost:11434
OPENAI_API_KEY=sk-your-key

# Use efficient models
HUGGINGFACE_MODEL=meta-llama/Llama-3.1-8B-Instruct
OLLAMA_MODEL=llama3.1
PROVIDER_PRIORITY=["ollama","huggingface","openai"]
```

### Enterprise Setup

```env
# Enterprise-grade providers
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=o4
AZURE_USE_AD_AUTH=true

VERTEX_PROJECT_ID=your-project-id
VERTEX_LOCATION=us-central1

ANTHROPIC_API_KEY=sk-ant-your-key

# Prioritize enterprise providers
PROVIDER_PRIORITY=["azure","vertex","anthropic"]
```

## Testing Your Configuration

### Validate All Providers

```bash
# Test configuration
ai-changelog --validate

# Test specific provider
ai-changelog validate --provider anthropic

# Test model availability
ai-changelog validate --models
```

### CLI Testing

```bash
# Test with different providers
ai-changelog --provider openai
ai-changelog --provider anthropic --model claude-sonnet-4
ai-changelog --provider google --model gemini-2.5-pro

# Test local providers
ai-changelog --provider ollama
ai-changelog --provider lmstudio
```

### MCP Testing

```javascript
// Test provider switching
{
  "name": "switch_provider",
  "arguments": {
    "provider": "anthropic",
    "testAfterSwitch": true
  }
}

// Test provider listing
{
  "name": "list_providers",
  "arguments": {
    "includeCapabilities": true
  }
}

// Test model validation
{
  "name": "validate_models",
  "arguments": {
    "provider": "google",
    "testModels": true
  }
}
```

## Troubleshooting

### Common Issues

**"No provider available"**
- Check that at least one API key is set
- Verify API keys are valid
- Test network connectivity

**"Model not found"**
- Check model name spelling
- Verify model is available in your region
- Try alternative models

**Local provider connection failed**
- Ensure Ollama/LM Studio is running
- Check host/port configuration
- Verify firewall settings

### Provider-Specific Troubleshooting

**Azure OpenAI**
- Verify deployment name matches your Azure setup
- Check API version compatibility
- Ensure sufficient quota

**Google Vertex AI**
- Verify project ID and location
- Check service account permissions
- Ensure Vertex AI API is enabled

**Hugging Face**
- Check token permissions
- Verify model availability in your region
- Try different provider routing

### Debug Mode

```bash
# Enable debug logging
DEBUG=ai-changelog* ai-changelog

# Test with verbose output
ai-changelog --validate --verbose

# Test provider connectivity
ai-changelog test-providers
```

## Best Practices

### Security
- Use environment variables, not hardcoded keys
- Rotate API keys regularly
- Use least-privilege access
- Consider local models for sensitive data

### Performance
- Use local models for development
- Configure provider priority based on your needs
- Enable caching where available
- Monitor API usage and costs

### Reliability
- Configure multiple providers for redundancy
- Set appropriate timeouts and retries
- Monitor provider health
- Have fallback strategies

## Examples

### Development Workflow
```bash
# Fast local development
export OLLAMA_HOST=http://localhost:11434
ai-changelog --provider ollama

# Production changelog
export ANTHROPIC_API_KEY=sk-ant-...
ai-changelog --provider anthropic --model claude-sonnet-4 --detailed
```

### CI/CD Integration
```yaml
# GitHub Actions
env:
  HUGGINGFACE_API_KEY: ${{ secrets.HF_TOKEN }}
  PROVIDER_PRIORITY: '["huggingface","openai"]'

steps:
  - name: Generate Changelog
    run: ai-changelog --since ${{ github.event.before }}
```

### Cost Monitoring
```bash
# Use cost-effective models
ai-changelog --provider huggingface --model meta-llama/Llama-3.1-8B-Instruct

# Local processing (zero cost)
ai-changelog --provider ollama --model llama3.1
```