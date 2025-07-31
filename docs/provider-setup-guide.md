# AI Provider Setup Guide

Complete guide for configuring AI providers with the AI Changelog Generator. This tool supports 10+ AI providers including cloud services and local models.

## Quick Setup

1. Copy the environment template: `cp .env.local.example .env.local`
2. Configure at least one AI provider (see sections below)
3. Test configuration: `ai-changelog validate`
4. Generate changelog: `ai-changelog`

## Supported Providers

| Provider | Type | Models | Cost | Setup Difficulty |
|----------|------|---------|------|------------------|
| **OpenAI** | Cloud | GPT-4o, GPT-4.1, o1 | $$$ | Easy |
| **Anthropic** | Cloud | Claude Sonnet 4, Opus 4 | $$$ | Easy |
| **Google AI** | Cloud | Gemini 2.5 Pro/Flash | $$ | Easy |
| **Azure OpenAI** | Cloud | GPT-4.1, o3/o4 exclusive | $$$ | Medium |
| **Google Vertex** | Cloud | Gemini enterprise | $$$ | Medium |
| **Hugging Face** | Cloud | 200k+ models | $ | Easy |
| **Ollama** | Local | Llama, Mistral, custom | Free | Medium |
| **LM Studio** | Local | Any GGUF model | Free | Medium |

## Cloud Provider Setup

### OpenAI

**Best for**: Latest models, reliable performance
**Models**: GPT-4o, GPT-4.1 series, o1 reasoning models

```bash
# Required
OPENAI_API_KEY=sk-your-api-key

# Optional
OPENAI_ORGANIZATION=org-your-org-id
OPENAI_PROJECT_ID=proj_your-project-id
```

**Setup Steps**:
1. Visit [platform.openai.com](https://platform.openai.com/account/api-keys)
2. Create API key
3. Add to `.env.local`
4. Test: `ai-changelog validate --provider openai`

### Anthropic Claude

**Best for**: Detailed analysis, code understanding
**Models**: Claude Sonnet 4, Claude Opus 4 (2025 latest)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-key

# Optional
ANTHROPIC_API_URL=https://api.anthropic.com
ANTHROPIC_TIMEOUT=60000
```

**Setup Steps**:
1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Create API key
3. Add to `.env.local`
4. Test: `ai-changelog validate --provider anthropic`

### Google AI (Gemini)

**Best for**: Multimodal analysis, cost-effective
**Models**: Gemini 2.5 Pro (thinking mode), 2.5 Flash

```bash
# Required
GOOGLE_API_KEY=your-api-key

# Optional
GOOGLE_DEFAULT_MODEL=gemini-2.5-flash
GOOGLE_API_VERSION=v1
```

**Setup Steps**:
1. Visit [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Create API key
3. Add to `.env.local`
4. Test: `ai-changelog validate --provider google`

### Azure OpenAI

**Best for**: Enterprise, exclusive o3/o4 models
**Models**: GPT-4.1 series + exclusive o3/o4 reasoning models

```bash
# Required
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-10-21

# Optional - Azure AD Authentication
AZURE_USE_AD_AUTH=true
AZURE_USER_ID=user-123
```

**Setup Steps**:
1. Create Azure OpenAI resource in Azure Portal
2. Deploy a model (e.g., gpt-4o)
3. Get endpoint and key from Azure Portal
4. Add to `.env.local`
5. Test: `ai-changelog validate --provider azure`

### Hugging Face

**Best for**: Cost optimization, model variety
**Models**: Qwen 2.5, Llama 3.3, 200k+ models via routing

```bash
# Required
HUGGINGFACE_API_KEY=hf_your-token

# Optional
HUGGINGFACE_MODEL=Qwen/Qwen2.5-72B-Instruct
HUGGINGFACE_PROVIDER=auto  # auto, replicate, together, sambanova
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
```

**Setup Steps**:
1. Visit [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create token
3. Add to `.env.local`
4. Test: `ai-changelog validate --provider huggingface`

## Local Provider Setup

### Ollama

**Best for**: Privacy, no API costs, offline usage
**Models**: Llama 3.1, Mistral, CodeLlama, custom models

```bash
# Required (usually default)
OLLAMA_HOST=http://localhost:11434

# Optional
OLLAMA_MODEL=llama3.1
```

**Setup Steps**:
1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3.1`
3. Start server: `ollama serve` (usually auto-starts)
4. Add to `.env.local`
5. Test: `ai-changelog validate --provider ollama`

**Popular Models**:
- `llama3.1` - Recommended default (8B params)
- `llama3.1:70b` - More capable but slower
- `codellama` - Optimized for code analysis
- `mistral` - Good alternative to Llama

### LM Studio

**Best for**: GUI model management, local deployment
**Models**: Any GGUF model from Hugging Face

```bash
# Required
LMSTUDIO_API_BASE=http://localhost:1234/v1

# Optional
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=local-model
```

**Setup Steps**:
1. Download [LM Studio](https://lmstudio.ai/)
2. Download a model in LM Studio
3. Start local server (Developer > Local Server)
4. Add to `.env.local`
5. Test: `ai-changelog validate --provider lmstudio`

## Multi-Provider Configuration

### Priority-Based Selection

```bash
# Provider selection (optional)
AI_PROVIDER=auto  # auto, openai, anthropic, google, etc.
PROVIDER_PRIORITY=["azure","anthropic","openai","google","ollama"]
```

### Complete Multi-Provider Setup

```bash
# Cloud Providers
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-key
GOOGLE_API_KEY=your-google-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your-azure-key

# Local Providers
OLLAMA_HOST=http://localhost:11434
LMSTUDIO_API_BASE=http://localhost:1234/v1

# Provider Selection
AI_PROVIDER=auto  # Will automatically select best available
```

## Common Troubleshooting

### Provider Not Available

**Symptoms**: "No AI provider is available" or "Provider [name] not found"

**Solutions**:
1. Run configuration wizard: `ai-changelog providers configure`
2. Check API key format and validity
3. Verify network connectivity: `ai-changelog validate`
4. Check provider-specific issues below

### OpenAI Issues

**API Key Invalid**:
- Error: "Incorrect API key provided"
- Solution: Verify key at [platform.openai.com](https://platform.openai.com/account/api-keys)

**Rate Limits**:
- Error: "Rate limit exceeded"
- Solution: Check usage in OpenAI dashboard, upgrade plan, or add delay

**Model Not Available**:
- Error: "The model [model] does not exist"
- Solution: Check available models in your account

### Azure OpenAI Issues

**Deployment Not Found**:
- Error: "The API deployment for this resource does not exist"
- Solution: Verify deployment name in Azure portal matches configuration

**Authentication Failed**:
- Solution: Check API key and endpoint URL are correct

**Region Mismatch**:
- Solution: Ensure endpoint URL matches deployment region

### Anthropic Issues

**API Key Invalid**:
- Solution: Verify key at [console.anthropic.com](https://console.anthropic.com/)

**Content Policy Violation**:
- Error: "Request rejected by safety system"
- Solution: Review prompt content for policy compliance

### Google AI Issues

**API Key Invalid**:
- Solution: Verify key at [aistudio.google.com](https://aistudio.google.com/app/apikey)

**Safety Filters**:
- Error: "Safety settings triggered"
- Solution: Review prompt content or adjust safety settings

### Ollama Issues

**Connection Refused**:
- Error: "ECONNREFUSED"
- Solution: Ensure Ollama is running: `ollama serve`

**Model Not Found**:
- Error: "Model [model] not found"
- Solution: Pull model: `ollama pull [model]`

**Performance Issues**:
- Solution: Use smaller model or increase system resources

### Hugging Face Issues

**API Token Invalid**:
- Solution: Verify token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

**Model Not Available**:
- Solution: Check if model exists on Hugging Face Hub

**Rate Limits**:
- Solution: Check usage or upgrade plan

## Testing and Validation

### Validate All Providers

```bash
# Test all configured providers
ai-changelog validate

# Test specific provider
ai-changelog validate --provider anthropic

# Test with verbose output
ai-changelog validate --verbose
```

### Test Generation

```bash
# Test with different providers
ai-changelog --provider openai
ai-changelog --provider anthropic --model claude-sonnet-4
ai-changelog --provider ollama --model llama3.1

# Test local providers
ai-changelog --provider ollama
ai-changelog --provider lmstudio
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=ai-changelog* ai-changelog

# Test provider connectivity
ai-changelog test-providers

# Verbose validation
ai-changelog validate --verbose
```

## Best Practices

### Security
- Use environment variables, never hardcode API keys
- Rotate API keys regularly
- Use least-privilege access when possible
- Consider local models for sensitive code

### Performance
- Use local models for development/testing
- Configure provider priority based on your needs
- Monitor API costs and usage
- Set appropriate timeouts and retries

### Cost Optimization
- Use Hugging Face or local models for cost savings
- Set model overrides for different complexity levels
- Monitor token usage with detailed logging
- Use caching when available

### Reliability
- Configure multiple providers for redundancy
- Set up fallback chains
- Monitor provider health and status
- Have offline capabilities with local models

## Environment Variables Reference

### Provider Selection
- `AI_PROVIDER` - Which provider to use (`auto`, `openai`, `anthropic`, etc.)
- `PROVIDER_PRIORITY` - JSON array of provider preference order

### OpenAI
- `OPENAI_API_KEY` - API key (required)
- `OPENAI_ORGANIZATION` - Organization ID (optional)
- `OPENAI_PROJECT_ID` - Project ID (optional)

### Anthropic
- `ANTHROPIC_API_KEY` - API key (required)
- `ANTHROPIC_API_URL` - Custom endpoint (optional)

### Google AI
- `GOOGLE_API_KEY` - API key (required)
- `GOOGLE_DEFAULT_MODEL` - Default model (optional)

### Azure OpenAI
- `AZURE_OPENAI_ENDPOINT` - Resource endpoint (required)
- `AZURE_OPENAI_KEY` - API key (required)
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Model deployment name
- `AZURE_OPENAI_API_VERSION` - API version

### Hugging Face
- `HUGGINGFACE_API_KEY` - API token (required)
- `HUGGINGFACE_MODEL` - Default model
- `HUGGINGFACE_PROVIDER` - Provider routing (`auto`, `replicate`, etc.)

### Local Providers
- `OLLAMA_HOST` - Ollama server URL
- `OLLAMA_MODEL` - Default model
- `LMSTUDIO_API_BASE` - LM Studio server URL
- `LMSTUDIO_API_KEY` - API key (usually `lm-studio`)

### Application Settings
- `DEFAULT_ANALYSIS_MODE` - Analysis depth (`standard`, `detailed`, `enterprise`)
- `OUTPUT_FORMAT` - Output format (`markdown`, `json`)
- `INCLUDE_ATTRIBUTION` - Include attribution footer (`true`, `false`)
- `RATE_LIMIT_DELAY` - Delay between API requests (ms)
- `MAX_RETRIES` - Maximum retry attempts
- `DEBUG` - Enable debug mode (`true`, `false`)

## Getting Help

- **Configuration Issues**: Run `ai-changelog validate --verbose`
- **Provider Problems**: Check provider-specific troubleshooting above
- **API Errors**: Enable debug mode with `DEBUG=ai-changelog*`
- **Community Support**: [GitHub Discussions](https://github.com/entro314-labs/AI-changelog-generator/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/entro314-labs/AI-changelog-generator/issues)