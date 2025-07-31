import { getWorkingDirectoryChanges, summarizeFileChanges, categorizeFile, detectLanguage, assessFileImportance } from '../../shared/utils/consolidated-utils.js';
import colors from '../../shared/constants/colors.js';

/**
 * Workspace Changelog Service
 * 
 * Handles changelog generation from working directory changes
 * Extracted from main AIChangelogGenerator class methods:
 * - generateComprehensiveWorkspaceChangelog() (120→30 lines)
 * - generateAIChangelogContentFromChanges() (80→20 lines)
 * - generateBasicChangelogContentFromChanges() (40→10 lines)
 */
export class WorkspaceChangelogService {
  constructor(aiAnalysisService, gitService = null) {
    this.aiAnalysisService = aiAnalysisService;
    this.gitService = gitService;
  }

  async generateComprehensiveWorkspaceChangelog(options = {}) {
    try {

      // Get working directory changes as raw array
      const rawChanges = getWorkingDirectoryChanges();
      
      
      if (!rawChanges || !Array.isArray(rawChanges) || rawChanges.length === 0) {
        console.log(colors.infoMessage('No changes detected in working directory.'));
        return null;
      }

      // Enhanced analysis of changes with diff content for AI analysis
      const enhancedChanges = await this.enhanceChangesWithDiff(rawChanges);
      const changesSummary = summarizeFileChanges(enhancedChanges);

      // Generate workspace context
      const workspaceContext = this.generateWorkspaceContext(enhancedChanges, changesSummary);

      // Generate changelog content
      const changelog = await this.generateChangelogContent(
        enhancedChanges, 
        changesSummary, 
        workspaceContext,
        options.analysisMode || 'standard'
      );

      return {
        changelog,
        changes: enhancedChanges,
        summary: changesSummary,
        context: workspaceContext
      };

    } catch (error) {
      console.error(colors.errorMessage('Workspace changelog generation failed:'), error.message);
      throw error;
    }
  }

  async generateAIChangelogContentFromChanges(changes, changesSummary, analysisMode = 'standard') {
    if (!this.aiAnalysisService.hasAI) {
      console.log(colors.infoMessage('AI not available, using rule-based analysis...'));
      return this.generateBasicChangelogContentFromChanges(changes, changesSummary);
    }

    try {
      // Build comprehensive prompt with ALL change details - inspired by old implementation
      const prompt = `Generate a comprehensive AI changelog for the following working directory changes:

**Analysis Mode**: ${analysisMode}
**Total Files**: ${changesSummary.totalFiles}
**Categories**: ${Object.keys(changesSummary.categories).join(', ')}

**Files by category with details**:
${Object.entries(changesSummary.categories).map(([cat, files]) =>
  `**${cat}**: ${files.map(f => {
    // Find the full change object with diff content
    const fullChange = changes.find(change => (change.path || change.filePath) === (f.path || f.filePath));
    const diffPreview = fullChange?.diff ? 
      (fullChange.diff.length > 200 ? fullChange.diff.substring(0, 200) + '...' : fullChange.diff) : 
      'No diff available';
    return `${f.status} ${f.path} (${diffPreview.replace(/\n/g, ' ')})`;
  }).join('\n   ')}`
).join('\n')}

CRITICAL INSTRUCTIONS FOR ANALYSIS:
1. **ONLY DESCRIBE CHANGES VISIBLE IN THE DIFF CONTENT** - Do not invent or assume changes
2. **BE FACTUAL AND PRECISE** - Only mention specific lines, functions, imports that you can see
3. **NO ASSUMPTIONS OR SPECULATION** - If you can't see it in the diff, don't mention it
4. **STICK TO OBSERVABLE FACTS** - Describe what was added, removed, or modified line by line
5. **DO NOT MAKE UP INTEGRATION DETAILS** - Don't assume files work together unless explicitly shown

STRICT FORMATTING REQUIREMENTS:
Generate working directory change entries based ONLY on visible diff content:
- (type) brief factual description - List only the specific changes you can see in the diffs

EXAMPLES of CORRECT FACTUAL FORMAT:
✅ (feature) Created new bedrock.js file - Added BedrockProvider class with generateCompletion(), initializeClient(), and getAvailableModels() methods. Imported AWS SDK BedrockRuntimeClient and added support for Claude and Llama models.

✅ (refactor) Updated model list in anthropic.js - Changed getDefaultModel() return value from 'claude-3-5-sonnet-20241022' to 'claude-sonnet-4-20250514'. Added new model entries with updated capabilities.

EXAMPLES of FORBIDDEN ASSUMPTIONS:
❌ "Updated other providers to recognize bedrock" (not visible in diff)
❌ "Refactored provider selection logic" (not shown in actual changes)
❌ "Improved integration across the system" (speculation)
❌ "Enhanced error handling throughout" (assumption)

ONLY describe what you can literally see in the diff content. Do not invent connections or integrations.`;

      // Make ONE AI call with all the context (like the old implementation)
      const messages = [
        {
          role: "system", 
          content: "You are an expert at analyzing code changes and generating factual changelog entries. You MUST only describe changes that are visible in the provided diff content. Never make assumptions, never invent integrations, never speculate about how files work together. Be precise and factual - only describe what you can literally see in the diffs."
        },
        {
          role: "user",
          content: prompt
        }
      ];

      const options = {
        max_tokens: analysisMode === 'enterprise' ? 2000 : analysisMode === 'detailed' ? 1500 : 1000,
        temperature: 0.3
      };

      
      const response = await this.aiAnalysisService.aiProvider.generateCompletion(messages, options);
      
      let changelog = response.content || response.text;
      
      // Add metadata
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Ensure proper changelog format
      if (!changelog.includes('# ')) {
        changelog = `# Working Directory Changelog - ${timestamp}\n\n${changelog}`;
      }
      
      // Add generation metadata
      changelog += `\n\n---\n\n*Generated from ${changesSummary.totalFiles} working directory changes*\n`;
      
      return changelog;

    } catch (error) {
      // Specific error guidance for AI failures
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        console.warn(colors.warningMessage('⚠️  Cannot connect to AI provider'));
        console.warn(colors.infoMessage('💡 Check internet connection and provider service status'));
      } else if (error.message.includes('API key') || error.message.includes('401')) {
        console.warn(colors.warningMessage('⚠️  API authentication failed'));
        console.warn(colors.infoMessage('💡 Run: ai-changelog init'));
      } else if (error.message.includes('rate limit')) {
        console.warn(colors.warningMessage('⚠️  Rate limit exceeded'));
        console.warn(colors.infoMessage('💡 Wait a moment before retrying'));
      } else {
        console.warn(colors.warningMessage(`⚠️  AI analysis failed: ${error.message}`));
      }
      
      console.warn(colors.infoMessage('🔄 Falling back to pattern-based analysis'));
      return this.generateBasicChangelogContentFromChanges(changes, changesSummary);
    }
  }

  generateBasicChangelogContentFromChanges(changes, changesSummary) {
    const timestamp = new Date().toISOString().split('T')[0];
    
    let changelog = `# Working Directory Changes - ${timestamp}\n\n`;
    
    // Basic summary
    changelog += `## Summary\n`;
    changelog += `${changes.length} files modified across ${Object.keys(changesSummary.categories).length} categories.\n\n`;
    
    // Changes by category
    changelog += this.buildChangesByCategory(changes, changesSummary);
    
    // Basic recommendations
    changelog += `## Recommendations\n`;
    changelog += `- Review changes before committing\n`;
    changelog += `- Consider adding tests for new functionality\n`;
    changelog += `- Update documentation if needed\n\n`;
    
    return changelog;
  }

  async enhanceChangesWithDiff(changes) {
    const enhancedChanges = [];
    
    for (const change of changes) {
      let enhancedChange = {
        ...change,
        category: categorizeFile(change.path || change.filePath),
        language: detectLanguage(change.path || change.filePath),
        importance: assessFileImportance(change.path || change.filePath, change.status),
        enhanced: true
      };

      // Get diff content if git service is available
      if (this.gitService) {
        try {
          const diffAnalysis = await this.gitService.analyzeWorkingDirectoryFileChange(
            change.status, 
            change.path || change.filePath
          );
          
          if (diffAnalysis) {
            enhancedChange.diff = diffAnalysis.diff;
            enhancedChange.beforeContent = diffAnalysis.beforeContent;
            enhancedChange.afterContent = diffAnalysis.afterContent;
            enhancedChange.semanticChanges = diffAnalysis.semanticChanges;
            enhancedChange.functionalImpact = diffAnalysis.functionalImpact;
            enhancedChange.complexity = diffAnalysis.complexity;
          }
        } catch (error) {
          console.warn(`Failed to get diff for ${change.path || change.filePath}:`, error.message);
        }
      }

      enhancedChanges.push(enhancedChange);
    }
    
    return enhancedChanges;
  }


  generateWorkspaceContext(changes, summary) {
    const context = {
      totalFiles: changes.length,
      categories: Object.keys(summary.categories),
      primaryCategory: this.getPrimaryCategory(summary.categories),
      riskLevel: this.assessWorkspaceRisk(changes),
      complexity: this.assessWorkspaceComplexity(changes),
      recommendations: this.generateRecommendations(changes)
    };

    return context;
  }

  getPrimaryCategory(categories) {
    return Object.entries(categories)
      .sort(([,a], [,b]) => b.length - a.length)[0]?.[0] || 'other';
  }

  assessWorkspaceRisk(changes) {
    const highRiskFiles = changes.filter(change => 
      change.importance === 'critical' || 
      change.category === 'configuration' ||
      change.status === 'D'
    );

    if (highRiskFiles.length > changes.length * 0.3) return 'high';
    if (highRiskFiles.length > 0) return 'medium';
    return 'low';
  }

  assessWorkspaceComplexity(changes) {
    if (changes.length > 20) return 'high';
    if (changes.length > 5) return 'medium';
    return 'low';
  }

  generateRecommendations(changes) {
    const recommendations = [];
    
    const hasTests = changes.some(change => change.category === 'tests');
    const hasSource = changes.some(change => change.category === 'source');
    const hasConfig = changes.some(change => change.category === 'configuration');
    const hasDocs = changes.some(change => change.category === 'documentation');

    if (hasSource && !hasTests) {
      recommendations.push('Consider adding tests for source code changes');
    }

    if (hasConfig) {
      recommendations.push('Review configuration changes carefully');
    }

    if (hasSource && !hasDocs) {
      recommendations.push('Update documentation for new features');
    }

    if (changes.length > 15) {
      recommendations.push('Consider breaking this into smaller commits');
    }

    const deletedFiles = changes.filter(change => change.status === 'D');
    if (deletedFiles.length > 0) {
      recommendations.push(`Review ${deletedFiles.length} deleted files before committing`);
    }

    return recommendations;
  }

  buildChangesByCategory(changes, changesSummary) {
    let content = `## Changes by Category\n\n`;
    
    Object.entries(changesSummary.categories).forEach(([category, files]) => {
      const categoryIcon = this.getCategoryIcon(category);
      content += `### ${categoryIcon} ${category.charAt(0).toUpperCase() + category.slice(1)} (${files.length} files)\n\n`;
      
      files.forEach(file => {
        const statusIcon = this.getStatusIcon(file.status);
        content += `- ${statusIcon} ${file.path}\n`;
      });
      
      content += '\n';
    });

    return content;
  }

  getCategoryIcon(category) {
    const icons = {
      'source': '💻',
      'tests': '🧪',
      'documentation': '📚',
      'configuration': '⚙️',
      'frontend': '🎨',
      'assets': '🖼️',
      'build': '🔧',
      'other': '📄'
    };
    return icons[category] || '📄';
  }

  getStatusIcon(status) {
    const icons = {
      'A': '➕', // Added
      'M': '✏️',  // Modified
      'D': '❌', // Deleted
      'R': '📝', // Renamed
      'C': '📋'  // Copied
    };
    return icons[status] || '📄';
  }

  async generateChangelogContent(changes, summary, context, analysisMode) {
    if (analysisMode === 'detailed' || analysisMode === 'enterprise') {
      return await this.generateAIChangelogContentFromChanges(changes, summary, analysisMode);
    } else {
      return this.generateBasicChangelogContentFromChanges(changes, summary);
    }
  }

  // Integration with main changelog service
  async generateCommitStyleWorkingDirectoryEntries(options = {}) {
    try {
      // Use passed working directory analysis if available, otherwise get current changes
      let rawChanges;
      if (options.workingDirAnalysis && options.workingDirAnalysis.changes) {
        rawChanges = options.workingDirAnalysis.changes;
      } else {
        rawChanges = getWorkingDirectoryChanges();
      }
      
      if (!rawChanges || !Array.isArray(rawChanges) || rawChanges.length === 0) {
        return { entries: [] };
      }

      // Enhanced analysis of changes with diff content for AI analysis
      const enhancedChanges = await this.enhanceChangesWithDiff(rawChanges);
      const changesSummary = summarizeFileChanges(enhancedChanges);

      // Build prompt for commit-style entries
      const prompt = `Generate working directory change entries in the SAME FORMAT as git commits:

**Analysis Mode**: ${options.analysisMode || 'standard'}
**Total Files**: ${changesSummary.totalFiles}
**Categories**: ${Object.keys(changesSummary.categories).join(', ')}

**Files by category with details**:
${Object.entries(changesSummary.categories).map(([cat, files]) =>
  `**${cat}**: ${files.map(f => {
    // Find the full change object with diff content
    const fullChange = enhancedChanges.find(change => (change.path || change.filePath) === (f.path || f.filePath));
    const diffPreview = fullChange?.diff ? 
      (fullChange.diff.length > 200 ? fullChange.diff.substring(0, 200) + '...' : fullChange.diff) : 
      'No diff available';
    return `${f.status} ${f.path} (${diffPreview.replace(/\n/g, ' ')})`;
  }).join('\n   ')}`
).join('\n')}

STRICT FORMATTING REQUIREMENTS:
Generate working directory change entries based ONLY on visible diff content:
- (type) brief factual description - List only the specific changes you can see in the diffs

Where:
- type = feature, fix, refactor, docs, chore, etc. based on the actual changes
- brief description = concise summary of what was actually changed
- Detailed explanation = specific lines, functions, imports that were added/removed/modified

EXAMPLES of CORRECT FACTUAL FORMAT:
- (feature) Created new bedrock.js file - Added BedrockProvider class with generateCompletion(), initializeClient(), and getAvailableModels() methods. Imported AWS SDK BedrockRuntimeClient and added support for Claude and Llama models.

- (refactor) Updated model list in anthropic.js - Changed getDefaultModel() return value from 'claude-3-5-sonnet-20241022' to 'claude-sonnet-4-20250514'. Added new model entries in getAvailableModels() method.

FORBIDDEN - DO NOT MAKE ASSUMPTIONS:
❌ Do not mention "integration" unless you see actual integration code
❌ Do not mention "provider selection logic" unless you see that specific code
❌ Do not assume files work together unless explicitly shown in diffs

Generate one entry per file or logical change group. Only describe what you can literally see.`;

      // Make AI call
      const messages = [
        {
          role: "system", 
          content: "You are an expert at analyzing code changes and generating factual commit-style changelog entries. You MUST only describe changes that are visible in the provided diff content. Never make assumptions, never invent integrations, never speculate. Be precise and factual - only describe what you can literally see in the diffs."
        },
        {
          role: "user",
          content: prompt
        }
      ];

      const options_ai = {
        max_tokens: 1000,
        temperature: 0.3
      };

      
      const response = await this.aiAnalysisService.aiProvider.generateCompletion(messages, options_ai);
      
      let content = response.content || response.text;
      
      // Parse entries from response
      const entries = content.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim());
      
      return {
        entries,
        changes: enhancedChanges,
        summary: changesSummary
      };

    } catch (error) {
      // Provide specific guidance based on error type
      if (error.message.includes('fetch failed') || error.message.includes('connection')) {
        console.warn(colors.warningMessage('⚠️  AI provider connection failed'));
        console.warn(colors.infoMessage('💡 Check your internet connection and provider configuration'));
      } else if (error.message.includes('API key') || error.message.includes('401')) {
        console.warn(colors.warningMessage('⚠️  Authentication failed'));
        console.warn(colors.infoMessage('💡 Run `ai-changelog init` to configure your API key'));
      } else {
        console.warn(colors.warningMessage(`⚠️  AI analysis failed: ${error.message}`));
        console.warn(colors.infoMessage('💡 Using basic file change detection instead'));
      }
      
      // Return basic entries from the changes we were given instead of getting fresh ones
      const fallbackChanges = rawChanges || getWorkingDirectoryChanges();
      const basicEntries = fallbackChanges.map(change => {
        const filePath = change.filePath || change.path || 'unknown file';
        const status = change.status || 'M';
        const changeType = status === 'M' ? 'update' : status === 'A' ? 'feature' : status === 'D' ? 'remove' : 'chore';
        const changeDesc = status === 'M' ? 'updated' : status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'changed';
        return `- (${changeType}) Modified ${filePath} - File ${changeDesc} (pattern-based analysis)`;
      });
      
      return { entries: basicEntries };
    }
  }

  async generateWorkspaceChangelog(version = null, options = {}) {
    const result = await this.generateComprehensiveWorkspaceChangelog(options);
    
    if (!result) {
      return null;
    }

    let changelog = result.changelog;
    
    // Add version information if provided
    if (version) {
      changelog = changelog.replace(
        /# Working Directory Changelog/,
        `# Working Directory Changelog - Version ${version}`
      );
    }

    // Add context information for detailed modes
    if (options.analysisMode === 'detailed' || options.analysisMode === 'enterprise') {
      changelog += this.generateContextSection(result.context);
    }

    return {
      ...result,
      changelog,
      version
    };
  }

  generateContextSection(context) {
    let section = `## Context Analysis\n\n`;
    section += `- **Total Files:** ${context.totalFiles}\n`;
    section += `- **Primary Category:** ${context.primaryCategory}\n`;
    section += `- **Risk Level:** ${context.riskLevel}\n`;
    section += `- **Complexity:** ${context.complexity}\n\n`;
    
    if (context.recommendations.length > 0) {
      section += `### Recommendations\n\n`;
      context.recommendations.forEach(rec => {
        section += `- ${rec}\n`;
      });
      section += '\n';
    }

    return section;
  }
}