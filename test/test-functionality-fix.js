#!/usr/bin/env node

// Simplified test to check if the functionality analysis is working

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Copy the exact extractFunctionalityChanges method from the changelog service
function extractFunctionalityChanges(addedContent, removedContent, path) {
  const functionalChanges = [];
  
  console.log('🔍 Testing with content lengths:', {
    addedLength: addedContent.length,
    removedLength: removedContent.length,
    shouldAnalyze: removedContent.length > 50
  });
  
  // Analyze what functionality was actually added or removed
  if (removedContent.length > 50) { // Only analyze substantial changes
    
    // Connection/Testing functionality
    if (removedContent.includes('testConnection') || removedContent.includes('test.success')) {
      functionalChanges.push('removed connection testing functionality');
    }
    
    // Model availability checking
    if (removedContent.includes('getAvailableModels') || removedContent.includes('getAvailable') || removedContent.includes('models.length')) {
      functionalChanges.push('removed model availability checking');
    }
    
    // Authentication/Provider initialization
    if (removedContent.includes('new AIProvider') || removedContent.includes('provider =') || removedContent.includes('Provider(')) {
      functionalChanges.push('removed provider initialization');
    }
    
    // Error handling/validation
    if (removedContent.includes('if (testResult.success)') || removedContent.includes('Connection test failed')) {
      functionalChanges.push('removed error handling and validation');
    }
    
    // Configuration/Setup
    if (removedContent.includes('require(') && addedContent.includes('skipping test')) {
      functionalChanges.push('simplified configuration setup');
    }
    
    // Database/API operations
    if (removedContent.includes('await ') && removedContent.includes('database') || removedContent.includes('api')) {
      functionalChanges.push('removed database/API operations');
    }
    
    // UI/Display functionality
    if (removedContent.includes('forEach') && removedContent.includes('console.log')) {
      functionalChanges.push('removed dynamic model listing display');
    }
    
    // Authentication changes
    if (removedContent.includes('auth') || removedContent.includes('token') || removedContent.includes('key')) {
      functionalChanges.push('modified authentication handling');
    }
  }
  
  // Analyze what was added
  if (addedContent.length > 20) {
    if (addedContent.includes('Configuration testing requires') || addedContent.includes('skipping test')) {
      functionalChanges.push('added configuration migration notice');
    }
    
    if (addedContent.includes('--validate') || addedContent.includes('test your configuration')) {
      functionalChanges.push('redirected testing to CLI --validate');
    }
  }
  
  return functionalChanges;
}

// Copy the analyzeModifiedFileChanges method from the changelog service
function analyzeModifiedFileChanges(diff, path) {
  const lines = diff.split('\n');
  const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
  const removedLines = lines.filter(line => line.startsWith('-') && !line.startsWith('---'));
  
  const addedContent = addedLines.map(line => line.substring(1)).join('\n');
  const removedContent = removedLines.map(line => line.substring(1)).join('\n');
  
  // Extract actual functionality changes instead of just counting
  const functionalChanges = extractFunctionalityChanges(addedContent, removedContent, path);
  
  if (functionalChanges && functionalChanges.length > 0) {
    return functionalChanges.join(', ');
  }
  
  return null; // For testing, return null to see what happens in fallback
}

async function testFunctionalityFix() {
  console.log('🔍 Testing functionality fix for scripts/setup-azure-openai.js');
  
  try {
    const { stdout: diffOutput } = await execAsync('git diff HEAD -- "scripts/setup-azure-openai.js"');
    
    console.log('\n=== TESTING analyzeModifiedFileChanges ===');
    const result = analyzeModifiedFileChanges(diffOutput, 'scripts/setup-azure-openai.js');
    
    if (result) {
      console.log('✅ SUCCESS! Result:', result);
      console.log('\n🎯 Expected description should be:');
      console.log(`Modified source file - ${result}`);
    } else {
      console.log('❌ FAILED - No functional changes detected, will fall back to generic format');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFunctionalityFix();