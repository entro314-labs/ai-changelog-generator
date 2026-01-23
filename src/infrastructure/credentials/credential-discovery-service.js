/**
 * Credential Discovery Service
 *
 * Discovers credentials from CLI tools and other sources.
 * USER-INITIATED ONLY - never auto-imports.
 *
 * Sources:
 * - Gemini CLI (~/.gemini/)
 * - Claude Code (~/.claude/, macOS Keychain)
 * - GitHub Copilot (~/.config/github-copilot/)
 */

import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { AuthType } from './unified-credential-manager.js'

const execAsync = promisify(exec)

export class CredentialDiscoveryService {
  constructor(options = {}) {
    this.options = options
    this.homeDir = os.homedir()
    this.platform = process.platform
  }

  /**
   * Discover all available credentials
   *
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Array of discovered credentials
   */
  async discoverAll(options = {}) {
    const credentials = []

    const opts = {
      discoverGemini: true,
      discoverClaude: true,
      discoverGitHub: true,
      ...options,
    }

    if (opts.discoverGemini) {
      credentials.push(...(await this.discoverFromGeminiCLI()))
    }

    if (opts.discoverClaude) {
      credentials.push(...(await this.discoverFromClaudeCode()))
    }

    if (opts.discoverGitHub) {
      credentials.push(...(await this.discoverFromGitHubCopilot()))
    }

    return credentials
  }

  /**
   * Discover credentials for a specific provider
   *
   * @param {string} provider - Provider name
   * @returns {Promise<Array>}
   */
  async discoverForProvider(provider) {
    const allCredentials = await this.discoverAll()
    return allCredentials.filter((cred) => cred.provider === provider)
  }

  /**
   * Discover from Gemini CLI
   *
   * @returns {Promise<Array>}
   */
  async discoverFromGeminiCLI() {
    const credentials = []

    // Check for OAuth credentials
    const oauthCredsPath = path.join(this.homeDir, '.gemini', 'oauth_creds.json')
    if (fs.existsSync(oauthCredsPath)) {
      try {
        const content = fs.readFileSync(oauthCredsPath, 'utf8')
        const oauthCreds = JSON.parse(content)

        if (oauthCreds.access_token) {
          const expiresAt = oauthCreds.expiry_date
            ? new Date(oauthCreds.expiry_date)
            : oauthCreds.expires_in
              ? new Date(Date.now() + oauthCreds.expires_in * 1000)
              : null

          credentials.push({
            provider: 'google',
            value: oauthCreds.access_token,
            source: 'gemini-cli',
            authType: AuthType.OAUTH_TOKEN,
            isValid: !expiresAt || expiresAt > new Date(),
            metadata: {
              filePath: oauthCredsPath,
              hasRefreshToken: !!oauthCreds.refresh_token,
              scope: oauthCreds.scope,
              expiresAt: expiresAt?.toISOString(),
            },
          })
        }
      } catch (error) {
        console.warn('Failed to read Gemini CLI OAuth credentials:', error.message)
      }
    }

    // Check for API key
    const envPath = path.join(this.homeDir, '.gemini', '.env')
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8')
        const apiKey = this._extractEnvVar(content, 'GEMINI_API_KEY') || this._extractEnvVar(content, 'GOOGLE_API_KEY')

        if (apiKey) {
          credentials.push({
            provider: 'google',
            value: apiKey,
            source: 'gemini-cli',
            authType: AuthType.API_KEY,
            isValid: true,
            metadata: {
              filePath: envPath,
            },
          })
        }
      } catch (error) {
        console.warn('Failed to read Gemini CLI .env:', error.message)
      }
    }

    return credentials
  }

  /**
   * Discover from Claude Code
   *
   * @returns {Promise<Array>}
   */
  async discoverFromClaudeCode() {
    const credentials = []

    // macOS: Check Keychain
    if (this.platform === 'darwin') {
      try {
        const { stdout } = await execAsync(
          'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null'
        )

        if (stdout && stdout.trim()) {
          try {
            const keychainCreds = JSON.parse(stdout.trim())

            if (keychainCreds.claudeAiOauth?.accessToken) {
              credentials.push({
                provider: 'anthropic',
                value: keychainCreds.claudeAiOauth.accessToken,
                source: 'claude-code-keychain',
                authType: AuthType.OAUTH_TOKEN,
                isValid: true,
                metadata: {
                  hasRefreshToken: !!keychainCreds.claudeAiOauth.refreshToken,
                  expiresAt: keychainCreds.claudeAiOauth.expiresAt,
                },
              })
            }
          } catch {
            // Raw token string
            credentials.push({
              provider: 'anthropic',
              value: stdout.trim(),
              source: 'claude-code-keychain',
              authType: AuthType.OAUTH_TOKEN,
              isValid: true,
              metadata: {},
            })
          }
        }
      } catch {
        // Keychain access failed or not found
      }
    }

    // All platforms: Check credentials file
    const credsPath = path.join(this.homeDir, '.claude', '.credentials.json')
    if (fs.existsSync(credsPath)) {
      try {
        const content = fs.readFileSync(credsPath, 'utf8')
        const claudeCreds = JSON.parse(content)

        if (claudeCreds.claudeAiOauth?.accessToken) {
          credentials.push({
            provider: 'anthropic',
            value: claudeCreds.claudeAiOauth.accessToken,
            source: 'claude-code-file',
            authType: AuthType.OAUTH_TOKEN,
            isValid: true,
            metadata: {
              filePath: credsPath,
              hasRefreshToken: !!claudeCreds.claudeAiOauth.refreshToken,
              expiresAt: claudeCreds.claudeAiOauth.expiresAt,
            },
          })
        }

        if (claudeCreds.apiKey) {
          credentials.push({
            provider: 'anthropic',
            value: claudeCreds.apiKey,
            source: 'claude-code-file',
            authType: AuthType.API_KEY,
            isValid: true,
            metadata: {
              filePath: credsPath,
            },
          })
        }
      } catch (error) {
        console.warn('Failed to read Claude Code credentials:', error.message)
      }
    }

    return credentials
  }

  /**
   * Discover from GitHub Copilot
   *
   * @returns {Promise<Array>}
   */
  async discoverFromGitHubCopilot() {
    const credentials = []

    // Check hosts.json
    const hostsPath = path.join(this.homeDir, '.config', 'github-copilot', 'hosts.json')
    if (fs.existsSync(hostsPath)) {
      try {
        const content = fs.readFileSync(hostsPath, 'utf8')
        const hosts = JSON.parse(content)

        const githubCreds = hosts['github.com']
        if (githubCreds?.oauth_token) {
          credentials.push({
            provider: 'github-copilot',
            value: githubCreds.oauth_token,
            source: 'github-copilot',
            authType: AuthType.OAUTH_TOKEN,
            isValid: githubCreds.oauth_token.startsWith('ghu_'),
            metadata: {
              filePath: hostsPath,
              user: githubCreds.user,
            },
          })
        }
      } catch (error) {
        console.warn('Failed to read GitHub Copilot credentials:', error.message)
      }
    }

    // Check gh CLI
    const ghHostsPath = path.join(this.homeDir, '.config', 'gh', 'hosts.yml')
    if (fs.existsSync(ghHostsPath)) {
      try {
        const content = fs.readFileSync(ghHostsPath, 'utf8')
        const tokenMatch = content.match(/oauth_token:\s*(.+)/)
        const userMatch = content.match(/user:\s*(.+)/)

        if (tokenMatch && tokenMatch[1]) {
          credentials.push({
            provider: 'github-copilot',
            value: tokenMatch[1].trim(),
            source: 'gh-cli',
            authType: AuthType.OAUTH_TOKEN,
            isValid: true,
            metadata: {
              filePath: ghHostsPath,
              user: userMatch ? userMatch[1].trim() : undefined,
            },
          })
        }
      } catch (error) {
        console.warn('Failed to read gh CLI credentials:', error.message)
      }
    }

    return credentials
  }

  /**
   * Get discovery summary (for UI display)
   *
   * @returns {Promise<Object>}
   */
  async getSummary() {
    const credentials = await this.discoverAll()

    const summary = {
      total: credentials.length,
      byProvider: {},
      bySource: {},
    }

    for (const cred of credentials) {
      // By provider
      if (!summary.byProvider[cred.provider]) {
        summary.byProvider[cred.provider] = []
      }
      summary.byProvider[cred.provider].push({
        source: cred.source,
        authType: cred.authType,
        isValid: cred.isValid,
      })

      // By source
      if (!summary.bySource[cred.source]) {
        summary.bySource[cred.source] = 0
      }
      summary.bySource[cred.source]++
    }

    return summary
  }

  /**
   * Extract environment variable from file content
   * @private
   */
  _extractEnvVar(content, varName) {
    const regex = new RegExp(`^${varName}=(.*)$`, 'm')
    const match = content.match(regex)
    if (match && match[1]) {
      return match[1].trim().replace(/^["']|["']$/g, '')
    }
    return null
  }
}

export default CredentialDiscoveryService
