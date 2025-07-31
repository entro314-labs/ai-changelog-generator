/**
 * Specialized Error Classes for AI Changelog Generator
 * Provides domain-specific error handling with rich context and debugging information
 * Based on the original lib-old/utils/error-handler.js
 */

import JsonUtils from './json-utils.js';

/**
 * Base error class for domain-specific errors
 */
export class AIChangelogError extends Error {
  constructor(message, type, context = {}, originalError = null) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.context = context;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null
    };
  }

  toString() {
    let str = `${this.name}: ${this.message}`;
    if (Object.keys(this.context).length > 0) {
      str += `\nContext: ${JsonUtils.stringifyCompact(this.context)}`;
    }
    if (this.originalError) {
      str += `\nCaused by: ${this.originalError.name}: ${this.originalError.message}`;
    }
    return str;
  }
}

/**
 * Git operation related errors
 */
export class GitError extends AIChangelogError {
  constructor(message, command, originalError = null, context = {}) {
    super(message, 'git', { command, ...context }, originalError);
    this.command = command;
  }

  static fromCommandFailure(command, exitCode, stdout, stderr, originalError = null) {
    const context = {
      command,
      exitCode,
      stdout: stdout?.trim(),
      stderr: stderr?.trim()
    };
    
    let message = `Git command failed: ${command}`;
    if (exitCode) message += ` (exit code: ${exitCode})`;
    if (stderr) message += `\nError: ${stderr}`;
    
    return new GitError(message, command, originalError, context);
  }

  static repositoryNotFound(path) {
    return new GitError(
      `Git repository not found at path: ${path}`,
      'init',
      null,
      { path, reason: 'repository_not_found' }
    );
  }

  static invalidReference(ref, reason = 'unknown') {
    return new GitError(
      `Invalid git reference: ${ref}`,
      'show',
      null,
      { ref, reason }
    );
  }

  static workingDirectoryDirty(files = []) {
    return new GitError(
      'Working directory has uncommitted changes',
      'status',
      null,
      { dirtyFiles: files, reason: 'working_directory_dirty' }
    );
  }
}

/**
 * Configuration related errors
 */
export class ConfigError extends AIChangelogError {
  constructor(message, configKey, originalError = null, context = {}) {
    super(message, 'config', { configKey, ...context }, originalError);
    this.configKey = configKey;
  }

  static missingRequired(configKey, source = 'configuration') {
    return new ConfigError(
      `Required configuration missing: ${configKey}`,
      configKey,
      null,
      { source, reason: 'missing_required' }
    );
  }

  static invalidValue(configKey, value, expectedType, source = 'configuration') {
    return new ConfigError(
      `Invalid configuration value for '${configKey}': expected ${expectedType}, got ${typeof value}`,
      configKey,
      null,
      { value, expectedType, actualType: typeof value, source, reason: 'invalid_type' }
    );
  }

  static fileNotFound(configPath) {
    return new ConfigError(
      `Configuration file not found: ${configPath}`,
      'file',
      null,
      { configPath, reason: 'file_not_found' }
    );
  }

  static parseError(configPath, originalError) {
    return new ConfigError(
      `Failed to parse configuration file: ${configPath}`,
      'file',
      originalError,
      { configPath, reason: 'parse_error' }
    );
  }

  static providerNotConfigured(providerName) {
    return new ConfigError(
      `AI provider '${providerName}' is not properly configured`,
      `providers.${providerName}`,
      null,
      { providerName, reason: 'provider_not_configured' }
    );
  }
}

/**
 * Validation related errors
 */
export class ValidationError extends AIChangelogError {
  constructor(message, field, value, originalError = null, context = {}) {
    super(message, 'validation', { field, value, ...context }, originalError);
    this.field = field;
    this.value = value;
  }

  static required(field) {
    return new ValidationError(
      `Field '${field}' is required`,
      field,
      undefined,
      null,
      { reason: 'required_field' }
    );
  }

  static invalidType(field, value, expectedType) {
    return new ValidationError(
      `Field '${field}' must be of type ${expectedType}`,
      field,
      value,
      null,
      { expectedType, actualType: typeof value, reason: 'invalid_type' }
    );
  }

  static outOfRange(field, value, min, max) {
    return new ValidationError(
      `Field '${field}' must be between ${min} and ${max}`,
      field,
      value,
      null,
      { min, max, reason: 'out_of_range' }
    );
  }

  static invalidFormat(field, value, format, example = null) {
    let message = `Field '${field}' has invalid format: expected ${format}`;
    if (example) message += ` (example: ${example})`;
    
    return new ValidationError(
      message,
      field,
      value,
      null,
      { format, example, reason: 'invalid_format' }
    );
  }

  static custom(field, value, message, context = {}) {
    return new ValidationError(
      message,
      field,
      value,
      null,
      { ...context, reason: 'custom_validation' }
    );
  }
}

/**
 * AI Provider related errors
 */
export class ProviderError extends AIChangelogError {
  constructor(message, providerName, methodName, originalError = null, context = {}) {
    super(message, 'provider', { providerName, methodName, ...context }, originalError);
    this.providerName = providerName;
    this.methodName = methodName;
  }

  static notAvailable(providerName, reason = 'unknown') {
    return new ProviderError(
      `AI provider '${providerName}' is not available`,
      providerName,
      'availability',
      null,
      { reason }
    );
  }

  static authenticationFailed(providerName, details = {}) {
    return new ProviderError(
      `Authentication failed for provider '${providerName}'`,
      providerName,
      'authenticate',
      null,
      { ...details, reason: 'authentication_failed' }
    );
  }

  static rateLimitExceeded(providerName, retryAfter = null) {
    return new ProviderError(
      `Rate limit exceeded for provider '${providerName}'`,
      providerName,
      'request',
      null,
      { retryAfter, reason: 'rate_limit_exceeded' }
    );
  }

  static apiError(providerName, methodName, statusCode, response, originalError = null) {
    return new ProviderError(
      `API error from '${providerName}': ${statusCode}`,
      providerName,
      methodName,
      originalError,
      { statusCode, response, reason: 'api_error' }
    );
  }

  static invalidResponse(providerName, methodName, response, expectedFormat) {
    return new ProviderError(
      `Invalid response format from '${providerName}': expected ${expectedFormat}`,
      providerName,
      methodName,
      null,
      { response, expectedFormat, reason: 'invalid_response' }
    );
  }
}

/**
 * Abstract method errors (for incomplete implementations)
 */
export class AbstractMethodError extends AIChangelogError {
  constructor(message, className, methodName, context = {}) {
    super(message, 'abstract', { className, methodName, ...context });
    this.className = className;
    this.methodName = methodName;
  }

  static notImplemented(className, methodName) {
    return new AbstractMethodError(
      `Abstract method '${methodName}' not implemented in class '${className}'`,
      className,
      methodName,
      { reason: 'not_implemented' }
    );
  }
}

/**
 * File system related errors
 */
export class FileSystemError extends AIChangelogError {
  constructor(message, operation, path, originalError = null, context = {}) {
    super(message, 'filesystem', { operation, path, ...context }, originalError);
    this.operation = operation;
    this.path = path;
  }

  static fileNotFound(path) {
    return new FileSystemError(
      `File not found: ${path}`,
      'read',
      path,
      null,
      { reason: 'file_not_found' }
    );
  }

  static permissionDenied(operation, path) {
    return new FileSystemError(
      `Permission denied: cannot ${operation} ${path}`,
      operation,
      path,
      null,
      { reason: 'permission_denied' }
    );
  }

  static directoryNotFound(path) {
    return new FileSystemError(
      `Directory not found: ${path}`,
      'access',
      path,
      null,
      { reason: 'directory_not_found' }
    );
  }
}

/**
 * Network related errors
 */
export class NetworkError extends AIChangelogError {
  constructor(message, url, operation, originalError = null, context = {}) {
    super(message, 'network', { url, operation, ...context }, originalError);
    this.url = url;
    this.operation = operation;
  }

  static connectionFailed(url, originalError = null) {
    return new NetworkError(
      `Failed to connect to ${url}`,
      url,
      'connect',
      originalError,
      { reason: 'connection_failed' }
    );
  }

  static timeout(url, timeoutMs) {
    return new NetworkError(
      `Request timeout after ${timeoutMs}ms: ${url}`,
      url,
      'request',
      null,
      { timeoutMs, reason: 'timeout' }
    );
  }

  static httpError(url, statusCode, statusText) {
    return new NetworkError(
      `HTTP ${statusCode} ${statusText}: ${url}`,
      url,
      'request',
      null,
      { statusCode, statusText, reason: 'http_error' }
    );
  }
}

/**
 * Error context builder utility
 */
export class ErrorContext {
  constructor() {
    this.data = {};
  }

  add(key, value) {
    this.data[key] = value;
    return this;
  }

  addGitInfo(command, exitCode, stdout, stderr) {
    return this.add('git', { command, exitCode, stdout, stderr });
  }

  addProviderInfo(name, model, endpoint) {
    return this.add('provider', { name, model, endpoint });
  }

  addFileInfo(path, size, mtime) {
    return this.add('file', { path, size, mtime });
  }

  addUserInfo(action, timestamp = new Date().toISOString()) {
    return this.add('user', { action, timestamp });
  }

  build() {
    return { ...this.data };
  }
}

// All error classes are exported individually with their class declarations above