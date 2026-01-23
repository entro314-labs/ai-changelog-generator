# AI Providers Troubleshooting Guide

This guide provides solutions for common issues encountered when working with AI providers in the changelog generator.

## Table of Contents

- [General Troubleshooting](#general-troubleshooting)
- [Provider-Specific Issues](#provider-specific-issues)
  - [OpenAI](#openai)
  - [Azure OpenAI](#azure-openai)
  - [Anthropic Claude](#anthropic-claude)
  - [Google AI (Gemini)](#google-ai-gemini)
  - [Vertex AI](#vertex-ai)
  - [Ollama](#ollama)
  - [LM Studio](#lm-studio)
  - [Hugging Face](#hugging-face)
- [Configuration Issues](#configuration-issues)
- [Connection Issues](#connection-issues)
- [Model Selection Issues](#model-selection-issues)
- [Completion Generation Issues](#completion-generation-issues)

## General Troubleshooting

### No AI Provider Available

**Symptoms:**

- Error message: "No AI provider is available"
- Fallback to rule-based changelog generation

**Solutions:**

1. Run the configuration wizard to set up provider credentials:

   ```
   node lib/utils/config-wizard.js
   ```

2. Check your `.env.local` file to ensure at least one provider has the required credentials
3. Verify network connectivity to the provider's API endpoints
4. Check if your API keys are valid and have not expired

### Provider Not Found

**Symptoms:**

- Error message: "Provider [name] not found"

**Solutions:**

1. Check the spelling of the provider name in your configuration
2. Verify that the provider implementation exists in the `lib/providers` directory
3. Ensure the provider name matches one of the supported providers: `openai`, `azure`, `anthropic`, `google`, `vertex`, `ollama`, `lmstudio`, `huggingface`

### Provider Not Available

**Symptoms:**

- Error message: "Provider [name] is not available"

**Solutions:**

1. Check that all required configuration values for the provider are set in your `.env.local` file
2. Verify that the provider's service is running (especially for local providers like Ollama and LM Studio)
3. Check if your API key has sufficient quota/credits

## Provider-Specific Issues

### OpenAI

**Common Issues:**

1. **API Key Invalid**
   - Error: "Incorrect API key provided"
   - Solution: Verify your API key in the OpenAI dashboard and update `OPENAI_API_KEY` in your `.env.local` file

2. **Rate Limits**
   - Error: "Rate limit exceeded" or "You exceeded your current quota"
   - Solution: Check your usage in the OpenAI dashboard, upgrade your plan, or use priority/flex processing tiers. Consider batch API for 50% discount on non-urgent requests.

3. **Model Not Available**
   - Error: "The model [model] does not exist"
   - Solution: Use latest generation models:
     - **Latest**: `gpt-5.2-pro`, `gpt-5-pro`, `gpt-5-codex`, `o4-mini`, `o3`, `o3-pro`, `o3-deep-research`
     - **Previous Gen (Fallback)**: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`
     - **Deprecated**: `gpt-4.5-preview`, `o1`, `o1-mini`, `o1-preview`

4. **Reasoning Token Costs**
   - Issue: Unexpected costs with o3/o4 models
   - Solution: Reasoning tokens (hidden internal thinking) are billed as output tokens. Monitor usage carefully with reasoning models.

### Azure OpenAI

**Common Issues:**

1. **Deployment Not Found**
   - Error: "The API deployment for this resource does not exist"
   - Solution: Verify your deployment name in the Azure portal and ensure it matches what you're using. Check that you've deployed GPT-5 series models if using latest API version.

2. **Authentication Issues**
   - Error: "Authentication failed"
   - Solution: Check your API key and endpoint URL in your `.env.local` file. Verify Azure AD authentication if enabled.

3. **Endpoint Configuration Issues**
   - Error: "Invalid endpoint" or "404 Not Found"
   - Solution: Azure OpenAI now uses `/openai/v1` endpoint. Update `AZURE_OPENAI_ENDPOINT` to include `/openai/v1` path (e.g., `https://your-resource.openai.azure.com/openai/v1`). No `api-version` parameter is required with the v1 endpoint.

4. **Region Mismatch**
   - Error: "The resource [resource] is not available in the region [region]"
   - Solution: Ensure your endpoint URL matches the region where your deployment is located. Some models may have limited regional availability.

### Anthropic Claude

**Common Issues:**

1. **API Key Invalid**
   - Error: "Invalid API key"
   - Solution: Verify your API key in the Anthropic console and update `ANTHROPIC_API_KEY` in your `.env.local` file

2. **Model Not Available**
   - Error: "Model [model] not found"
   - Solution: Use current model names:
     - **Latest (4.5 Series)**: `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`
     - **Previous Gen (4.0 Series)**: `claude-opus-4-20250617`, `claude-sonnet-4-20250514`, `claude-haiku-4-20250320`
     - **Deprecated**: Claude 3.5 series and earlier

3. **Content Policy Violation**
   - Error: "Your request was rejected as a result of our safety system"
   - Solution: Review your prompt content to ensure it complies with Anthropic's content policy

4. **Context Window Exceeded**
   - Error: "Prompt is too long"
   - Solution: Claude 4.5 supports 200K tokens by default, 1M with `context-1m-2025-08-07` beta header. Check your input size and use appropriate context window.

5. **Extended Thinking Costs**
   - Issue: Higher costs with extended thinking feature
   - Solution: Extended thinking tokens are billed separately. Use for complex reasoning tasks only. Monitor usage in API responses.

6. **Prompt Caching Not Working**
   - Issue: Not seeing cache benefits
   - Solution: Claude 4.5 supports 5-minute (default) and 1-hour cache durations. Ensure you're sending identical prompt prefixes. Cache writes are 1.25x (5-min) or 2x (1-hour) base price, but cache hits are only 0.1x.

### Google AI (Gemini)

**Common Issues:**

1. **API Key Invalid**
   - Error: "API key not valid"
   - Solution: Verify your API key in the Google AI Studio and update `GOOGLE_API_KEY` in your `.env.local` file

2. **Model Not Available**
   - Error: "Model [model] not found"
   - Solution: Use current model names:
     - **Latest (Gemini 3)**: `gemini-3-pro`, `gemini-3-pro-preview`, `gemini-3-flash`, `gemini-3-flash-preview`
     - **Previous Gen (Gemini 2.5)**: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
     - **Retiring March 3, 2026**: `gemini-2.0-flash`, `gemini-2.0-flash-lite`

3. **Safety Filters**
   - Error: "Safety settings triggered"
   - Solution: Review your prompt content or adjust safety settings in your request

4. **Model Alias Changes**
   - Issue: Unexpected model behavior after January 21, 2026
   - Solution: `gemini-pro-latest` now points to `gemini-3-pro-preview` and `gemini-flash-latest` points to `gemini-3-flash-preview`. Use specific model versions for consistent behavior.

5. **Grounding with Google Search Billing**
   - Issue: Unexpected charges for grounding feature
   - Solution: Grounding with Google Search billing started January 5, 2026. Monitor usage if using this feature.

6. **Multimodal Function Responses**
   - Issue: Function responses not working with images
   - Solution: Gemini 3 supports multimodal function responses. Ensure you're using `gemini-3-flash` or `gemini-3-pro`, not older versions.

### Vertex AI

**Common Issues:**

1. **Authentication Issues**
   - Error: "Failed to authenticate to Google Cloud"
   - Solution: Verify your service account credentials and ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid JSON key file

2. **Project ID Invalid**
   - Error: "Project [project] not found"
   - Solution: Check your project ID in the Google Cloud console and update `VERTEX_PROJECT_ID` in your `.env.local` file

3. **Location Not Available**
   - Error: "Location [location] not found"
   - Solution: Verify that the model you're trying to use is available in your specified location

### Ollama

**Common Issues:**

1. **Connection Refused**
   - Error: "Connection refused" or "ECONNREFUSED"
   - Solution: Ensure Ollama is running locally and accessible at the URL specified in `OLLAMA_HOST`. Start with `ollama serve` if needed.

2. **Model Not Pulled**
   - Error: "Model [model] not found"
   - Solution: Pull the model using the Ollama CLI: `ollama pull llama3.3` or `ollama pull deepseek-r1`. Check available models at ollama.com/library

3. **Resource Constraints**
   - Error: "Not enough memory" or performance issues
   - Solution: Use smaller model variants (e.g., `deepseek-r1:7b` instead of `deepseek-r1:70b`, or `gemma3:4b` instead of `gemma3:27b`). Check RAM requirements before pulling large models.

4. **Model Version Confusion**
   - Issue: Outdated model behavior
   - Solution: Ollama updates models regularly. Use `ollama pull [model]` to get latest versions.
     - **Latest Generation**: `llama3.3` (70B state-of-the-art), `deepseek-r1`, `gemma3`, `qwen3`, `phi4`, `phi4-reasoning`, `gpt-oss`, `mistral-large-3`
     - **Previous Generation**: `llama3.2`, `llama3.1`, `gemma2`, `qwen2.5`, `mistral`

5. **Reasoning Model Performance**
   - Issue: Slow response with reasoning models
   - Solution: Reasoning models like `deepseek-r1` generate internal thoughts before answers. This is expected. Use smaller variants (1.5B-7B) for faster responses.

### LM Studio

**Common Issues:**

1. **Server Not Running**
   - Error: "Connection refused" or "ECONNREFUSED"
   - Solution: Start the LM Studio server and ensure it's accessible at the URL specified in `LMSTUDIO_API_BASE`

2. **Model Not Loaded**
   - Error: "No model loaded"
   - Solution: Load a model in the LM Studio interface before making API calls

3. **Incompatible API Format**
   - Error: "Invalid request format"
   - Solution: Ensure you're using the correct API format (OpenAI-compatible) in your requests

### Hugging Face

**Common Issues:**

1. **API Key Invalid**
   - Error: "Invalid API token"
   - Solution: Verify your API key in the Hugging Face settings and update `HUGGINGFACE_API_KEY` in your `.env.local` file

2. **Model Not Available**
   - Error: "Model [model] not found"
   - Solution: Check if the model exists on Hugging Face Hub and is available through the Inference API.
     - **Latest Generation**: `deepseek-ai/DeepSeek-R1`, `deepseek-ai/DeepSeek-V3`, `Qwen/Qwen3-72B-Instruct`, `meta-llama/Llama-4-70B-Instruct`, `mistralai/Mistral-Large-3`, `microsoft/phi-4`
     - **Previous Generation**: `meta-llama/Llama-3.3-70B-Instruct`, `Qwen/Qwen2.5-72B-Instruct`, `mistralai/Mixtral-8x22B-Instruct-v0.1`

3. **Rate Limits**
   - Error: "Rate limit exceeded"
   - Solution: Check your usage in the Hugging Face dashboard or upgrade your plan. Free tier has clear rate limits now.

4. **Provider Routing Issues**
   - Issue: Model not loading or slow responses
   - Solution: Try different provider routing: `HUGGINGFACE_PROVIDER=auto` (default), or specify `replicate`, `together`, `sambanova`, `fireworks`. Auto-routing usually works best.

5. **DeepSeek Model Access**
   - Issue: DeepSeek-R1 or DeepSeek-V3 not accessible
   - Solution: These models may require specific inference providers. Check model card on Hugging Face for supported inference options.

## Configuration Issues

### Missing Environment Variables

**Symptoms:**

- Provider not available despite being installed
- Error messages about missing configuration

**Solutions:**

1. Run the configuration wizard to set up missing variables:

   ```
   node lib/utils/config-wizard.js
   ```

2. Manually add the required variables to your `.env.local` file
3. Check the provider's documentation for the specific variables needed

### Invalid Configuration Format

**Symptoms:**

- Provider fails to initialize despite having configuration
- Error messages about invalid configuration format

**Solutions:**

1. Check the format of your configuration values (e.g., URLs should include protocol)
2. Ensure there are no extra spaces or quotes in your `.env.local` file
3. Verify that the configuration matches the expected format for the provider

## Connection Issues

### Network Connectivity

**Symptoms:**

- Timeout errors
- Connection refused errors

**Solutions:**

1. Check your internet connection
2. Verify that the provider's API endpoint is accessible from your network
3. Check if a proxy or firewall is blocking the connection

### API Endpoint Issues

**Symptoms:**

- 404 Not Found errors
- Invalid endpoint errors

**Solutions:**

1. Verify that the API endpoint URL is correct
2. Check if the provider has changed their API endpoints
3. Ensure you're using the correct API version

## Model Selection Issues

### Model Not Found

**Symptoms:**

- Error message: "Model [model] not found"
- Model validation fails

**Solutions:**

1. Check if the model exists in the provider's model list
2. Verify that you have access to the model in your account
3. Update your model selection to use an available model
4. **2026 Model Updates:**
   - **OpenAI Latest**: `gpt-5.2-pro`, `gpt-5-pro`, `gpt-5-codex`, `o4-mini`, `o3`, `o3-pro`, `o3-deep-research`
   - **OpenAI Previous Gen**: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`
   - **Anthropic Latest**: `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251101`
   - **Anthropic Previous Gen**: `claude-opus-4-20250617`, `claude-sonnet-4-20250514`
   - **Google Latest**: `gemini-3-pro`, `gemini-3-flash`, `gemini-3-pro-preview`, `gemini-3-flash-preview`
   - **Google Previous Gen**: `gemini-2.5-pro`, `gemini-2.5-flash`
   - **Ollama Latest**: `llama3.3` (70B), `deepseek-r1`, `gemma3`, `qwen3`, `phi4`, `gpt-oss`
   - **Ollama Previous Gen**: `llama3.2`, `llama3.1`, `gemma2`, `qwen2.5`

### Model Recommendation Issues

**Symptoms:**

- Inappropriate model selected for the task
- Performance issues with generated changelogs

**Solutions:**

1. Check the model recommendation logic in the provider implementation
2. Adjust the model selection criteria based on your specific needs
3. Override the model selection with a specific model in your configuration

## New 2026-Specific Issues

### Reasoning Model Performance

**Symptoms:**

- Slow responses with reasoning models
- High token usage

**Solutions:**

1. Reasoning models (o3, o4-mini, DeepSeek-R1) generate internal thoughts before answers
2. This is expected behavior for better quality
3. For faster responses:
   - Use smaller reasoning models (o4-mini, deepseek-r1:7b)
   - Use non-reasoning models for simple tasks
   - Consider cost vs quality tradeoff
4. Monitor reasoning token usage separately from output tokens

### Model Deprecation Warnings

**Symptoms:**

- Warnings about model deprecation
- Models scheduled for retirement

**Solutions:**

1. **Gemini 2.0 Flash**: Retiring March 3, 2026 - migrate to Gemini 2.5 or 3
2. **Legacy OpenAI models**: GPT-4.5-preview, o1-preview deprecated - use GPT-5 or o3 series
3. **Claude 3.5 series**: Migrate to Claude 4.0 or 4.5 series
4. Check provider documentation for deprecation schedules
5. Use specific model versions in production to avoid automatic migrations

### Priority Processing Issues

**Symptoms:**

- Slow response times despite priority tier
- Unexpected latency

**Solutions:**

1. Verify you're using priority processing tier (OpenAI, Azure)
2. Check service tier configuration in API settings
3. Consider flex processing for lower cost but higher latency
4. Monitor rate limits - priority tier has different limits

## Completion Generation Issues

### Content Filtering

**Symptoms:**

- Empty responses
- Error messages about content policy violations

**Solutions:**

1. Review your prompt content to ensure it complies with the provider's content policy
2. Adjust your prompt to avoid triggering content filters
3. Try a different provider with less strict content filtering

### Token Limits

**Symptoms:**

- Truncated responses
- Error messages about token limits

**Solutions:**

1. Reduce the size of your input prompt
2. Increase the `max_tokens` parameter if supported by the provider
3. Split large requests into smaller chunks
4. **2026 Context Windows:**
   - **GPT-5 series**: 128K tokens standard
   - **Claude 4.5**: 200K tokens default, 1M with `context-1m-2025-08-07` beta header
   - **Gemini 3**: 1M+ tokens (best for long context)
   - **Gemini 2.5 Pro**: 1M tokens
   - **DeepSeek-R1**: Varies by size (check model card)
   - **Llama 4/3.3**: 128K tokens
   - **Qwen 3**: 128K tokens
5. **Reasoning Models:** Remember that reasoning tokens (internal thinking) count toward context window and are billed as output tokens.
6. **Deep Research Models:** o3-deep-research and o4-mini-deep-research have special token handling for research tasks.

### Response Format Issues

**Symptoms:**

- Malformed JSON responses
- Unexpected response structure

**Solutions:**

1. Check if the provider supports the requested response format
2. Adjust your prompt to guide the model to produce the desired format
3. Implement post-processing to handle variations in response format
4. **2026 Features:**
   - **Gemini 3**: Multimodal function responses, code execution with images, upgraded visual/spatial reasoning
   - **Claude 4.5**: Extended thinking mode (separate thinking tokens), 1M context with beta header, prompt caching (5-min/1-hour)
   - **GPT-5**: Enhanced structured output support, AgentKit for production agents, priority/flex processing tiers
   - **DeepSeek-R1**: O3-level reasoning at lower cost, open-source reasoning model
5. Use JSON mode or structured output features when available for consistent formatting
6. **Batch APIs**: Use for 50% discount on non-urgent requests (OpenAI, Anthropic)
