#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔍 Debugging Functionality Analysis for setup-azure-openai.js');

try {
  const { stdout: diffOutput } = await execAsync('git diff HEAD -- "scripts/setup-azure-openai.js"');
  
  const lines = diffOutput.split('\n');
  const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
  const removedLines = lines.filter(line => line.startsWith('-') && !line.startsWith('---'));
  
  const addedContent = addedLines.map(line => line.substring(1)).join('\n');
  const removedContent = removedLines.map(line => line.substring(1)).join('\n');
  
  console.log('\n=== REMOVED CONTENT LENGTH ===');
  console.log('Length:', removedContent.length);
  console.log('Should analyze (> 50):', removedContent.length > 50);
  
  console.log('\n=== TESTING PATTERNS ===');
  
  const functionalChanges = [];
  
  if (removedContent.length > 50) {
    console.log('✅ Analyzing substantial changes...');
    
    // Connection/Testing functionality
    if (removedContent.includes('testConnection') || removedContent.includes('test.success')) {
      functionalChanges.push('removed connection testing functionality');
      console.log('✅ Found: connection testing');
    }
    
    // Model availability checking
    if (removedContent.includes('getAvailableModels') || removedContent.includes('getAvailable') || removedContent.includes('models.length')) {
      functionalChanges.push('removed model availability checking');  
      console.log('✅ Found: model availability checking');
    }
    
    // Authentication/Provider initialization
    if (removedContent.includes('new AIProvider') || removedContent.includes('provider =') || removedContent.includes('Provider(')) {
      functionalChanges.push('removed provider initialization');
      console.log('✅ Found: provider initialization');
    }
    
    // UI/Display functionality
    if (removedContent.includes('forEach') && removedContent.includes('console.log')) {
      functionalChanges.push('removed dynamic model listing display');
      console.log('✅ Found: dynamic model listing');
    }
    
    // Configuration/Setup
    if (removedContent.includes('require(') && addedContent.includes('skipping test')) {
      functionalChanges.push('simplified configuration setup');
      console.log('✅ Found: simplified configuration');
    }
  } else {
    console.log('❌ Not analyzing - content too short');
  }
  
  // Analyze what was added
  if (addedContent.length > 20) {
    console.log('✅ Analyzing added content...');
    
    if (addedContent.includes('Configuration testing requires') || addedContent.includes('skipping test')) {
      functionalChanges.push('added configuration migration notice');
      console.log('✅ Found: configuration migration notice');
    }
    
    if (addedContent.includes('--validate') || addedContent.includes('test your configuration')) {
      functionalChanges.push('redirected testing to CLI --validate');
      console.log('✅ Found: CLI validation redirect');
    }
  }
  
  console.log('\n=== RESULTS ===');
  console.log('Functional changes found:', functionalChanges.length);
  console.log('Changes:', functionalChanges);
  
  if (functionalChanges.length > 0) {
    console.log('\n🎯 EXPECTED DESCRIPTION:');
    console.log(functionalChanges.join(', '));
  } else {
    console.log('\n❌ NO FUNCTIONAL CHANGES DETECTED - WILL FALL BACK TO GENERIC');
  }
  
  console.log('\n=== SAMPLE REMOVED CONTENT (first 200 chars) ===');
  console.log(removedContent.substring(0, 200));
  
} catch (error) {
  console.error('Error:', error.message);
}