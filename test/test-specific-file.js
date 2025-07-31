#!/usr/bin/env node

// Test the specific fix for scripts/setup-azure-openai.js

import { ChangelogService } from '../src/domains/changelog/changelog.service.js';
import { GitService } from '../src/domains/git/git.service.js';
import { GitManager } from './src/infrastructure/git/git-manager.js';
import { ConfigService } from './src/shared/config/config.service.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testSpecificFile() {
  console.log('🔍 Testing specific file: scripts/setup-azure-openai.js');

  // Set up services
  const config = new ConfigService();
  const gitManager = new GitManager();
  const gitService = new GitService(gitManager);
  const changelogService = new ChangelogService(config, gitService);

  // Get the actual diff
  const { stdout: diffOutput } = await execAsync('git diff HEAD -- "scripts/setup-azure-openai.js"');

  // Create a change object like the system would
  const change = {
    status: 'M',
    path: 'scripts/setup-azure-openai.js',
    diff: diffOutput,
    category: 'source'
  };

  console.log('\n=== CALLING generateChangeDescription ===');
  const description = changelogService.generateChangeDescription(change);
  console.log('Result:', description);

  console.log('\n=== ALSO TESTING analyzeModifiedFileChanges DIRECTLY ===');
  const directResult = changelogService.analyzeModifiedFileChanges(diffOutput, 'scripts/setup-azure-openai.js');
  console.log('Direct result:', directResult);

  console.log('\n=== TESTING extractFunctionalityChanges DIRECTLY ===');
  const lines = diffOutput.split('\n');
  const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
  const removedLines = lines.filter(line => line.startsWith('-') && !line.startsWith('---'));

  const addedContent = addedLines.map(line => line.substring(1)).join('\n');
  const removedContent = removedLines.map(line => line.substring(1)).join('\n');

  const functionalChanges = changelogService.extractFunctionalityChanges(addedContent, removedContent, 'scripts/setup-azure-openai.js');
  console.log('Functional changes:', functionalChanges);
}

testSpecificFile().catch(console.error);