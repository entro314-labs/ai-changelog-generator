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
| **OpenAI** | Cloud | GPT-5.2, GPT-5, o4-mini, o3 | $$$ | Easy |
| **Anthropic** | Cloud | Claude Opus 4.5, Sonnet 4.5 | $$$ | Easy |
| **Google AI** | Cloud | Gemini 3 Pro/Flash, 2.5 Pro | $$ | Easy |
| **Azure OpenAI** | Cloud | GPT-5 series, o3/o4 | $$$ | Medium |
| **Google Vertex** | Cloud | Gemini 3, Claude 4.5 | $$$ | Medium |
| **Hugging Face** | Cloud | DeepSeek, Qwen3, Llama 4 | $ | Easy |
| **Ollama** | Local | Llama 3.3, DeepSeek-R1, Gemma 3 | Free | Medium |
| **LM Studio** | Local | Any GGUF model | Free | Medium |

## Cloud Provider Setup

### OpenAI

**Best for**: Most advanced models, superior reasoning, agentic coding, deep research
**Latest Models**: GPT-5.2 Pro, GPT-5 Pro, GPT-5 Codex, o4-mini, o3/o3-pro, deep research models
**Previous Generation**: GPT-4.1 series, GPT-4o series (still supported as fallback)

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

**Best for**: Coding, agents, computer use, extended thinking, long context
**Latest Models**: Claude 4.5 series (Opus, Sonnet, Haiku) - best for coding/agents
**Previous Generation**: Claude 4.0 series (still supported as fallback)
**Pricing**: Opus 4.5 at $5/$25 per MTok (reduced from previous pricing)

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

**Best for**: Multimodal understanding, visual reasoning, cost-effective, 1M+ context
**Latest Models**: Gemini 3 Pro/Flash (state-of-the-art multimodal)
**Previous Generation**: Gemini 2.5 Pro/Flash (thinking mode, still excellent)
**Note**: Gemini 2.0 Flash retiring March 3, 2026

```bash
# Required
GOOGLE_API_KEY=your-api-key

# Optional
GOOGLE_DEFAULT_MODEL=gemini-3-flash
GOOGLE_API_VERSION=v1
```

**Setup Steps**:

1. Visit [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Create API key
3. Add to `.env.local`
4. Test: `ai-changelog validate --provider google`

### Azure OpenAI

**Best for**: Enterprise, SLAs, Azure AD authentication, priority processing
**Latest Models**: GPT-5 series, o3/o4 reasoning models, deep research models
**Previous Generation**: GPT-4.1 series, GPT-4o (still supported)
**Endpoint**: Uses `/openai/v1` (no api-version parameter required)

```bash
# Required
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/v1
AZURE_OPENAI_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-pro

# Optional - Azure AD Authentication
AZURE_USE_AD_AUTH=true
AZURE_USER_ID=user-123
```

**Setup Steps**:

1. Create Azure OpenAI resource in Azure Portal
2. Deploy a model (e.g., gpt-5-pro or o3)
3. Get endpoint and key from Azure Portal
4. Add to `.env.local`
5. Test: `ai-changelog validate --provider azure`

**Note:** Azure OpenAI now uses the `/openai/v1` endpoint (introduced in 2025). No `api-version` parameter is required. This unified endpoint works with the standard OpenAI SDK. Priority processing tiers available for faster responses.

### Hugging Face

**Best for**: Cost optimization, open models, reasoning models, model variety
**Latest Models**: DeepSeek-R1 (O3-level), DeepSeek-V3 (671B), Qwen 3, Llama 4, Mistral Large 3, Phi-4
**Previous Generation**: Llama 3.3, Qwen 2.5, Mixtral, Gemma 2
**Providers**: Auto-routing to replicate, together, sambanova, fireworks

```bash
# Required
HUGGINGFACE_API_KEY=hf_your-token

# Optional
HUGGINGFACE_MODEL=deepseek-ai/DeepSeek-R1
HUGGINGFACE_PROVIDER=auto  # auto, replicate, together, sambanova, fireworks
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
```

**Setup Steps**:

1. Visit [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create token
3. Add to `.env.local`
4. Test: `ai-changelog validate --provider huggingface`

## Local Provider Setup

### Ollama

**Best for**: Privacy, no API costs, offline usage, reasoning models, vision models
**Latest Models**: Llama 3.3 (70B state-of-the-art), DeepSeek-R1 (reasoning), Gemma 3, Qwen 3, Phi 4, GPT-OSS, Mistral Large 3
**Previous Generation**: Llama 3.2, Llama 3.1, Gemma 2, Qwen 2.5, Mistral 7B
**Special**: 100+ models including vision (llama3.2-vision, qwen3-vl) and coding (qwen3-coder, gpt-oss)

```bash
# Required (usually default)
OLLAMA_HOST=http://localhost:11434

# Optional
OLLAMA_MODEL=llama3.3
```

**Setup Steps**:

1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3.3` or `ollama pull deepseek-r1`
3. Start server: `ollama serve` (usually auto-starts)
4. Add to `.env.local`
5. Test: `ai-changelog validate --provider ollama`

**Model Selection Tips**:
- For reasoning: `deepseek-r1:7b` (fast) or `deepseek-r1:70b` (best quality)
- For general use: `llama3.3` (70B, best performance)
- For coding: `gpt-oss:20b` or `qwen3-coder`
- For vision: `llama3.2-vision` or `qwen3-vl`
- Check RAM: 7B models need ~8GB, 70B models need ~40GB

**Popular Models (Latest Generation - 2026)**:

- `llama3.3` - Meta's latest 70B model (highly recommended, state-of-the-art performance)
- `deepseek-r1` - Reasoning model (1.5B-671B, O3-level performance)
- `gemma3` - Google's latest (270M-27B sizes)
- `qwen3` - Alibaba's latest (0.6B-235B with MoE)
- `phi4` - Microsoft's efficient 14B model
- `phi4-reasoning` - Microsoft's reasoning variant
- `gpt-oss` - Open GPT models (20B-120B)
- `mistral-large-3` - Mistral's latest flagship

**Previous Generation (Fallback Options)**:

- `llama3.2` - Small models (1B-3B)
- `llama3.1` - Previous generation (8B-405B)
- `gemma2` - Previous generation (2B-27B)
- `qwen2.5` - Previous generation (0.5B-72B)
- `mistral` - 7B general purpose
- `codellama` - Specialized for coding

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
# Test with different providers (latest models)
ai-changelog --provider openai --model gpt-5.2-pro
ai-changelog --provider anthropic --model claude-opus-4-5-20251101
ai-changelog --provider google --model gemini-3-pro
ai-changelog --provider ollama --model llama3.3

# Test reasoning models
ai-changelog --provider openai --model o3
ai-changelog --provider ollama --model deepseek-r1:7b

# Test local providers
ai-changelog --provider ollama --model llama3.3
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

**Free Options**:
- Ollama with local models (zero cost, privacy-first)
- DeepSeek-R1 via Ollama (O3-level reasoning, free)
- Llama 3.3 via Ollama (70B state-of-the-art)

**Low-Cost Cloud Options**:
- DeepSeek-R1 via Hugging Face (O3-level at fraction of cost)
- Gemini 3 Flash (excellent price/performance)
- GPT-4.1-mini (cost-optimized OpenAI)

**Cost-Saving Features**:
- Batch APIs: 50% discount for non-urgent requests (OpenAI, Anthropic)
- Prompt caching: Claude 4.5 (5-min or 1-hour cache options)
- Priority tiers: Flex processing for lower prices (OpenAI)
- Monitor token usage with detailed logging

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
- `OPENAI_MODEL` - Default model (e.g., `gpt-5.2-pro`, `gpt-5-pro`, `o3`)

### Anthropic

- `ANTHROPIC_API_KEY` - API key (required)
- `ANTHROPIC_API_URL` - Custom endpoint (optional)
- `ANTHROPIC_MODEL` - Default model (e.g., `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`)

### Google AI

- `GOOGLE_API_KEY` - API key (required)
- `GOOGLE_DEFAULT_MODEL` - Default model (e.g., `gemini-3-pro`, `gemini-3-flash`, `gemini-2.5-pro`)

### Azure OpenAI

- `AZURE_OPENAI_ENDPOINT` - Resource endpoint with `/openai/v1` path (required)
- `AZURE_OPENAI_KEY` - API key (required)
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Model deployment name (required)
- Note: No `AZURE_OPENAI_API_VERSION` needed with v1 endpoint

### Hugging Face

- `HUGGINGFACE_API_KEY` - API token (required)
- `HUGGINGFACE_MODEL` - Default model (e.g., `deepseek-ai/DeepSeek-R1`, `Qwen/Qwen3-72B-Instruct`, `meta-llama/Llama-4-70B-Instruct`)
- `HUGGINGFACE_PROVIDER` - Provider routing (`auto`, `replicate`, `together`, `sambanova`, `fireworks`)

### Local Providers

- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Default model (e.g., `llama3.3`, `deepseek-r1:7b`, `gemma3`, `qwen3`)
- `LMSTUDIO_API_BASE` - LM Studio server URL (default: `http://localhost:1234/v1`)
- `LMSTUDIO_API_KEY` - API key (usually `lm-studio`)

### Application Settings

- `DEFAULT_ANALYSIS_MODE` - Analysis depth (`standard`, `detailed`, `enterprise`)
- `OUTPUT_FORMAT` - Output format (`markdown`, `json`)
- `INCLUDE_ATTRIBUTION` - Include attribution footer (`true`, `false`)
- `RATE_LIMIT_DELAY` - Delay between API requests (ms)
- `MAX_RETRIES` - Maximum retry attempts
- `DEBUG` - Enable debug mode (`true`, `false`)

## Model Recommendations by Use Case

### Best for Coding/Development
- **Cloud**: Claude Opus 4.5, GPT-5 Codex, DeepSeek-V3
- **Local**: GPT-OSS, Qwen3-Coder, DeepSeek-Coder-V2

### Best for Reasoning/Analysis
- **Cloud**: o3/o3-pro, DeepSeek-R1, Gemini 2.5 Pro
- **Local**: DeepSeek-R1 (7B-671B), Phi4-Reasoning

### Best for Cost Efficiency
- **Cloud**: Gemini 3 Flash, GPT-4.1-mini, DeepSeek-R1
- **Local**: Llama 3.3, Gemma3, Phi4

### Best for Multimodal
- **Cloud**: Gemini 3 Pro, GPT-4o, Claude Opus 4.5
- **Local**: Llama3.2-Vision, Qwen3-VL, MiniCPM-V

### Best for Long Context
- **Cloud**: Gemini 3 (1M+ tokens), Claude 4.5 (200K-1M), GPT-5 (128K)
- **Local**: Qwen3 (128K), Llama 3.3 (128K)

## Getting Help

- **Configuration Issues**: Run `ai-changelog validate --verbose`
- **Provider Problems**: Check provider-specific troubleshooting above
- **API Errors**: Enable debug mode with `DEBUG=ai-changelog*`
- **Community Support**: [GitHub Discussions](https://github.com/entro314-labs/AI-changelog-generator/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/entro314-labs/AI-changelog-generator/issues)
