#!/usr/bin/env node

/**
 * Script to update test imports from /lib to /src structure
 */

import fs from 'fs/promises';
import path from 'path';
import { readdir } from 'fs/promises';

async function updateTestImports() {
  console.log('🔄 Updating test imports from /lib to /src...');
  
  const testDir = './test';
  const testFiles = await readdir(testDir);
  
  const jsFiles = testFiles.filter(file => 
    file.endsWith('.js') && 
    !file.includes('update-') &&
    file !== 'README.md'
  );
  
  let updatedCount = 0;
  
  for (const file of jsFiles) {
    const filePath = path.join(testDir, file);
    
    try {
      let content = await fs.readFile(filePath, 'utf8');
      let modified = false;
      
      // Update import statements - comprehensive replacements
      const replacements = [
        // Main class import
        {
          old: /import AIChangelogGenerator from ['"]\.\.\/lib\/ai-changelog-generator\.js['"];?/g,
          new: "import { AIChangelogGenerator } from '../src/ai-changelog-generator.js';"
        },
        {
          old: /import \{ AIChangelogGenerator \} from ['"]\.\.\/lib\/ai-changelog-generator\.js['"];?/g,
          new: "import { AIChangelogGenerator } from '../src/ai-changelog-generator.js';"
        },
        // Colors import
        {
          old: /import colors from ['"]\.\.\/lib\/colors\.js['"];?/g,
          new: "import colors from '../src/shared/constants/colors.js';"
        },
        // Provider manager - keep using lib for now until fully migrated
        {
          old: /import ProviderManager from ['"]\.\.\/lib\/provider-manager\.js['"];?/g,
          new: "import ProviderManager from '../lib/provider-manager.js'; // Still using lib"
        },
        // Config manager - keep using lib for now
        {
          old: /import ConfigManager from ['"]\.\.\/lib\/config\.js['"];?/g,
          new: "import ConfigManager from '../lib/config.js'; // Still using lib"
        },
        // Git manager - keep using lib for now
        {
          old: /import GitManager from ['"]\.\.\/lib\/git-manager\.js['"];?/g,
          new: "import GitManager from '../lib/git-manager.js'; // Still using lib"
        },
        // MCP server
        {
          old: /import AIChangelogMCPServer from ['"]\.\.\/lib\/mcp-server\.js['"];?/g,
          new: "import AIChangelogMCPServer from '../src/infrastructure/mcp/mcp-server.service.js';"
        },
        // Templates - keep using lib for now
        {
          old: /import \{ generateTemplates \} from ['"]\.\.\/lib\/templates\.js['"];?/g,
          new: "import { generateTemplates } from '../lib/templates.js'; // Still using lib"
        },
        // Generic /lib/utils imports - update selectively
        {
          old: /from ['"]\.\.\/lib\/utils\/([^'"]+)['"];?/g,
          new: "from '../lib/utils/$1'; // Still using lib utils"
        }
      ];
      
      // Apply replacements
      for (const replacement of replacements) {
        if (content.match(replacement.old)) {
          content = content.replace(replacement.old, replacement.new);
          modified = true;
        }
      }
      
      // Write back if modified
      if (modified) {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`✅ Updated: ${file}`);
        updatedCount++;
      } else {
        console.log(`⏭️  Skipped: ${file} (no changes needed)`);
      }
      
    } catch (error) {
      console.error(`❌ Error updating ${file}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Updated ${updatedCount} test files`);
  console.log(`\n⚠️  Note: Some imports still point to /lib for components not yet fully migrated`);
}

updateTestImports().catch(console.error);