# Complete AI Providers & Models Integration Guide for JavaScript (2025)

## Table of Contents
1. [OpenAI](#1-openai)
2. [Azure OpenAI](#2-azure-openai)
3. [Anthropic Claude](#3-anthropic-claude)
4. [Google AI (Gemini)](#4-google-ai-gemini)
5. [Google Vertex AI](#5-google-vertex-ai)
6. [Azure AI](#6-azure-ai)
7. [Ollama](#7-ollama)
8. [LM Studio](#8-lm-studio)
9. [Hugging Face](#9-hugging-face)
10. [Plugin Architecture Implementation](#10-plugin-architecture-implementation)

---

## 1. OpenAI

### Installation & Setup
```bash
npm install openai@5.9.0
```

### Latest Models (2025)
- **GPT-4o**: Latest flagship model
- **o1**: Advanced reasoning model
- **o3/o4**: Next-generation reasoning models (Azure-only)
- **GPT-4.1 series**: Nano, Mini, Standard variants with prompt caching
- **DALL-E**: Image generation
- **Whisper**: Speech-to-text

### JavaScript Integration
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Default from env
});

// Chat Completion
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'developer', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, how are you?' }
  ],
  max_tokens: 1000,
  temperature: 0.3
});

console.log(completion.choices[0].message.content);

// Streaming Response
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}

// Image Generation
const image = await client.images.generate({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset over mountains',
  n: 1,
  size: '1024x1024'
});

// Function Calling
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What\'s the weather like?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' }
        },
        required: ['location']
      }
    }
  }],
  tool_choice: 'auto'
});
```

### Configuration Options
```javascript
const client = new OpenAI({
  apiKey: 'your-api-key',
  organization: 'your-org-id', // Optional
  project: 'your-project-id', // Optional
  baseURL: 'https://api.openai.com/v1', // Default
  timeout: 60000, // 60 seconds
  maxRetries: 2,
  httpAgent: customAgent // Optional custom HTTP agent
});
```

---

## 2. Azure OpenAI

### Installation & Setup
```bash
npm install openai@5.9.0
npm install @azure/identity
```

### Latest API Versions
- **2025-04-01-preview**: Latest preview with v1 API support
- **2024-10-21**: Current GA release
- **v1 API**: New unified API (recommended)

### JavaScript Integration
```javascript
import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

// Method 1: API Key Authentication
const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: '2025-04-01-preview',
  azureEndpoint: 'https://your-resource.openai.azure.com'
});

// Method 2: Azure AD Authentication (Recommended)
const credential = new DefaultAzureCredential();
const azureADTokenProvider = getBearerTokenProvider(
  credential, 
  'https://cognitiveservices.azure.com/.default'
);

const clientWithAD = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '2025-04-01-preview',
  azureEndpoint: 'https://your-resource.openai.azure.com'
});

// Chat Completion with Azure-specific features
const completion = await client.chat.completions.create({
  model: 'gpt-4o', // Your deployment name
  messages: [{ role: 'user', content: 'Hello Azure!' }],
  max_tokens: 500,
  // Azure-specific parameters
  user: 'user-123',
  stream: false
});

// Azure Content Filtering
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me about safety.' }],
  stream: true
});

for await (const event of response) {
  for (const choice of event.choices) {
    console.log(`Content: ${choice.delta?.content}`);
    
    // Check Azure content filters
    const filters = choice.content_filter_results;
    if (filters) {
      console.log(`Hate filtered: ${filters.hate?.filtered}`);
      console.log(`Violence filtered: ${filters.violence?.filtered}`);
    }
  }
}

// Using v1 API (New Unified API)
import { OpenAI } from 'openai';

const v1Client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: 'https://your-resource.openai.azure.com/openai/v1/',
  defaultQuery: { 'api-version': 'preview' }
});

const v1Response = await v1Client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello v1 API!' }]
});
```

### Azure-Specific Features
```javascript
// On Your Data (Azure Cognitive Search integration)
const dataResponse = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is in my documents?' }],
  data_sources: [{
    type: 'azure_search',
    parameters: {
      endpoint: 'https://your-search.search.windows.net',
      index_name: 'your-index',
      authentication: {
        type: 'api_key',
        key: 'your-search-key'
      }
    }
  }]
});
```

---

## 3. Anthropic Claude

### Installation & Setup
```bash
npm install @anthropic-ai/sdk@0.56.0
```

### Latest Models (2025)
- **Claude Sonnet 4**: Latest balanced model
- **Claude Opus 4**: Most capable model for complex tasks
- **Claude 3.7 Sonnet**: Previous generation
- **Claude 3.5 Haiku/Sonnet**: Fast and efficient models

### JavaScript Integration
```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Basic Message
const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }]
});

console.log(message.content);

// Streaming Response
const stream = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Tell me a story about AI.' }],
  stream: true,
});

for await (const messageStreamEvent of stream) {
  console.log(messageStreamEvent.type);
  if (messageStreamEvent.type === 'content_block_delta') {
    console.log(messageStreamEvent.delta.text);
  }
}

// Tool Use (Function Calling)
const toolResponse = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  tools: [{
    name: 'get_weather',
    description: 'Get the current weather in a given location',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA'
        }
      },
      required: ['location']
    }
  }],
  messages: [{ role: 'user', content: 'What\'s the weather in New York?' }]
});

// File Upload (Beta)
import fs from 'fs';
import { toFile } from '@anthropic-ai/sdk';

const fileUpload = await client.beta.files.upload({
  file: await toFile(fs.createReadStream('/path/to/file.pdf')),
  betas: ['files-api-2025-04-14']
});

// Message Batches (for bulk processing)
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: 'request-1',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello, world' }]
      }
    },
    {
      custom_id: 'request-2',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'How are you?' }]
      }
    }
  ]
});

// Browser Support (with CORS)
const browserClient = new Anthropic({
  apiKey: 'your-api-key',
  // Enable dangerous direct browser access
  dangerouslyAllowBrowser: true
});
```

### Claude Code SDK
```bash
npm install -g @anthropic-ai/claude-code
```

```javascript
// Using Claude Code SDK for development workflows
import { ClaudeCode } from '@anthropic-ai/claude-code';

const claude = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Run code analysis
const analysis = await claude.analyze({
  files: ['src/**/*.js'],
  prompt: 'Review this code for security issues'
});
```

---

## 4. Google AI (Gemini)

### Installation & Setup
```bash
npm install @google/genai@1.9.0
```

### Latest Models (2025)
- **Gemini 2.5 Flash**: Fastest model
- **Gemini 2.5 Pro**: Most capable with thinking mode
- **Gemini 2.0 Flash**: Multimodal capabilities
- **Gemini 1.5 Pro/Flash**: Previous generation (deprecated for new projects)

### JavaScript Integration
```javascript
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Basic Text Generation
const response = await client.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Explain quantum computing in simple terms'
});

console.log(response.text);

// Streaming Response
const streamResponse = await client.models.generateContentStream({
  model: 'gemini-2.5-flash',
  contents: 'Write a poem about technology'
});

for await (const chunk of streamResponse) {
  console.log(chunk.text);
}

// Multimodal Input (Text + Image)
import fs from 'fs';

const imageData = fs.readFileSync('image.jpg');
const multimodalResponse = await client.models.generateContent({
  model: 'gemini-2.0-flash-001',
  contents: [
    {
      parts: [
        { text: 'What do you see in this image?' },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData.toString('base64')
          }
        }
      ]
    }
  ]
});

// Function Calling
const functionResponse = await client.models.generateContent({
  model: 'gemini-2.0-flash-001',
  contents: 'Turn on the lights in the living room',
  config: {
    tools: [{
      functionDeclarations: [{
        name: 'controlLight',
        description: 'Control smart lights',
        parameters: {
          type: 'object',
          properties: {
            room: { type: 'string', description: 'Room name' },
            action: { type: 'string', enum: ['on', 'off', 'dim'] }
          },
          required: ['room', 'action']
        }
      }]
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['controlLight']
      }
    }
  }
});

console.log(response.functionCalls);

// Chat Session
const chat = client.models.startChat({
  model: 'gemini-2.5-flash',
  history: [
    { role: 'user', parts: [{ text: 'Hello' }] },
    { role: 'model', parts: [{ text: 'Hi there! How can I help you?' }] }
  ]
});

const chatResponse = await chat.sendMessage('Tell me about AI');
console.log(chatResponse.text);

// MCP Integration (Experimental)
import { mcpToTool } from '@google/genai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const mcpClient = new Client(/* MCP configuration */);
const mcpTool = mcpToTool(mcpClient);

const mcpResponse = await client.models.generateContent({
  model: 'gemini-2.0-flash-001',
  contents: 'Use the MCP tool to fetch data',
  config: {
    tools: [mcpTool]
  }
});
```

### Configuration Options
```javascript
const client = new GoogleGenAI({
  apiKey: 'your-api-key',
  baseUrl: 'https://generativelanguage.googleapis.com', // Default
  apiVersion: 'v1', // Default is 'v1beta'
});
```

---

## 5. Google Vertex AI

### Installation & Setup
```bash
npm install @google/genai@1.9.0
```

### Setup for Vertex AI
```javascript
import { GoogleGenAI } from '@google/genai';

// Method 1: Using environment variables
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT='your-project-id'
export GOOGLE_CLOUD_LOCATION='us-central1'

const client = new GoogleGenAI();

// Method 2: Explicit configuration
const vertexClient = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
  apiVersion: 'v1'
});

// Basic Usage (same API as Gemini Developer API)
const response = await vertexClient.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Hello from Vertex AI!'
});

// Using Google Cloud Authentication
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

const authClient = await auth.getClient();
const accessToken = await authClient.getAccessToken();

const authenticatedClient = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
  apiKey: accessToken.token
});

// OpenAI-Compatible Endpoint (Vertex AI)
import OpenAI from 'openai';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});
const authClient = await auth.getClient();
const accessToken = await authClient.getAccessToken();

const openaiCompatible = new OpenAI({
  baseURL: `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi`,
  apiKey: accessToken.token
});

const openaiResponse = await openaiCompatible.chat.completions.create({
  model: 'google/gemini-2.0-flash-001',
  messages: [{ role: 'user', content: 'Hello from OpenAI-compatible API!' }]
});
```

---

## 6. Azure AI

### Installation & Setup
```bash
npm install @azure/openai@2.0.0
npm install @azure/identity
```

### Azure AI Foundry Integration
```javascript
import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';

// Azure AI Foundry (successor to Azure OpenAI)
const credential = new DefaultAzureCredential();
const client = new AzureOpenAI({
  azureADTokenProvider: getBearerTokenProvider(credential, 'https://cognitiveservices.azure.com/.default'),
  apiVersion: '2025-04-01-preview',
  azureEndpoint: 'https://your-ai-foundry-resource.cognitiveservices.azure.com'
});

// Multi-modal capabilities
const multiModalResponse = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What do you see in this image?' },
      { 
        type: 'image_url', 
        image_url: { url: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA...' }
      }
    ]
  }]
});

// Speech Services Integration
import { SpeechConfig, SpeechSynthesizer } from 'microsoft-cognitiveservices-speech-sdk';

const speechConfig = SpeechConfig.fromSubscription('your-key', 'your-region');
const synthesizer = new SpeechSynthesizer(speechConfig);

// Text-to-Speech
synthesizer.speakTextAsync('Hello from Azure AI!');

// Azure Computer Vision
const visionResponse = await fetch('https://your-vision-endpoint.cognitiveservices.azure.com/vision/v3.2/analyze', {
  method: 'POST',
  headers: {
    'Ocp-Apim-Subscription-Key': 'your-vision-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com/image.jpg'
  })
});
```

---

## 7. Ollama

### Installation & Setup
```bash
npm install ollama
# Install Ollama locally: https://ollama.com/
```

### JavaScript Integration
```javascript
import ollama from 'ollama';

// Basic Chat
const response = await ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }]
});

console.log(response.message.content);

// Streaming Response
const stream = await ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}

// Generate (for completion tasks)
const completion = await ollama.generate({
  model: 'llama3.1',
  prompt: 'The capital of France is',
  stream: false
});

console.log(completion.response);

// List Available Models
const models = await ollama.list();
console.log(models.models);

// Pull a Model
await ollama.pull({ model: 'llama3.1' });

// Create Custom Model
const modelfile = `
FROM llama3.1
PARAMETER temperature 0.8
SYSTEM "You are a helpful coding assistant."
`;

await ollama.create({
  model: 'my-custom-model',
  modelfile: modelfile
});

// Custom Ollama Instance
import { Ollama } from 'ollama';

const customOllama = new Ollama({
  host: 'http://192.168.1.100:11434', // Custom host
  headers: {
    'Authorization': 'Bearer your-token',
    'X-Custom-Header': 'value'
  }
});

// Embeddings
const embeddings = await ollama.embeddings({
  model: 'llama3.1',
  prompt: 'The quick brown fox'
});

console.log(embeddings.embedding);

// Tool Use (Function Calling)
const toolResponse = await ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'What\'s the weather like?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      }
    }
  }]
});

// Abort Requests
const controller = new AbortController();
const promise = ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'Long response...' }],
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

### Browser Usage
```javascript
// For browser environments
import ollama from 'ollama/browser';

const response = await ollama.chat({
  model: 'llama3.1',
  messages: [{ role: 'user', content: 'Hello from browser!' }]
});
```

---

## 8. LM Studio

### Installation & Setup
```bash
npm install @lmstudio/sdk@1.0.0
# Download LM Studio: https://lmstudio.ai/
```

### JavaScript Integration
```javascript
import { LMStudioClient } from '@lmstudio/sdk';

const client = new LMStudioClient();

// Basic Chat
const model = await client.llm.model('llama-3.2-1b-instruct');
const result = await model.respond('What is the meaning of life?');
console.log(result.content);

// Streaming Response
const stream = await model.respondStream('Tell me a story about space');
for await (const chunk of stream) {
  console.log(chunk.content);
}

// Structured Output (with Zod)
import { z } from 'zod';

const bookSchema = z.object({
  title: z.string(),
  author: z.string(),
  year: z.number().int(),
});

const structuredResult = await model.respond('Tell me about The Hobbit', {
  structured: bookSchema
});

const book = structuredResult.parsed;
console.log(book.title); // Properly typed

// Agent Mode (.act() API)
const response = await model.act(
  'What is 12345 multiplied by 54321?',
  [
    {
      name: 'multiply',
      description: 'Multiply two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      },
      implementation: (params) => params.a * params.b
    }
  ],
  {
    onMessage: (message) => console.log('Agent:', message),
    onToolCall: (tool) => console.log('Using tool:', tool.name)
  }
);

// List Available Models
const models = await client.llm.listModels();
console.log(models);

// Load/Unload Models
await client.llm.loadModel('llama-3.2-1b-instruct');
await client.llm.unloadModel('llama-3.2-1b-instruct');

// OpenAI-Compatible API
const openaiClient = new OpenAI({
  baseURL: 'http://localhost:1234/v1',
  apiKey: 'lm-studio' // Can be anything
});

const completion = await openaiClient.chat.completions.create({
  model: 'llama-3.2-1b-instruct',
  messages: [{ role: 'user', content: 'Hello LM Studio!' }]
});

// Browser Support (with CORS enabled in LM Studio)
const browserClient = new LMStudioClient({
  baseUrl: 'http://localhost:1234'
});
```

### LM Studio Python Integration (for comparison)
```python
import lmstudio as lms

# Python SDK example
llm = lms.llm()
prediction = llm.respond_stream("What is a Capybara?")
for token in prediction:
    print(token, end="", flush=True)
```

---

## 9. Hugging Face

### Installation & Setup
```bash
npm install @huggingface/inference@2.8.0
npm install @huggingface/hub@0.15.1
```

### Latest Features (2025)
- **Inference Providers**: Access to 200k+ models via multiple providers
- **Multi-provider support**: Replicate, Together AI, SambaNova, Fal
- **MCP Client**: Model Context Protocol support
- **Unified API**: Single interface for all providers

### JavaScript Integration
```javascript
import { InferenceClient } from '@huggingface/inference';

const client = new InferenceClient(process.env.HF_TOKEN);

// Chat Completion (with provider selection)
const chatResponse = await client.chatCompletion({
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  messages: [{ role: 'user', content: 'Hello, how are you?' }],
  max_tokens: 512,
  provider: 'auto' // or 'replicate', 'together', 'sambanova'
});

console.log(chatResponse.choices[0].message.content);

// Streaming Chat
for await (const chunk of client.chatCompletionStream({
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  max_tokens: 512,
  provider: 'together'
})) {
  console.log(chunk.choices[0].delta.content);
}

// Text Generation
const textResponse = await client.textGeneration({
  model: 'gpt2',
  inputs: 'The future of AI is',
  parameters: {
    max_new_tokens: 100,
    temperature: 0.7
  }
});

// Text-to-Image
const imageResponse = await client.textToImage({
  model: 'black-forest-labs/FLUX.1-dev',
  inputs: 'A beautiful sunset over mountains',
  provider: 'replicate'
});

// Feature Extraction (Embeddings)
const embeddings = await client.featureExtraction({
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  inputs: 'This is a sentence to embed'
});

// Inference Endpoints (Dedicated)
const endpointClient = new InferenceClient(process.env.HF_TOKEN, {
  endpointUrl: 'https://your-endpoint.aws.endpoints.huggingface.cloud/v1/'
});

const endpointResponse = await endpointClient.chatCompletion({
  messages: [{ role: 'user', content: 'Hello from my endpoint!' }]
});

// Multiple Tasks in One Client
const multiClient = new InferenceClient(process.env.HF_TOKEN);

// Sentiment Analysis
const sentiment = await multiClient.textClassification({
  model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
  inputs: 'I love this new AI technology!'
});

// Question Answering
const qa = await multiClient.questionAnswering({
  model: 'deepset/roberta-base-squad2',
  inputs: {
    question: 'What is Hugging Face?',
    context: 'Hugging Face is a company that builds AI tools and models.'
  }
});

// Translation
const translation = await multiClient.translation({
  model: 'Helsinki-NLP/opus-mt-en-fr',
  inputs: 'Hello, how are you?'
});

// Summarization
const summary = await multiClient.summarization({
  model: 'facebook/bart-large-cnn',
  inputs: 'Very long text to summarize...'
});
```

### Hugging Face Hub Integration
```javascript
import { HfApi } from '@huggingface/hub';

const hf = new HfApi({
  accessToken: process.env.HF_TOKEN
});

// Create Repository
await hf.createRepo({
  repo: 'my-username/my-model',
  type: 'model'
});

// Upload Files
await hf.uploadFile({
  repo: 'my-username/my-model',
  file: {
    path: 'pytorch_model.bin',
    content: new Blob([fileContent])
  }
});

// List Models
const models = await hf.listModels({
  search: 'llama',
  filter: 'text-generation'
});

// Model Info
const modelInfo = await hf.modelInfo('meta-llama/Llama-3.1-8B-Instruct');
console.log(modelInfo);
```

### MCP Client (Advanced)
```javascript
import { Agent } from '@huggingface/mcp-client';

const agent = new Agent({
  provider: 'auto',
  model: 'Qwen/Qwen2.5-72B-Instruct',
  apiKey: process.env.HF_TOKEN,
  servers: [{
    command: 'npx',
    args: ['@playwright/mcp@latest']
  }]
});

await agent.loadTools();

for await (const chunk of agent.run('What are trending models on Hugging Face?')) {
  if ('choices' in chunk) {
    const delta = chunk.choices[0]?.delta;
    if (delta.content) {
      console.log(delta.content);
    }
  }
}
```

---

## 10. Plugin Architecture Implementation

Based on the current project analysis, here's how to implement a plugin-based architecture:

### Base Provider Interface
```javascript
// lib/providers/base-provider.js
export class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = this.getName();
  }

  // Abstract methods - must be implemented by providers
  getName() {
    throw new Error('getName() must be implemented');
  }

  async isAvailable() {
    throw new Error('isAvailable() must be implemented');
  }

  async generateCompletion(messages, options = {}) {
    throw new Error('generateCompletion() must be implemented');
  }

  getRequiredConfig() {
    throw new Error('getRequiredConfig() must be implemented');
  }

  getModelCapabilities(model) {
    return {
      reasoning: false,
      largeContext: false,
      promptCaching: false,
      codingOptimized: false,
      streaming: true,
      functions: false
    };
  }

  async validateModelAvailability(model) {
    return { available: true, error: null };
  }

  async selectOptimalModel(commitInfo) {
    return { model: this.getDefaultModel(), capabilities: {} };
  }

  getDefaultModel() {
    throw new Error('getDefaultModel() must be implemented');
  }

  // Common utility methods
  async withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Provider Implementations

#### OpenAI Provider
```javascript
// lib/providers/openai.js
import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2
    });
  }

  getName() {
    return 'openai';
  }

  async isAvailable() {
    return !!this.config.OPENAI_API_KEY;
  }

  getRequiredConfig() {
    return ['OPENAI_API_KEY'];
  }

  getDefaultModel() {
    return 'gpt-4o';
  }

  getModelCapabilities(model) {
    const capabilities = super.getModelCapabilities(model);
    
    if (model.includes('gpt-4')) {
      capabilities.largeContext = true;
      capabilities.functions = true;
      capabilities.codingOptimized = true;
    }
    
    if (model.includes('4.1')) {
      capabilities.promptCaching = true;
    }

    return capabilities;
  }

  async generateCompletion(messages, options = {}) {
    const response = await this.client.chat.completions.create({
      model: options.model || this.getDefaultModel(),
      messages,
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature || 0.3,
      stream: options.stream || false,
      tools: options.tools,
      tool_choice: options.tool_choice
    });

    return {
      content: response.choices[0].message.content,
      usage: response.usage,
      model: response.model,
      finish_reason: response.choices[0].finish_reason
    };
  }

  async selectOptimalModel(commitInfo) {
    const { files, additions, deletions, complex } = commitInfo;
    const totalChanges = additions + deletions;
    const fileCount = files.length;

    let model = 'gpt-4o-mini';
    
    if (fileCount > 20 || totalChanges > 1000 || complex) {
      model = 'gpt-4o';
    } else if (fileCount > 10 || totalChanges > 500) {
      model = 'gpt-4o-mini';
    } else if (totalChanges < 50) {
      model = 'gpt-4o-nano';
    }

    return {
      model,
      capabilities: this.getModelCapabilities(model)
    };
  }
}
```

#### Anthropic Provider
```javascript
// lib/providers/anthropic.js
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base-provider.js';

export class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY
    });
  }

  getName() {
    return 'anthropic';
  }

  async isAvailable() {
    return !!this.config.ANTHROPIC_API_KEY;
  }

  getRequiredConfig() {
    return ['ANTHROPIC_API_KEY'];
  }

  getDefaultModel() {
    return 'claude-sonnet-4-20250514';
  }

  getModelCapabilities(model) {
    const capabilities = super.getModelCapabilities(model);
    
    capabilities.largeContext = true;
    capabilities.functions = true;
    capabilities.reasoning = model.includes('opus');
    
    return capabilities;
  }

  async generateCompletion(messages, options = {}) {
    // Convert OpenAI format to Anthropic format
    const anthropicMessages = messages.filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    
    const systemMessage = messages.find(m => m.role === 'system')?.content;

    const response = await this.client.messages.create({
      model: options.model || this.getDefaultModel(),
      max_tokens: options.max_tokens || 1000,
      messages: anthropicMessages,
      system: systemMessage,
      temperature: options.temperature || 0.3,
      tools: options.tools,
      stream: options.stream || false
    });

    return {
      content: response.content[0].text,
      usage: response.usage,
      model: response.model,
      finish_reason: response.stop_reason
    };
  }
}
```

#### Ollama Provider
```javascript
// lib/providers/ollama.js
import ollama from 'ollama';
import { BaseProvider } from './base-provider.js';

export class OllamaProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = config.OLLAMA_HOST ? 
      new ollama.Ollama({ host: config.OLLAMA_HOST }) : 
      ollama;
  }

  getName() {
    return 'ollama';
  }

  async isAvailable() {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  getRequiredConfig() {
    return []; // Ollama can work without explicit config
  }

  getDefaultModel() {
    return 'llama3.1';
  }

  async generateCompletion(messages, options = {}) {
    const response = await this.client.chat({
      model: options.model || this.getDefaultModel(),
      messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.3,
        num_predict: options.max_tokens || 1000
      }
    });

    return {
      content: response.message.content,
      model: response.model,
      finish_reason: response.done_reason
    };
  }

  async selectOptimalModel(commitInfo) {
    const models = await this.client.list();
    const availableModels = models.models.map(m => m.name);
    
    // Select based on size and capability
    const preferredModels = ['llama3.1:70b', 'llama3.1:8b', 'llama3.1'];
    
    for (const model of preferredModels) {
      if (availableModels.some(m => m.includes(model))) {
        return { model, capabilities: this.getModelCapabilities(model) };
      }
    }
    
    return { 
      model: availableModels[0] || this.getDefaultModel(),
      capabilities: this.getModelCapabilities('')
    };
  }
}
```

### Provider Manager
```javascript
// lib/provider-manager.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ProviderManager {
  constructor(config = {}) {
    this.config = config;
    this.providers = new Map();
    this.activeProvider = null;
  }

  async loadProviders() {
    const providersDir = path.join(__dirname, 'providers');
    const files = fs.readdirSync(providersDir)
      .filter(file => file.endsWith('.js') && file !== 'base-provider.js');

    for (const file of files) {
      try {
        const providerModule = await import(`./providers/${file}`);
        const ProviderClass = Object.values(providerModule)[0];
        
        if (ProviderClass && ProviderClass.prototype.getName) {
          const provider = new ProviderClass(this.config);
          this.providers.set(provider.getName(), provider);
        }
      } catch (error) {
        console.warn(`Failed to load provider ${file}:`, error.message);
      }
    }
  }

  async determineActiveProvider() {
    const providerPriority = [
      'azure',
      'anthropic', 
      'openai',
      'google',
      'ollama',
      'lmstudio',
      'huggingface'
    ];

    for (const providerName of providerPriority) {
      const provider = this.providers.get(providerName);
      if (provider && await provider.isAvailable()) {
        this.activeProvider = provider;
        return provider;
      }
    }

    throw new Error('No available AI providers found');
  }

  getActiveProvider() {
    return this.activeProvider;
  }

  getProvider(name) {
    return this.providers.get(name);
  }

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  async validateConfiguration() {
    const issues = [];
    const recommendations = [];

    for (const [name, provider] of this.providers) {
      const isAvailable = await provider.isAvailable();
      const requiredConfig = provider.getRequiredConfig();
      
      if (!isAvailable) {
        const missingConfig = requiredConfig.filter(key => !this.config[key]);
        if (missingConfig.length > 0) {
          issues.push(`${name}: Missing configuration: ${missingConfig.join(', ')}`);
        }
      } else {
        recommendations.push(`${name}: Available and configured`);
      }
    }

    return { issues, recommendations };
  }
}
```

### Updated Main Class Integration
```javascript
// lib/ai-changelog-generator.js (modified sections)
import { ProviderManager } from './provider-manager.js';

class AIChangelogGenerator {
  constructor(options = {}) {
    // ... existing constructor code ...
    this.providerManager = new ProviderManager(this.configManager.getConfig());
  }

  async initializeComponents() {
    try {
      // Load all available providers
      await this.providerManager.loadProviders();
      
      // Determine active provider
      this.activeProvider = await this.providerManager.determineActiveProvider();
      this.hasAI = !!this.activeProvider;

      if (!this.hasAI) {
        console.log(colors.warningMessage('No AI provider available. Using rule-based analysis...'));
      } else {
        console.log(colors.aiMessage(`AI Provider: ${colors.highlight(this.activeProvider.getName().toUpperCase())}`));
        this.logModelCapabilities();
      }
    } catch (error) {
      console.error(colors.errorMessage(`Provider initialization failed: ${error.message}`));
      this.hasAI = false;
    }
  }

  async generateCompletion(messages, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No active AI provider available');
    }

    return await this.activeProvider.generateCompletion(messages, options);
  }

  async selectOptimalModel(commitInfo) {
    if (!this.activeProvider) return null;
    
    if (this.modelOverride) {
      return { model: this.modelOverride, capabilities: {} };
    }

    return await this.activeProvider.selectOptimalModel(commitInfo);
  }
}
```

This plugin architecture provides:

1. **Modularity**: Each provider is self-contained
2. **Extensibility**: New providers can be added without changing core code
3. **Flexibility**: Providers can have different capabilities and configurations
4. **Maintainability**: Clean separation of concerns
5. **Testing**: Individual providers can be tested in isolation
6. **Community-friendly**: Easy for external contributors to add new providers

The architecture supports all requested providers and can easily accommodate future additions like Cohere, Groq, or other AI services.