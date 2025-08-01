import colors from '../../shared/constants/colors.js';

/**
 * Commit Message Validation Service
 * 
 * Provides comprehensive commit message validation based on:
 * - Conventional Commits specification
 * - Configuration-based rules
 * - Branch intelligence context
 * - Best practices for readability and maintainability
 */
export class CommitMessageValidationService {
  constructor(configManager) {
    this.configManager = configManager;
    this.config = this.loadValidationConfig();
  }

  /**
   * Load validation configuration from config files
   */
  loadValidationConfig() {
    const config = this.configManager.getAll();
    
    // Default validation rules
    const defaults = {
      commitTypes: ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
      commitScopes: [], // Empty means any scope is allowed
      maxSubjectLength: 72,
      minSubjectLength: 10,
      requireScope: false,
      requireBody: false,
      requireFooter: false,
      allowBreakingChanges: true,
      subjectCase: 'lower', // 'lower', 'sentence', 'any'
      subjectEndPunctuation: false, // Don't allow period at end
      bodyLineLength: 100,
      footerFormat: 'conventional' // 'conventional', 'any'
    };

    // Merge with config from ai-changelog.config.yaml
    const yamlConfig = config.convention || {};
    
    return {
      ...defaults,
      ...yamlConfig,
      // Override with specific validation settings if they exist
      commitTypes: yamlConfig.commitTypes || defaults.commitTypes,
      commitScopes: yamlConfig.commitScopes || defaults.commitScopes
    };
  }

  /**
   * Comprehensive commit message validation
   */
  async validateCommitMessage(message, context = {}) {
    if (!message || typeof message !== 'string') {
      return this.createValidationResult(false, ['Commit message is required'], []);
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return this.createValidationResult(false, ['Commit message cannot be empty'], []);
    }

    const lines = trimmedMessage.split('\n');
    const subject = lines[0];
    const body = lines.slice(2).join('\n').trim(); // Skip blank line after subject
    const hasBlankLineAfterSubject = lines.length > 1 && lines[1].trim() === '';

    const errors = [];
    const warnings = [];
    const suggestions = [];

    // Parse conventional commit format
    const conventionalCommit = this.parseConventionalCommit(subject);

    // Subject validation
    this.validateSubject(subject, conventionalCommit, errors, warnings, suggestions, context);

    // Body validation
    if (lines.length > 1) {
      this.validateBody(body, hasBlankLineAfterSubject, lines, errors, warnings, suggestions);
    }

    // Footer validation
    const footerLines = this.extractFooterLines(lines);
    if (footerLines.length > 0) {
      this.validateFooter(footerLines, errors, warnings, suggestions);
    }

    // Context-based validation (branch intelligence)
    if (context.branchAnalysis) {
      this.validateAgainstBranchContext(conventionalCommit, context.branchAnalysis, warnings, suggestions);
    }

    // Configuration-based validation
    this.validateAgainstConfig(conventionalCommit, errors, warnings, suggestions);

    const isValid = errors.length === 0;
    const score = this.calculateValidationScore(errors, warnings, suggestions);

    return this.createValidationResult(isValid, errors, warnings, suggestions, score, conventionalCommit);
  }

  /**
   * Parse conventional commit format
   */
  parseConventionalCommit(subject) {
    // Enhanced pattern to capture all parts
    const conventionalPattern = /^([a-z]+)(\(([^)]+)\))?(!)?: (.+)$/;
    const match = subject.match(conventionalPattern);

    if (!match) {
      return {
        type: null,
        scope: null,
        breaking: false,
        description: subject,
        isConventional: false
      };
    }

    return {
      type: match[1],
      scope: match[3] || null,
      breaking: !!match[4], // Breaking change indicator (!)
      description: match[5],
      isConventional: true
    };
  }

  /**
   * Validate subject line
   */
  validateSubject(subject, parsed, errors, warnings, suggestions, context) {
    // Length validation
    if (subject.length < this.config.minSubjectLength) {
      errors.push(`Subject too short (${subject.length} chars, minimum ${this.config.minSubjectLength})`);
      suggestions.push('Add more detail about what was changed');
    }

    if (subject.length > this.config.maxSubjectLength) {
      errors.push(`Subject too long (${subject.length} chars, maximum ${this.config.maxSubjectLength})`);
      suggestions.push('Move additional details to the commit body');
    }

    // Conventional commit format validation
    if (!parsed.isConventional) {
      errors.push('Subject does not follow conventional commit format');
      suggestions.push('Use format: type(scope): description (e.g., "feat: add new feature")');
      return; // Skip further validation if not conventional
    }

    // Type validation
    if (!this.config.commitTypes.includes(parsed.type)) {
      errors.push(`Invalid commit type: "${parsed.type}"`);
      suggestions.push(`Use one of: ${this.config.commitTypes.join(', ')}`);
    }

    // Scope validation
    if (this.config.commitScopes.length > 0 && parsed.scope && !this.config.commitScopes.includes(parsed.scope)) {
      warnings.push(`Unexpected scope: "${parsed.scope}"`);
      suggestions.push(`Suggested scopes: ${this.config.commitScopes.join(', ')}`);
    }

    if (this.config.requireScope && !parsed.scope) {
      errors.push('Scope is required for this repository');
      suggestions.push('Add scope in parentheses: type(scope): description');  
    }

    // Description validation
    if (!parsed.description || parsed.description.trim().length === 0) {
      errors.push('Description is required');
      suggestions.push('Add a clear description of what was changed');
    }

    // Case validation
    if (this.config.subjectCase === 'lower' && parsed.description) {
      const firstChar = parsed.description.charAt(0);
      if (firstChar !== firstChar.toLowerCase()) {
        warnings.push('Description should start with lowercase letter');
        suggestions.push(`Change "${firstChar}" to "${firstChar.toLowerCase()}"`);
      }
    }

    // End punctuation validation
    if (!this.config.subjectEndPunctuation && parsed.description && parsed.description.endsWith('.')) {
      warnings.push('Subject should not end with a period');
      suggestions.push('Remove the trailing period');
    }

    // Imperative mood validation
    if (parsed.description) {
      this.validateImperativeMood(parsed.description, warnings, suggestions);
    }
  }

  /**
   * Validate imperative mood
   */
  validateImperativeMood(description, warnings, suggestions) {
    const imperativeVerbs = [
      'add', 'remove', 'fix', 'update', 'create', 'delete', 'implement', 'refactor',
      'improve', 'enhance', 'optimize', 'change', 'move', 'rename', 'replace',
      'upgrade', 'downgrade', 'install', 'uninstall', 'configure', 'setup',
      'initialize', 'clean', 'format', 'lint', 'test', 'document'
    ];

    const nonImperativeIndicators = [
      'added', 'removed', 'fixed', 'updated', 'created', 'deleted', 'implemented',
      'improved', 'enhanced', 'optimized', 'changed', 'moved', 'renamed', 'replaced',
      'upgraded', 'downgraded', 'installed', 'uninstalled', 'configured',
      'initialized', 'cleaned', 'formatted', 'linted', 'tested', 'documented'
    ];

    const firstWord = description.split(' ')[0].toLowerCase();

    if (nonImperativeIndicators.includes(firstWord)) {
      warnings.push('Use imperative mood in description');
      // Try to suggest imperative form
      const imperative = firstWord.replace(/ed$/, '').replace(/d$/, '');
      if (imperativeVerbs.includes(imperative)) {
        suggestions.push(`Change "${firstWord}" to "${imperative}"`);
      } else {
        suggestions.push('Use imperative mood (e.g., "fix bug" not "fixed bug")');
      }
    }
  }

  /**
   * Validate body
   */
  validateBody(body, hasBlankLine, lines, errors, warnings, suggestions) {
    // Blank line separation
    if (!hasBlankLine) {
      errors.push('Missing blank line between subject and body');
      suggestions.push('Add a blank line after the subject');
    }

    // Body line length
    if (body) {
      const bodyLines = body.split('\n');
      bodyLines.forEach((line, index) => {
        if (line.length > this.config.bodyLineLength) {
          warnings.push(`Body line ${index + 1} too long (${line.length} chars, recommended max ${this.config.bodyLineLength})`);
        }
      });
    }

    // Required body
    if (this.config.requireBody && (!body || body.trim().length === 0)) {
      errors.push('Commit body is required');
      suggestions.push('Add details about the changes in the commit body');
    }
  }

  /**
   * Extract footer lines (last paragraph that contains key-value pairs)
   */
  extractFooterLines(lines) {
    if (lines.length < 3) return [];

    const footerLines = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') {
        break; // Empty line indicates end of footer
      }
      if (line.includes(':') || line.match(/^(BREAKING CHANGE|Closes?|Fixes?|Refs?)/i)) {
        footerLines.unshift(line);
      } else {
        break; // Non-footer line
      }
    }

    return footerLines;
  }

  /**
   * Validate footer
   */
  validateFooter(footerLines, errors, warnings, suggestions) {
    footerLines.forEach(line => {
      // Validate footer format
      if (this.config.footerFormat === 'conventional') {
        if (!line.match(/^[A-Za-z-]+: .+/) && !line.match(/^BREAKING CHANGE: .+/)) {
          warnings.push(`Footer line doesn't follow conventional format: "${line}"`);
          suggestions.push('Use format: "Key: value" or "BREAKING CHANGE: description"');
        }
      }

      // Validate breaking changes
      if (line.startsWith('BREAKING CHANGE:')) {
        if (!this.config.allowBreakingChanges) {
          errors.push('Breaking changes are not allowed in this repository');
        }
      }
    });
  }

  /**
   * Validate against branch context
   */
  validateAgainstBranchContext(parsed, branchAnalysis, warnings, suggestions) {
    if (!branchAnalysis || branchAnalysis.confidence < 50) return;

    // Type mismatch
    if (branchAnalysis.type && parsed.type && branchAnalysis.type !== parsed.type) {
      warnings.push(`Commit type "${parsed.type}" doesn't match branch type "${branchAnalysis.type}"`);
      suggestions.push(`Consider using type "${branchAnalysis.type}" based on branch name`);
    }

    // Missing ticket reference
    if (branchAnalysis.ticket && !this.containsTicketReference(parsed, branchAnalysis.ticket)) {
      suggestions.push(`Consider adding ticket reference: ${branchAnalysis.ticket}`);
    }
  }

  /**
   * Check if commit message contains ticket reference
   */
  containsTicketReference(parsed, ticket) {
    const fullMessage = `${parsed.type}${parsed.scope ? `(${parsed.scope})` : ''}: ${parsed.description}`;
    return fullMessage.includes(ticket);
  }

  /**
   * Validate against configuration
   */
  validateAgainstConfig(parsed, errors, warnings, suggestions) {
    // This is handled in other validation methods
    // Additional config-specific validations can be added here
  }

  /**
   * Calculate validation score
   */
  calculateValidationScore(errors, warnings, suggestions) {
    let score = 100;
    score -= errors.length * 25;    // Major issues
    score -= warnings.length * 10;  // Minor issues  
    score -= suggestions.length * 5; // Improvements
    return Math.max(0, score);
  }

  /**
   * Create validation result object
   */
  createValidationResult(isValid, errors = [], warnings = [], suggestions = [], score = 0, parsed = null) {
    return {
      valid: isValid,
      errors,
      warnings,
      suggestions,
      score,
      parsed,
      summary: this.generateValidationSummary(isValid, errors, warnings, suggestions, score)
    };
  }

  /**
   * Generate human-readable validation summary
   */
  generateValidationSummary(isValid, errors, warnings, suggestions, score) {
    if (isValid && warnings.length === 0 && suggestions.length === 0) {
      return '✅ Perfect commit message!';
    }

    const parts = [];
    
    if (errors.length > 0) {
      parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
    }
    
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
    }
    
    if (suggestions.length > 0) {
      parts.push(`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`);
    }

    const status = isValid ? '✅' : '❌';
    return `${status} ${parts.join(', ')} (Score: ${score}/100)`;
  }

  /**
   * Display validation results with colors
   */
  displayValidationResults(validationResult) {
    const { valid, errors, warnings, suggestions, score, summary } = validationResult;

    console.log(colors.infoMessage(`\n🔍 Commit Message Validation:`));
    console.log(colors.secondary(`${summary}`));

    if (errors.length > 0) {
      console.log(colors.errorMessage('\n❌ Errors (must fix):'));
      errors.forEach(error => {
        console.log(colors.error(`  • ${error}`));
      });
    }

    if (warnings.length > 0) {
      console.log(colors.warningMessage('\n⚠️  Warnings (recommended to fix):'));
      warnings.forEach(warning => {
        console.log(colors.warning(`  • ${warning}`));
      });
    }

    if (suggestions.length > 0) {
      console.log(colors.infoMessage('\n💡 Suggestions (optional improvements):'));
      suggestions.forEach(suggestion => {
        console.log(colors.dim(`  • ${suggestion}`));
      });
    }

    return valid;
  }

  /**
   * Interactive commit message improvement
   */
  async improveCommitMessage(message, context = {}) {
    const validation = await this.validateCommitMessage(message, context);
    
    if (validation.valid && validation.warnings.length === 0) {
      return { improved: false, message, validation };
    }

    // Generate improved message based on validation results
    let improved = message;

    // Fix common issues automatically
    if (validation.parsed) {
      const { type, scope, description, breaking } = validation.parsed;
      
      // Fix case issues
      if (description) {
        let fixedDescription = description;
        
        // Fix capitalization
        if (this.config.subjectCase === 'lower') {
          fixedDescription = fixedDescription.charAt(0).toLowerCase() + fixedDescription.slice(1);
        }
        
        // Remove trailing period
        if (!this.config.subjectEndPunctuation && fixedDescription.endsWith('.')) {
          fixedDescription = fixedDescription.slice(0, -1);
        }
        
        // Reconstruct subject
        improved = `${type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: ${fixedDescription}`;
      }
    }

    return { improved: improved !== message, message: improved, validation };
  }
}