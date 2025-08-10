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
   - Solution: Check your usage in the OpenAI dashboard, upgrade your plan, or implement rate limiting in your application

3. **Model Not Available**
   - Error: "The model [model] does not exist"
   - Solution: Check available models in your OpenAI account and update your model selection

### Azure OpenAI

**Common Issues:**

1. **Deployment Not Found**
   - Error: "The API deployment for this resource does not exist"
   - Solution: Verify your deployment name in the Azure portal and ensure it matches what you're using

2. **Authentication Issues**
   - Error: "Authentication failed"
   - Solution: Check your API key and endpoint URL in your `.env.local` file

3. **Region Mismatch**
   - Error: "The resource [resource] is not available in the region [region]"
   - Solution: Ensure your endpoint URL matches the region where your deployment is located

### Anthropic Claude

**Common Issues:**

1. **API Key Invalid**
   - Error: "Invalid API key"
   - Solution: Verify your API key in the Anthropic console and update `ANTHROPIC_API_KEY` in your `.env.local` file

2. **Model Not Available**
   - Error: "Model [model] not found"
   - Solution: Check available models in your Anthropic account and update your model selection

3. **Content Policy Violation**
   - Error: "Your request was rejected as a result of our safety system"
   - Solution: Review your prompt content to ensure it complies with Anthropic's content policy

### Google AI (Gemini)

**Common Issues:**

1. **API Key Invalid**
   - Error: "API key not valid"
   - Solution: Verify your API key in the Google AI Studio and update `GOOGLE_API_KEY` in your `.env.local` file

2. **Model Not Available**
   - Error: "Model [model] not found"
   - Solution: Check available models in Google AI Studio and update your model selection

3. **Safety Filters**
   - Error: "Safety settings triggered"
   - Solution: Review your prompt content or adjust safety settings in your request

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
   - Solution: Ensure Ollama is running locally and accessible at the URL specified in `OLLAMA_HOST`

2. **Model Not Pulled**
   - Error: "Model [model] not found"
   - Solution: Pull the model using the Ollama CLI: `ollama pull [model]`

3. **Resource Constraints**
   - Error: "Not enough memory" or performance issues
   - Solution: Adjust model parameters or use a smaller model that fits your hardware constraints

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
   - Solution: Check if the model exists on Hugging Face Hub and is available through the Inference API

3. **Rate Limits**
   - Error: "Rate limit exceeded"
   - Solution: Check your usage in the Hugging Face dashboard or upgrade your plan

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

### Model Recommendation Issues

**Symptoms:**

- Inappropriate model selected for the task
- Performance issues with generated changelogs

**Solutions:**

1. Check the model recommendation logic in the provider implementation
2. Adjust the model selection criteria based on your specific needs
3. Override the model selection with a specific model in your configuration

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

### Response Format Issues

**Symptoms:**

- Malformed JSON responses
- Unexpected response structure

**Solutions:**

1. Check if the provider supports the requested response format
2. Adjust your prompt to guide the model to produce the desired format
3. Implement post-processing to handle variations in response format
