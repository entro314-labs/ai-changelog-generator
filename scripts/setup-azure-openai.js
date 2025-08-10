#!/usr/bin/env node

/**
 * Interactive Azure OpenAI setup script for AI Changelog Generator
 * Enhanced for GPT-4.1 series and reasoning models
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import dotenv from 'dotenv'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function main() {
  console.log('🚀 Azure OpenAI Setup for AI Changelog Generator\n')

  console.log('This script will help you configure Azure OpenAI for enhanced changelog generation.')
  console.log("You'll need to have an Azure OpenAI resource already created.\n")

  const proceed = await question('Do you have an Azure OpenAI resource ready? (y/n): ')
  if (proceed.toLowerCase() !== 'y') {
    console.log('\n📚 Please follow these steps first:')
    console.log('1. Go to https://portal.azure.com')
    console.log('2. Search for "OpenAI" and create a new resource')
    console.log('3. Deploy a GPT-4.1 model in your resource')
    console.log('4. Come back and run this script again')
    console.log('\n📖 See README.md for detailed instructions')
    process.exit(0)
  }

  console.log('\n📝 Please provide your Azure OpenAI configuration:')

  const endpoint = await question(
    'Azure OpenAI Endpoint (e.g., https://your-resource.openai.azure.com/): '
  )
  const apiKey = await question('Azure OpenAI API Key: ')
  const deploymentName = await question('Primary Deployment Name (e.g., gpt-4.1): ')
  const apiVersion = (await question('API Version [2025-04-01-preview]: ')) || '2025-04-01-preview'

  console.log('\n🎯 Model Configuration (press Enter for recommended defaults):')
  const modelDefault = (await question(`Default model [${deploymentName}]: `)) || deploymentName
  const modelSimple = (await question('Simple commits model [gpt-4.1-mini]: ')) || 'gpt-4.1-mini'
  const modelNano = (await question('Minimal commits model [gpt-4.1-nano]: ')) || 'gpt-4.1-nano'
  const modelComplex = (await question('Complex commits model [gpt-4.1]: ')) || 'gpt-4.1'
  const modelReasoning = (await question('Latest reasoning model [o4-mini]: ')) || 'o4-mini'
  const modelAdvanced = (await question('Latest advanced reasoning model [o4]: ')) || 'o4'
  const modelReasoningLegacy = (await question('Legacy reasoning model [o3-mini]: ')) || 'o3-mini'
  const modelAdvancedLegacy = (await question('Legacy advanced reasoning model [o3]: ')) || 'o3'

  // Validate inputs
  if (!(endpoint && apiKey && deploymentName)) {
    console.log('❌ All fields except API Version are required!')
    process.exit(1)
  }

  if (!endpoint.includes('openai.azure.com')) {
    console.log('❌ Endpoint should be an Azure OpenAI URL (*.openai.azure.com)')
    process.exit(1)
  }

  // Load existing .env.local
  const envPath = path.join(process.cwd(), '.env.local')
  let envContent = ''

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
  }

  // Update Azure OpenAI configuration
  const azureConfig = `
# Azure OpenAI Configuration (updated by setup script)
AZURE_OPENAI_ENDPOINT=${endpoint}
AZURE_OPENAI_KEY=${apiKey}
AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}
AZURE_OPENAI_API_VERSION=${apiVersion}
AZURE_OPENAI_USE_V1_API=true

# Smart Model Selection for Changelog Generation
AI_PROVIDER=azure
AI_MODEL=${modelDefault}
AI_MODEL_SIMPLE=${modelSimple}
AI_MODEL_NANO=${modelNano}
AI_MODEL_COMPLEX=${modelComplex}
AI_MODEL_REASONING=${modelReasoning}
AI_MODEL_ADVANCED_REASONING=${modelAdvanced}
AI_MODEL_REASONING_LEGACY=${modelReasoningLegacy}
AI_MODEL_ADVANCED_REASONING_LEGACY=${modelAdvancedLegacy}
`

  // Remove existing Azure OpenAI config if present
  envContent = envContent.replace(/# Azure OpenAI Configuration[\s\S]*?(?=\n\n|\n#|$)/g, '')
  envContent = envContent.replace(/AZURE_OPENAI_.*?=.*?\n/g, '')
  envContent = envContent.replace(/AI_PROVIDER=.*?\n/g, '')
  envContent = envContent.replace(/AI_MODEL.*?=.*?\n/g, '')

  // Add new config
  envContent = envContent.trim() + azureConfig

  // Write back to file
  fs.writeFileSync(envPath, envContent)

  console.log('\n✅ Azure OpenAI configuration saved to .env.local')
  console.log('\n🧪 Testing your configuration...\n')

  // Test the configuration
  try {
    // Test configuration functionality moved to src architecture
    console.log('⚠️  Configuration testing requires updated import paths - skipping test for now')
    dotenv.config({ path: '.env.local' })

    console.log('✅ Configuration file created successfully')
    console.log('💡 Use "ai-changelog --validate" to test your configuration')
    console.log('\n🚀 You can now use enhanced AI changelog generation:')
    console.log('   ai-changelog                    # Generate AI-powered changelog')
    console.log('   ai-changelog --detailed         # Comprehensive analysis')
    console.log('   ai-changelog --model gpt-4.1    # Force specific model')
    console.log('   ai-changelog --interactive      # Interactive mode')
  } catch (error) {
    console.log('❌ Setup test failed:')
    console.log(`   Error: ${error.message}`)
    console.log('\n🔧 Please verify your Azure OpenAI configuration.')
  }

  rl.close()
}

main().catch(console.error)
