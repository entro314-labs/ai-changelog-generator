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

### OpenAI (GPT-5 Series)

```env
# Required
OPENAI_API_KEY=sk-your-api-key

# Optional
OPENAI_ORGANIZATION=org-your-org-id
OPENAI_PROJECT_ID=proj_your-project-id
OPENAI_TIMEOUT=60000
OPENAI_MAX_RETRIES=2
```

**Available Models (Latest Generation):**

- `gpt-5.2-pro` (most advanced model with superior reasoning)
- `gpt-5-pro` (flagship general-purpose model)
- `gpt-5-codex` (specialized for agentic coding in Codex)
- `o4-mini` (fast reasoning model, successor to o3-mini)
- `o3` (advanced reasoning model)
- `o3-pro` (enhanced reasoning with more compute)
- `o3-mini` (cost-efficient reasoning)
- `o3-deep-research` (most powerful deep research model)
- `o4-mini-deep-research` (faster, affordable deep research)

**Previous Generation (Fallback Options):**

- `gpt-4.1` (previous flagship, still capable)
- `gpt-4.1-mini` (cost-optimized)
- `gpt-4.1-nano` (ultra-efficient)
- `gpt-4o` (multimodal flagship from previous generation)
- `gpt-4o-mini` (fast and affordable)

### Azure OpenAI (GPT-5 & Reasoning Models)

```env
# Required
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/v1
AZURE_OPENAI_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-pro

# Optional - Azure AD Authentication
AZURE_USE_AD_AUTH=true
AZURE_USER_ID=user-123
```

**Note:** Azure OpenAI now uses the `/openai/v1` endpoint. No `api-version` parameter is required.

**Available Models (Latest Generation):**

- `gpt-5.2-pro` (most advanced model)
- `gpt-5-pro` (flagship model)
- `gpt-5-codex` (agentic coding)
- `o4-mini` (fast reasoning)
- `o3` (advanced reasoning)
- `o3-pro` (enhanced reasoning with more compute)
- `o3-deep-research` (most powerful deep research)
- `o4-mini-deep-research` (faster deep research)

**Previous Generation (Fallback Options):**

- `gpt-4.1` (previous flagship)
- `gpt-4.1-mini` (cost-optimized)
- `gpt-4o` (multimodal model)
- `gpt-4o-mini` (fast and affordable)

### Anthropic Claude (4.5 Series)

```env
# Required
ANTHROPIC_API_KEY=sk-ant-your-key

# Optional
ANTHROPIC_API_URL=https://api.anthropic.com
ANTHROPIC_TIMEOUT=60000
ANTHROPIC_MAX_RETRIES=2
```

**Available Models (Latest Generation - 4.5 Series):**

- `claude-opus-4-5-20251101` (best for coding, agents, computer use - $5/$25 per MTok)
- `claude-sonnet-4-5-20250929` (balanced performance and cost)
- `claude-haiku-4-5-20251001` (fast and cost-efficient)

**Previous Generation (Fallback Options - 4.0 Series):**

- `claude-opus-4-20250617` (previous flagship)
- `claude-sonnet-4-20250514` (previous balanced model)
- `claude-haiku-4-20250320` (previous fast model)

**Note:** Claude 4.5 models support extended thinking, 200K context (1M with beta header), and are available on AWS Bedrock, Google Vertex AI, and Microsoft Foundry with regional/global endpoint options.

### Google AI (Gemini 3 Series)

```env
# Required
GOOGLE_API_KEY=your-api-key

# Optional
GOOGLE_DEFAULT_MODEL=gemini-3-flash
GOOGLE_API_VERSION=v1
GOOGLE_API_ENDPOINT=https://generativelanguage.googleapis.com
GOOGLE_TIMEOUT=60000
GOOGLE_MAX_RETRIES=3
```

**Available Models (Latest Generation - Gemini 3):**

- `gemini-3-pro` (best multimodal understanding, state-of-the-art reasoning)
- `gemini-3-pro-preview` (preview of latest capabilities)
- `gemini-3-flash` (balanced speed and frontier intelligence)
- `gemini-3-flash-preview` (preview with upgraded visual/spatial reasoning)

**Previous Generation (Fallback Options - Gemini 2.5):**

- `gemini-2.5-pro` (thinking model for complex reasoning, STEM tasks)
- `gemini-2.5-flash` (price-performance leader for high-volume tasks)
- `gemini-2.5-flash-lite` (ultra-efficient for simple tasks)

**Note:** `gemini-2.0-flash` is retiring March 3, 2026. Migrate to Gemini 2.5 or 3 series.

**Note:** Gemini 3 models support multimodal function responses, code execution with images, and improved visual/spatial reasoning.

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
VERTEX_MODEL=gemini-3-flash
VERTEX_API_VERSION=v1
VERTEX_TEMPERATURE=0.7
VERTEX_MAX_TOKENS=8192
```

**Note:** Vertex AI provides enterprise features including Claude models (with regional/global endpoints), Gemini 3 series, and enhanced security/compliance options.

### Hugging Face (Multi-Provider Routing)

```env
# Required
HUGGINGFACE_API_KEY=hf_your-token

# Optional
HUGGINGFACE_MODEL=Qwen/Qwen3-72B-Instruct
HUGGINGFACE_PROVIDER=auto
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
HUGGINGFACE_TIMEOUT=120000
```

**Available Models (Latest Generation - 2026):**

- `deepseek-ai/DeepSeek-R1` (reasoning model, O3-level performance, 1.5B-671B)
- `deepseek-ai/DeepSeek-V3` (671B parameters, strong coding)
- `Qwen/Qwen3-72B-Instruct` (latest Qwen with MoE architecture)
- `meta-llama/Llama-4-70B-Instruct` (Meta's latest generation)
- `mistralai/Mistral-Large-3` (Mistral's flagship, 2026)
- `google/gemma-3-27b` (Google's latest open model)
- `microsoft/phi-4` (Microsoft's efficient 14B model)

**Previous Generation (Fallback Options):**

- `meta-llama/Llama-3.3-70B-Instruct` (strong general purpose)
- `Qwen/Qwen2.5-72B-Instruct` (previous Qwen generation)
- `mistralai/Mixtral-8x22B-Instruct-v0.1` (MoE model)
- `google/gemma-2-27b` (previous Gemma generation)

**Providers:** `auto`, `replicate`, `together`, `sambanova`, `fal`, `fireworks`

### Ollama (Local Models)

```env
# Required
OLLAMA_HOST=http://localhost:11434

# Optional
OLLAMA_MODEL=llama3.3
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

**Popular Models (Latest Generation - 2026):**

- `llama3.3` (Meta's latest 70B model - highly recommended, state-of-the-art)
- `deepseek-r1` (reasoning model, 1.5B-671B sizes, O3-level)
- `gemma3` (Google's latest, 270M-27B sizes)
- `qwen3` (Alibaba's latest, 0.6B-235B sizes with MoE)
- `phi4` (Microsoft's 14B efficient model)
- `phi4-reasoning` (Microsoft's reasoning variant)
- `gpt-oss` (open GPT models, 20B-120B)
- `mistral-large-3` (Mistral's latest flagship)

**Previous Generation (Fallback Options):**

- `llama3.2` (1B-3B small models)
- `llama3.1` (8B-405B models)
- `gemma2` (2B-27B models)
- `qwen2.5` (0.5B-72B models)
- `mistral` (7B general purpose)
- `codellama` (specialized for coding)

**Setup:**

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.3

# Start server (usually auto-starts)
ollama serve
```

**Note:** Ollama now supports 100+ models including:
- Reasoning models: `deepseek-r1`, `phi4-reasoning`, `qwq`
- Vision models: `llama3.2-vision`, `qwen3-vl`, `minicpm-v`
- Coding models: `gpt-oss`, `qwen3-coder`, `deepseek-coder-v2`
- Embedding models: `nomic-embed-text`, `mxbai-embed-large`

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
HUGGINGFACE_MODEL=deepseek-ai/DeepSeek-R1-7B
OLLAMA_MODEL=deepseek-r1:7b
OPENAI_MODEL=gpt-4.1-mini
PROVIDER_PRIORITY=["ollama","huggingface","openai"]
```

**Note:** DeepSeek-R1 offers O3-level reasoning at significantly lower cost:
- Cloud: Use via Hugging Face Inference API
- Local: Use via Ollama (zero cost) - `deepseek-r1:7b` for fast inference, `deepseek-r1:70b` for best quality
- Alternative: Llama 3.3 for general-purpose tasks

### Enterprise Setup

```env
# Enterprise-grade providers
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/v1
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-pro
AZURE_USE_AD_AUTH=true

VERTEX_PROJECT_ID=your-project-id
VERTEX_LOCATION=us-central1

ANTHROPIC_API_KEY=sk-ant-your-key

# Prioritize enterprise providers
PROVIDER_PRIORITY=["azure","vertex","anthropic"]
```

**Note:** Enterprise deployments benefit from:
- SLAs and priority processing tiers (Azure, OpenAI)
- Regional data residency (Vertex AI, AWS Bedrock, Microsoft Foundry)
- Azure AD authentication (Azure OpenAI)
- Batch API discounts (50% off for non-urgent requests)
- Prompt caching (Claude 4.5: 5-min or 1-hour cache options)

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
# Test with different providers (latest models)
ai-changelog --provider openai --model gpt-5.2-pro
ai-changelog --provider anthropic --model claude-opus-4-5-20251101
ai-changelog --provider google --model gemini-3-pro

# Test reasoning models
ai-changelog --provider openai --model o3
ai-changelog --provider ollama --model deepseek-r1:7b

# Test local providers
ai-changelog --provider ollama --model llama3.3
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
ai-changelog --provider ollama --model llama3.3  # or deepseek-r1:7b for reasoning

# Production changelog with reasoning
export ANTHROPIC_API_KEY=sk-ant-...
ai-changelog --provider anthropic --model claude-opus-4-5-20251101 --detailed
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
# Use cost-effective models with reasoning
ai-changelog --provider huggingface --model deepseek-ai/DeepSeek-R1-7B

# Local processing (zero cost)
ai-changelog --provider ollama --model deepseek-r1:7b
```
