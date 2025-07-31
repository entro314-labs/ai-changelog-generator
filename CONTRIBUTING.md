# Contributing to the AI Changelog Generator

First off, thank you for considering contributing! Your help is invaluable in making this tool better for everyone. This document provides guidelines for contributing, with a special focus on adding new AI providers to our modular architecture.

## Getting Started for Development

### Clone and Setup
```bash
git clone https://github.com/entro314-labs/AI-changelog-generator.git
cd AI-changelog-generator
npm install
```

### Development Workflow
We provide bash wrappers for convenient development:

```bash
# Test the CLI directly from source
./ai-changelog.sh --help

# Test different modes
./ai-changelog.sh --interactive
./ai-changelog.sh working-dir
./ai-changelog.sh --dry-run

# Test the MCP server
./ai-changelog-mcp.sh
```

The bash wrappers automatically:
- Validate Node.js environment
- Install dependencies if missing
- Provide helpful error messages
- Pass all arguments to the Node.js CLI

## How to Contribute

We welcome contributions in many forms, including:

- Reporting bugs and issues
- Suggesting new features
- Improving documentation
- Submitting pull requests with bug fixes or new features
- Adding support for new AI providers

## Adding a New AI Provider

Our changelog generator uses a plugin-based architecture to support multiple AI providers. This makes it easy to extend the tool with new services. Here's how you can add a new provider:

### 1. Understand the Architecture

The core of the provider system consists of two main components:

- `lib/provider-manager.js`: This manager is responsible for discovering, loading, and selecting the active AI provider based on the user's configuration.
- `lib/providers/base-provider.js`: This is an abstract base class that defines the contract (interface) all provider plugins must adhere to. Every new provider must extend this class and implement its methods.

### 2. Create Your Provider File

1. Create a new file for your provider in the `lib/providers/` directory (e.g., `lib/providers/my-new-provider.js`).
2. In this file, create a class that extends `BaseProvider`.

```javascript
// lib/providers/my-new-provider.js
const BaseProvider = require('./base-provider');

class MyNewProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = null;
    if (this.isAvailable()) {
      this.initializeClient();
    }
  }

  initializeClient() {
    // Initialize your provider's client/SDK here
    // Example:
    this.client = new MyProviderSDK({
      apiKey: this.config.MY_PROVIDER_API_KEY,
      // Add other configuration options
    });
  }

  // Implement other required methods...
}

module.exports = MyNewProvider;
```

### 3. Implement the `BaseProvider` Interface

You must implement all the methods defined in `BaseProvider`. Here's a detailed explanation of each method with examples:

#### Core Methods

**`getName()`**
```javascript
getName() {
  return 'myprovider'; // Lowercase, unique name
}
```

**`isAvailable()`**
```javascript
isAvailable() {
  // Check if necessary configuration is present
  return !!this.config.MY_PROVIDER_API_KEY;
}
```

**`generateCompletion(messages, options)`**
```javascript
async generateCompletion(messages, options) {
  if (!this.isAvailable()) {
    throw new Error('Provider is not configured.');
  }

  const modelName = options.model || this.config.MY_PROVIDER_DEFAULT_MODEL;
  
  // Prepare parameters for the API call
  const params = {
    model: modelName,
    messages: messages,
    max_tokens: options.max_tokens || 4096,
    temperature: options.temperature || 0.7,
    // Other parameters...
  };

  // Handle streaming if requested
  if (options.stream) {
    const stream = await this.client.createChatCompletionStream(params);
    return { stream, model: modelName };
  }

  // Handle function/tool calling if supported
  if (options.tools && this.getCapabilities(modelName).tool_use) {
    params.tools = options.tools;
    params.tool_choice = options.tool_choice || 'auto';
  }

  // Handle JSON mode if supported
  if (options.response_format?.type === 'json_object' && 
      this.getCapabilities(modelName).json_mode) {
    params.response_format = { type: 'json_object' };
  }

  // Make the API call
  const response = await this.client.createChatCompletion(params);

  // Return standardized response format
  return {
    content: response.choices[0].message.content,
    model: modelName,
    tokens: response.usage.total_tokens,
    finish_reason: response.choices[0].finish_reason,
    tool_calls: response.choices[0].message.tool_calls
  };
}
```

#### Model Selection and Validation Methods

**`getModelRecommendation(commitDetails)`**
```javascript
getModelRecommendation(commitDetails) {
  // Recommend models based on commit complexity
  if (commitDetails.breaking || commitDetails.complex) {
    return { 
      model: 'my-provider-advanced-model', 
      reason: 'Complex or breaking change detected' 
    };
  }
  if (commitDetails.lines > 500 || commitDetails.files > 15) {
    return { 
      model: 'my-provider-standard-model', 
      reason: 'Medium-large commit size' 
    };
  }
  return { 
    model: 'my-provider-basic-model', 
    reason: 'Standard commit size' 
  };
}
```

**`validateModelAvailability(modelName)`**
```javascript
async validateModelAvailability(modelName) {
  if (!this.isAvailable()) {
    return { available: false, error: 'Provider not configured' };
  }
  
  try {
    // Check if the model exists and is available
    const models = await this.client.listModels();
    const isAvailable = models.some(model => model.id === modelName);
    
    if (isAvailable) {
      return { 
        available: true, 
        capabilities: this.getCapabilities(modelName)
      };
    } else {
      return { 
        available: false, 
        error: `Model ${modelName} is not available`,
        alternatives: this.getSuggestedModels(modelName)
      };
    }
  } catch (error) {
    return { 
      available: false, 
      error: error.message,
      alternatives: this.getSuggestedModels(modelName)
    };
  }
}

// Helper method for suggesting alternative models
getSuggestedModels(modelName) {
  // Return array of alternative model names
  return ['my-provider-alternative-model-1', 'my-provider-alternative-model-2'];
}
```

**`testConnection()`**
```javascript
async testConnection() {
  if (!this.isAvailable()) {
    return { success: false, error: 'Provider not configured.' };
  }
  
  try {
    const response = await this.generateCompletion([
      { role: 'user', content: 'Test connection' }
    ], { max_tokens: 10 });
    
    return { 
      success: true, 
      response: response.content, 
      model: response.model,
      sdk_version: '1.0.0', // Your SDK version
      features: {
        streaming: true,
        function_calling: true,
        // Other supported features
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**`getCapabilities(modelName)`**
```javascript
getCapabilities(modelName) {
  const model = modelName || this.config.MY_PROVIDER_DEFAULT_MODEL;
  
  // Base capabilities
  const capabilities = {
    vision: false,
    tool_use: false,
    json_mode: false,
    reasoning: false,
    large_context: false
  };
  
  // Set capabilities based on model
  if (model.includes('advanced')) {
    capabilities.vision = true;
    capabilities.tool_use = true;
    capabilities.json_mode = true;
    capabilities.reasoning = true;
    capabilities.large_context = true;
  } else if (model.includes('standard')) {
    capabilities.json_mode = true;
    capabilities.tool_use = true;
  }
  
  return capabilities;
}
```

### 4. Supporting Advanced Features

Modern AI providers support various advanced features. Here's how to implement them:

#### Streaming

Implement streaming support in your `generateCompletion` method:

```javascript
if (options.stream) {
  const stream = await this.client.createChatCompletionStream(params);
  return { stream, model: modelName };
}
```

The caller will handle the stream object based on its type.

#### Function/Tool Calling

Implement function/tool calling support:

```javascript
if (options.tools && this.getCapabilities(modelName).tool_use) {
  params.tools = options.tools;
  params.tool_choice = options.tool_choice || 'auto';
}

// Later, extract tool calls from the response if present
let toolCalls = null;
if (response.choices[0]?.message?.tool_calls?.length > 0) {
  toolCalls = response.choices[0].message.tool_calls;
}
```

#### JSON Mode

Implement JSON mode support:

```javascript
if (options.response_format?.type === 'json_object' && 
    this.getCapabilities(modelName).json_mode) {
  params.response_format = { type: 'json_object' };
}
```

#### Vision/Multimodal Support

For providers that support vision/multimodal inputs:

```javascript
// Handle content arrays (multimodal)
if (Array.isArray(message.content)) {
  const parts = [];
  
  for (const item of message.content) {
    if (item.type === 'text') {
      parts.push(item.text);
    } else if (item.type === 'image_url') {
      // Handle image URLs based on your provider's format
      const imageUrl = typeof item.image_url === 'string' 
        ? item.image_url 
        : item.image_url.url;
      
      parts.push({
        // Format according to your provider's API
        type: 'image',
        url: imageUrl
      });
    }
  }
  
  // Use parts in your API call
}
```

### 5. Add Dependencies

If your provider requires a new SDK, add it to the `dependencies` section of `package.json`.

```json
"dependencies": {
  "my-provider-sdk": "^1.0.0"
}
```

Then, run `pnpm install` to install it.

### 6. Update the Configuration

1. **`lib/config.js`**: Add the necessary environment variables for your provider to the `defaults` object. This makes them accessible throughout the application.

   ```javascript
   const defaults = {
     // ... other settings
     MY_PROVIDER_API_KEY: process.env.MY_PROVIDER_API_KEY,
     MY_PROVIDER_API_URL: process.env.MY_PROVIDER_API_URL,
     MY_PROVIDER_DEFAULT_MODEL: process.env.MY_PROVIDER_DEFAULT_MODEL || 'default-model',
     MY_PROVIDER_TIMEOUT: process.env.MY_PROVIDER_TIMEOUT || '60000',
     MY_PROVIDER_MAX_RETRIES: process.env.MY_PROVIDER_MAX_RETRIES || '3',
     MY_PROVIDER_USER_ID: process.env.MY_PROVIDER_USER_ID
   };
   ```

2. **`lib/ai-changelog-generator.js`**: Integrate your provider into the interactive setup wizard (`promptForConfig` function).

   - Add your provider to the `choices` list.
   - Add a new `when` block to prompt the user for the API key if they select your provider.
   - Update the logic that writes the `.env.local` file to include your provider's configuration.

### 7. Testing Your Provider

Create tests to verify that your provider works correctly:

1. Basic functionality test:

```javascript
// test/providers/my-provider.test.js
const MyProvider = require('../../lib/providers/my-new-provider');
const config = {
  MY_PROVIDER_API_KEY: 'test-key',
  MY_PROVIDER_DEFAULT_MODEL: 'test-model'
};

describe('MyProvider', () => {
  let provider;
  
  beforeEach(() => {
    provider = new MyProvider(config);
  });
  
  test('getName returns correct provider name', () => {
    expect(provider.getName()).toBe('myprovider');
  });
  
  test('isAvailable returns true when API key is provided', () => {
    expect(provider.isAvailable()).toBe(true);
  });
  
  // Add more tests for other methods
});
```

2. Run the test script:

```bash
pnpm test
```

3. Test your provider with the CLI:

```bash
AI_PROVIDER=myprovider MY_PROVIDER_API_KEY=your-key node ./bin/ai-changelog.js
```

### 8. Provider Best Practices

1. **Error Handling**: Implement robust error handling in all methods, especially `generateCompletion`. Provide clear error messages that help users troubleshoot issues.

2. **Fallbacks**: When possible, provide fallback mechanisms. For example, if a requested model is unavailable, suggest alternatives.

3. **Configuration Flexibility**: Support multiple authentication methods when applicable (API keys, OAuth, etc.).

4. **Performance Optimization**: Implement caching, connection pooling, or other optimizations appropriate for your provider.

5. **Rate Limiting**: Handle rate limiting gracefully with appropriate retries and backoff strategies.

6. **Documentation**: Add clear comments to your code and update this guide with any provider-specific considerations.

7. **Versioning**: Clearly indicate which version of the provider's API you're supporting and any version-specific features.

### 9. Submit a Pull Request

Once you have fully implemented and tested your new provider, please submit a pull request. We will review it and work with you to get it merged.

1. Fork the repository
2. Create a branch for your provider (`git checkout -b add-my-provider`)
3. Commit your changes (`git commit -am 'Add My Provider support'`)
4. Push to the branch (`git push origin add-my-provider`)
5. Create a new Pull Request

Include in your PR description:
- A brief overview of the provider you're adding
- Any special configuration requirements
- Examples of how to use it
- Links to the provider's API documentation

Thank you for helping us grow the ecosystem of AI providers for this tool!