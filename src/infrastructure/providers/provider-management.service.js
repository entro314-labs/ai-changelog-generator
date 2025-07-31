import colors from '../../shared/constants/colors.js';

/**
 * Provider Management Service
 * 
 * Extracts the missing provider management methods from main class:
 * - listProviders() (40 lines) - Provider listing functionality
 * - switchProvider() (40 lines) - Provider switching functionality
 * - configureProvider() (80 lines) - Provider configuration
 * - validateModels() (95 lines) - Model validation functionality
 */
export class ProviderManagementService {
  constructor(providerManager) {
    this.providerManager = providerManager;
  }

  async listProviders(includeCapabilities = false) {
    console.log(colors.header('🔌 Available AI Providers:'));
    console.log('');

    try {
      if (!this.providerManager) {
        console.log(colors.errorMessage('Provider manager not available'));
        return;
      }

      const providers = this.providerManager.getAllProviders();
      const activeProvider = this.providerManager.getActiveProvider();

      providers.forEach(provider => {
        const isActive = activeProvider && provider.name === activeProvider.getName();
        const status = provider.available ? '✅ Available' : '❌ Not configured';
        const activeIndicator = isActive ? colors.success(' (ACTIVE)') : '';
        
        console.log(`${colors.highlight(provider.name.toUpperCase())}${activeIndicator}`);
        console.log(`   ${colors.label('Status')}: ${status}`);
        
        if (includeCapabilities && provider.available && provider.capabilities) {
          console.log(`   ${colors.label('Capabilities')}: ${Object.entries(provider.capabilities)
            .filter(([key, value]) => value === true)
            .map(([key]) => key)
            .join(', ') || 'Basic completion'}`);
        }
        console.log('');
      });

      console.log(colors.infoMessage(`Total providers: ${colors.number(providers.length)}`));
      console.log(colors.infoMessage(`Active provider: ${colors.highlight(activeProvider?.getName() || 'None')}`));
      
      return {
        providers,
        activeProvider: activeProvider?.getName() || null,
        total: providers.length
      };
      
    } catch (error) {
      console.error(colors.errorMessage(`Error listing providers: ${error.message}`));
      throw error;
    }
  }

  async switchProvider(providerName, testConnection = false) {
    console.log(colors.processingMessage(`🔄 Switching to provider: ${colors.highlight(providerName.toUpperCase())}`));

    try {
      if (!this.providerManager) {
        console.log(colors.errorMessage('Provider manager not available'));
        return { success: false, error: 'Provider manager not available' };
      }

      // Switch provider
      const result = this.providerManager.switchProvider(providerName);
      
      if (result.success) {
        console.log(colors.successMessage(`✅ Successfully switched to ${colors.highlight(providerName.toUpperCase())}`));
        
        if (testConnection) {
          console.log(colors.processingMessage('🧪 Testing connection...'));
          const newProvider = this.providerManager.getActiveProvider();
          const testResult = await newProvider.testConnection();
          
          if (testResult.success) {
            console.log(colors.successMessage('✅ Connection test passed'));
            if (testResult.model) {
              console.log(colors.infoMessage(`   ${colors.label('Model')}: ${colors.highlight(testResult.model)}`));
            }
            return { success: true, provider: providerName, connectionTest: testResult };
          } else {
            console.log(colors.errorMessage(`❌ Connection test failed: ${testResult.error}`));
            return { success: true, provider: providerName, connectionTest: testResult };
          }
        }
        
        return { success: true, provider: providerName };
      } else {
        console.log(colors.errorMessage(`❌ Failed to switch provider: ${result.error}`));
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error(colors.errorMessage(`Error switching provider: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async configureProvider(providerName = null, testConnection = false, showModels = false) {
    const activeProvider = this.providerManager?.getActiveProvider();
    const targetProvider = providerName || activeProvider?.getName();
    
    if (!targetProvider) {
      console.log(colors.errorMessage('No provider specified and no active provider found'));
      return { success: false, error: 'No provider specified' };
    }

    console.log(colors.header(`🔧 Configuring ${colors.highlight(targetProvider.toUpperCase())} Provider:`));
    console.log('');

    try {
      if (!this.providerManager) {
        console.log(colors.errorMessage('Provider manager not available'));
        return { success: false, error: 'Provider manager not available' };
      }

      const provider = this.providerManager.findProviderByName(targetProvider);
      
      if (!provider) {
        console.log(colors.errorMessage(`Provider '${targetProvider}' not found`));
        return { success: false, error: `Provider '${targetProvider}' not found` };
      }

      // Display current configuration status
      console.log(colors.subheader('📋 Current Configuration:'));
      const config = provider.getConfiguration();
      
      Object.entries(config).forEach(([key, value]) => {
        const displayValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') 
          ? (value ? '***CONFIGURED***' : '❌ NOT SET') 
          : (value || '❌ NOT SET');
        console.log(`   ${colors.label(key)}: ${displayValue}`);
      });

      // Show required environment variables
      console.log(colors.subheader('\n🔑 Required Environment Variables:'));
      const requiredVars = provider.getRequiredEnvVars();
      requiredVars.forEach(varName => {
        const isSet = !!process.env[varName];
        const status = isSet ? '✅ SET' : '❌ NOT SET';
        console.log(`   ${colors.label(varName)}: ${status}`);
      });

      // Configuration instructions
      console.log(colors.infoMessage('\n💡 Configuration Instructions:'));
      console.log(`   1. Set the required environment variables in your .env.local file`);
      console.log(`   2. Or export them in your shell session`);
      console.log(`   3. Run the configuration test to verify setup`);

      // Test connection if requested
      if (testConnection) {
        console.log(colors.processingMessage('\n🧪 Testing connection...'));
        const testResult = await provider.testConnection();
        
        if (testResult.success) {
          console.log(colors.successMessage('✅ Configuration test passed'));
          if (testResult.model) {
            console.log(colors.infoMessage(`   ${colors.label('Default model')}: ${colors.highlight(testResult.model)}`));
          }
        } else {
          console.log(colors.errorMessage(`❌ Configuration test failed: ${testResult.error}`));
          console.log(colors.warningMessage('   Please check your environment variables and API keys'));
        }
      }

      // Show available models if requested
      if (showModels) {
        console.log(colors.processingMessage('\n🤖 Fetching available models...'));
        try {
          const models = await provider.getAvailableModels();
          if (models && models.length > 0) {
            console.log(colors.subheader('Available Models:'));
            models.forEach(model => {
              console.log(`   - ${colors.highlight(model.name || model)}`);
              if (model.description) {
                console.log(`     ${colors.dim(model.description)}`);
              }
            });
          } else {
            console.log(colors.warningMessage('No models found or API error'));
          }
        } catch (error) {
          console.log(colors.errorMessage(`Failed to fetch models: ${error.message}`));
        }
      }

      return { 
        success: true, 
        provider: targetProvider, 
        configuration: config,
        testResult: testConnection ? await provider.testConnection() : null
      };
      
    } catch (error) {
      console.error(colors.errorMessage(`Error configuring provider: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async validateModels(providerName = null, testModels = false, checkCapabilities = false) {
    const activeProvider = this.providerManager?.getActiveProvider();
    const targetProvider = providerName || activeProvider?.getName();
    
    if (!targetProvider) {
      console.log(colors.errorMessage('No provider specified and no active provider found'));
      return { success: false, error: 'No provider specified' };
    }

    console.log(colors.header(`🔍 Validating Models for ${colors.highlight(targetProvider.toUpperCase())}:`));
    console.log('');

    try {
      if (!this.providerManager) {
        console.log(colors.errorMessage('Provider manager not available'));
        return { success: false, error: 'Provider manager not available' };
      }

      const provider = this.providerManager.findProviderByName(targetProvider);
      
      if (!provider) {
        console.log(colors.errorMessage(`Provider '${targetProvider}' not found`));
        return { success: false, error: `Provider '${targetProvider}' not found` };
      }

      // Check if provider is configured
      const isConfigured = provider.isAvailable();
      if (!isConfigured) {
        console.log(colors.errorMessage(`Provider '${targetProvider}' is not properly configured`));
        return { success: false, error: 'Provider not configured' };
      }

      // Get available models
      console.log(colors.processingMessage('📋 Fetching available models...'));
      const models = await provider.getAvailableModels();
      
      if (!models || models.length === 0) {
        console.log(colors.warningMessage('No models found'));
        return { success: true, models: [] };
      }

      console.log(colors.successMessage(`✅ Found ${colors.number(models.length)} models`));
      console.log('');

      const validationResults = [];

      // Display and optionally test each model
      for (const model of models) {
        const modelName = model.name || model;
        console.log(colors.subheader(`🤖 ${colors.highlight(modelName)}`));
        
        if (model.description) {
          console.log(`   ${colors.label('Description')}: ${colors.value(model.description)}`);
        }

        if (checkCapabilities && model.capabilities) {
          console.log(`   ${colors.label('Capabilities')}: ${Object.entries(model.capabilities)
            .filter(([key, value]) => value === true)
            .map(([key]) => key)
            .join(', ')}`);
        }

        if (model.contextWindow) {
          console.log(`   ${colors.label('Context Window')}: ${colors.number(model.contextWindow)} tokens`);
        }

        if (model.maxTokens) {
          console.log(`   ${colors.label('Max Output')}: ${colors.number(model.maxTokens)} tokens`);
        }

        // Test model if requested
        if (testModels) {
          console.log(colors.processingMessage(`   🧪 Testing ${modelName}...`));
          try {
            const testResult = await provider.testModel(modelName);
            if (testResult.success) {
              console.log(colors.successMessage(`   ✅ Model test passed`));
              if (testResult.responseTime) {
                console.log(`   ${colors.label('Response Time')}: ${colors.number(testResult.responseTime)}ms`);
              }
            } else {
              console.log(colors.errorMessage(`   ❌ Model test failed: ${testResult.error}`));
            }
            validationResults.push({ model: modelName, ...testResult });
          } catch (error) {
            console.log(colors.errorMessage(`   ❌ Model test error: ${error.message}`));
            validationResults.push({ model: modelName, success: false, error: error.message });
          }
        } else {
          validationResults.push({ model: modelName, success: true });
        }

        console.log('');
      }

      // Summary
      if (testModels) {
        const successfulTests = validationResults.filter(r => r.success).length;
        const failedTests = validationResults.length - successfulTests;
        
        console.log(colors.subheader('📊 Test Summary:'));
        console.log(`   ${colors.label('Successful')}: ${colors.successMessage(successfulTests)}`);
        if (failedTests > 0) {
          console.log(`   ${colors.label('Failed')}: ${colors.errorMessage(failedTests)}`);
        }
      }

      return {
        success: true,
        provider: targetProvider,
        models: models,
        validationResults: testModels ? validationResults : null,
        summary: {
          total: models.length,
          tested: testModels ? validationResults.length : 0,
          successful: testModels ? validationResults.filter(r => r.success).length : models.length
        }
      };

    } catch (error) {
      console.error(colors.errorMessage(`Error validating models: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  // Utility methods
  getProviderStatus(providerName) {
    try {
      const provider = this.providerManager?.findProviderByName(providerName);
      if (!provider) {
        return { available: false, error: 'Provider not found' };
      }

      return {
        available: provider.isAvailable(),
        name: provider.getName(),
        configuration: provider.getConfiguration(),
        requiredVars: provider.getRequiredEnvVars()
      };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  async getProviderCapabilities(providerName) {
    try {
      const provider = this.providerManager?.findProviderByName(providerName);
      if (!provider) {
        return { error: 'Provider not found' };
      }

      const capabilities = await provider.getCapabilities();
      return { success: true, capabilities };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testAllProviders() {
    console.log(colors.header('🧪 Testing All Configured Providers:'));
    console.log('');

    const results = [];
    
    try {
      const providers = this.providerManager.getAllProviders();
      const configuredProviders = providers.filter(p => p.available);

      if (configuredProviders.length === 0) {
        console.log(colors.warningMessage('No configured providers found'));
        return { success: true, results: [] };
      }

      for (const provider of configuredProviders) {
        console.log(colors.processingMessage(`Testing ${colors.highlight(provider.name.toUpperCase())}...`));
        
        try {
          const testResult = await provider.testConnection();
          if (testResult.success) {
            console.log(colors.successMessage(`✅ ${provider.name} - Connection successful`));
          } else {
            console.log(colors.errorMessage(`❌ ${provider.name} - ${testResult.error}`));
          }
          results.push({ provider: provider.name, ...testResult });
        } catch (error) {
          console.log(colors.errorMessage(`❌ ${provider.name} - ${error.message}`));
          results.push({ provider: provider.name, success: false, error: error.message });
        }
      }

      // Summary
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      console.log(colors.subheader('\n📊 Test Results Summary:'));
      console.log(`   ${colors.label('Total Providers')}: ${colors.number(results.length)}`);
      console.log(`   ${colors.label('Successful')}: ${colors.successMessage(successful)}`);
      if (failed > 0) {
        console.log(`   ${colors.label('Failed')}: ${colors.errorMessage(failed)}`);
      }

      return { success: true, results, summary: { total: results.length, successful, failed } };

    } catch (error) {
      console.error(colors.errorMessage(`Error testing providers: ${error.message}`));
      return { success: false, error: error.message };
    }
  }
}