import colors from '../../shared/constants/colors.js';
import { formatDuration } from '../../shared/utils/consolidated-utils.js';

/**
 * Metrics Collector Service
 * 
 * Centralized metrics collection and reporting
 */
export class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.metrics = {
      startTime: Date.now(),
      endTime: null,
      
      // Processing metrics
      commitsProcessed: 0,
      filesAnalyzed: 0,
      batchesProcessed: 0,
      
      // AI metrics
      apiCalls: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      ruleBasedFallbacks: 0,
      cacheHits: 0,
      
      // Performance metrics
      averageResponseTime: 0,
      totalResponseTime: 0,
      slowestRequest: 0,
      fastestRequest: Infinity,
      
      // Error tracking
      errors: 0,
      warnings: 0,
      retries: 0,
      
      // Feature usage
      analysisMode: 'standard',
      provider: 'unknown',
      modelUsage: {},
      commandsUsed: [],
      
      // Quality metrics
      successRate: 0,
      aiAccuracy: 0,
      
      // Session info
      sessionId: this.generateSessionId(),
      version: process.env.npm_package_version || 'unknown'
    };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Processing tracking
  incrementCommitsProcessed(count = 1) {
    this.metrics.commitsProcessed += count;
  }

  incrementFilesAnalyzed(count = 1) {
    this.metrics.filesAnalyzed += count;
  }

  incrementBatchesProcessed(count = 1) {
    this.metrics.batchesProcessed += count;
  }

  // AI metrics tracking
  recordApiCall(tokens = {}, responseTime = 0, model = 'unknown') {
    this.metrics.apiCalls++;
    
    if (tokens.prompt_tokens) {
      this.metrics.promptTokens += tokens.prompt_tokens;
    }
    
    if (tokens.completion_tokens) {
      this.metrics.completionTokens += tokens.completion_tokens;
    }
    
    this.metrics.totalTokens = this.metrics.promptTokens + this.metrics.completionTokens;
    
    // Track response times
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.apiCalls;
    
    if (responseTime > this.metrics.slowestRequest) {
      this.metrics.slowestRequest = responseTime;
    }
    
    if (responseTime < this.metrics.fastestRequest) {
      this.metrics.fastestRequest = responseTime;
    }

    // Track model usage
    if (!this.metrics.modelUsage[model]) {
      this.metrics.modelUsage[model] = 0;
    }
    this.metrics.modelUsage[model]++;
  }

  recordRuleBasedFallback(reason = 'unknown') {
    this.metrics.ruleBasedFallbacks++;
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  // Error tracking
  recordError(error = {}) {
    this.metrics.errors++;
    
    // Log error details if in debug mode
    if (process.env.DEBUG) {
      console.error(colors.errorMessage('Metrics: Error recorded'), error);
    }
  }

  recordWarning(warning = {}) {
    this.metrics.warnings++;
  }

  recordRetry() {
    this.metrics.retries++;
  }

  // Feature usage tracking
  setAnalysisMode(mode) {
    this.metrics.analysisMode = mode;
  }

  setProvider(provider) {
    this.metrics.provider = provider;
  }

  recordCommandUsed(command) {
    if (!this.metrics.commandsUsed.includes(command)) {
      this.metrics.commandsUsed.push(command);
    }
  }

  // Quality metrics
  calculateSuccessRate() {
    const totalOperations = this.metrics.apiCalls + this.metrics.ruleBasedFallbacks;
    if (totalOperations === 0) return 0;
    
    const successful = totalOperations - this.metrics.errors;
    this.metrics.successRate = Math.round((successful / totalOperations) * 100);
    return this.metrics.successRate;
  }

  // Session management
  startSession() {
    this.metrics.startTime = Date.now();
  }

  endSession() {
    this.metrics.endTime = Date.now();
    this.calculateSuccessRate();
  }

  getDuration() {
    const end = this.metrics.endTime || Date.now();
    return end - this.metrics.startTime;
  }

  // Metrics retrieval
  getMetrics() {
    return {
      ...this.metrics,
      duration: this.getDuration(),
      successRate: this.calculateSuccessRate()
    };
  }

  getBasicMetrics() {
    return {
      duration: formatDuration(this.getDuration()),
      commitsProcessed: this.metrics.commitsProcessed,
      apiCalls: this.metrics.apiCalls,
      errors: this.metrics.errors,
      successRate: this.calculateSuccessRate()
    };
  }

  getPerformanceMetrics() {
    return {
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
      slowestRequest: this.metrics.slowestRequest,
      fastestRequest: this.metrics.fastestRequest === Infinity ? 0 : this.metrics.fastestRequest,
      totalTokens: this.metrics.totalTokens,
      cacheHitRate: this.metrics.apiCalls > 0 ? 
        Math.round((this.metrics.cacheHits / this.metrics.apiCalls) * 100) : 0
    };
  }

  getUsageMetrics() {
    return {
      analysisMode: this.metrics.analysisMode,
      provider: this.metrics.provider,
      modelUsage: this.metrics.modelUsage,
      commandsUsed: this.metrics.commandsUsed,
      ruleBasedFallbacks: this.metrics.ruleBasedFallbacks
    };
  }

  // Reporting
  displaySummary() {
    const metrics = this.getMetrics();
    
    console.log(colors.header('\n📊 Session Summary:'));
    console.log(`   ${colors.label('Session ID')}: ${colors.value(metrics.sessionId)}`);
    console.log(`   ${colors.label('Duration')}: ${colors.value(formatDuration(metrics.duration))}`);
    console.log(`   ${colors.label('Commits processed')}: ${colors.number(metrics.commitsProcessed)}`);
    console.log(`   ${colors.label('Files analyzed')}: ${colors.number(metrics.filesAnalyzed)}`);
    
    if (metrics.apiCalls > 0) {
      console.log(`   ${colors.label('AI calls')}: ${colors.number(metrics.apiCalls)}`);
      console.log(`   ${colors.label('Total tokens')}: ${colors.number(metrics.totalTokens)}`);
      console.log(`   ${colors.label('Avg response time')}: ${colors.value(Math.round(metrics.averageResponseTime))}ms`);
      console.log(`   ${colors.label('Success rate')}: ${colors.percentage(metrics.successRate + '%')}`);
    }
    
    if (metrics.ruleBasedFallbacks > 0) {
      console.log(`   ${colors.label('Rule-based fallbacks')}: ${colors.warningMessage(metrics.ruleBasedFallbacks)}`);
    }
    
    if (metrics.errors > 0) {
      console.log(`   ${colors.label('Errors')}: ${colors.error(metrics.errors)}`);
    }
    
    if (metrics.warnings > 0) {
      console.log(`   ${colors.label('Warnings')}: ${colors.warningMessage(metrics.warnings)}`);
    }
  }

  displayDetailedReport() {
    const metrics = this.getMetrics();
    const performance = this.getPerformanceMetrics();
    const usage = this.getUsageMetrics();
    
    console.log(colors.header('\n📈 Detailed Metrics Report:'));
    console.log(colors.separator());
    
    // Session info
    console.log(colors.subheader('🔍 Session Information:'));
    console.log(`   Session ID: ${colors.value(metrics.sessionId)}`);
    console.log(`   Duration: ${colors.value(formatDuration(metrics.duration))}`);
    console.log(`   Analysis Mode: ${colors.highlight(metrics.analysisMode)}`);
    console.log(`   Provider: ${colors.highlight(metrics.provider)}`);
    console.log(`   Commands Used: ${colors.value(usage.commandsUsed.join(', ') || 'None')}`);
    
    // Processing stats
    console.log(colors.subheader('\n⚙️ Processing Statistics:'));
    console.log(`   Commits Processed: ${colors.number(metrics.commitsProcessed)}`);
    console.log(`   Files Analyzed: ${colors.number(metrics.filesAnalyzed)}`);
    console.log(`   Batches Processed: ${colors.number(metrics.batchesProcessed)}`);
    
    // AI stats
    if (metrics.apiCalls > 0) {
      console.log(colors.subheader('\n🤖 AI Statistics:'));
      console.log(`   API Calls: ${colors.number(metrics.apiCalls)}`);
      console.log(`   Total Tokens: ${colors.number(metrics.totalTokens)}`);
      console.log(`   Prompt Tokens: ${colors.number(metrics.promptTokens)}`);
      console.log(`   Completion Tokens: ${colors.number(metrics.completionTokens)}`);
      console.log(`   Cache Hits: ${colors.number(metrics.cacheHits)} (${performance.cacheHitRate}%)`);
      
      if (Object.keys(usage.modelUsage).length > 0) {
        console.log(`   Model Usage:`);
        Object.entries(usage.modelUsage).forEach(([model, count]) => {
          console.log(`     - ${colors.highlight(model)}: ${colors.number(count)} calls`);
        });
      }
    }
    
    // Performance stats
    console.log(colors.subheader('\n🚀 Performance Metrics:'));
    console.log(`   Average Response Time: ${colors.value(performance.averageResponseTime)}ms`);
    console.log(`   Fastest Request: ${colors.value(performance.fastestRequest)}ms`);
    console.log(`   Slowest Request: ${colors.value(performance.slowestRequest)}ms`);
    
    // Quality stats
    console.log(colors.subheader('\n📊 Quality Metrics:'));
    console.log(`   Success Rate: ${colors.percentage(metrics.successRate + '%')}`);
    console.log(`   Errors: ${colors.error(metrics.errors)}`);
    console.log(`   Warnings: ${colors.warningMessage(metrics.warnings)}`);
    console.log(`   Retries: ${colors.number(metrics.retries)}`);
    console.log(`   Rule-based Fallbacks: ${colors.warningMessage(metrics.ruleBasedFallbacks)}`);
    
    console.log(colors.separator());
  }

  // Export metrics for external analysis
  exportMetrics(format = 'json') {
    const metrics = this.getMetrics();
    
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }
    
    if (format === 'csv') {
      return this.metricsToCSV(metrics);
    }
    
    return metrics;
  }

  metricsToCSV(metrics) {
    const headers = Object.keys(metrics).join(',');
    const values = Object.values(metrics).map(v => 
      typeof v === 'object' ? JSON.stringify(v) : v
    ).join(',');
    
    return `${headers}\n${values}`;
  }

  // Utilities for metric analysis
  getTopModels(limit = 3) {
    const models = Object.entries(this.metrics.modelUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit);
    
    return models.map(([model, usage]) => ({ model, usage }));
  }

  getEfficiencyScore() {
    const metrics = this.getMetrics();
    let score = 100;
    
    // Penalize errors
    if (metrics.errors > 0) {
      score -= (metrics.errors * 10);
    }
    
    // Penalize slow responses
    if (metrics.averageResponseTime > 5000) {
      score -= 20;
    } else if (metrics.averageResponseTime > 2000) {
      score -= 10;
    }
    
    // Penalize high fallback rate
    const fallbackRate = metrics.apiCalls > 0 ? 
      (metrics.ruleBasedFallbacks / metrics.apiCalls) * 100 : 0;
    
    if (fallbackRate > 50) {
      score -= 30;
    } else if (fallbackRate > 20) {
      score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}