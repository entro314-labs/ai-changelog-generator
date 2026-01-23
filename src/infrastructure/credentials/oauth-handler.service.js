/**
 * OAuth Handler Service
 *
 * Handles OAuth 2.0 authentication flows for AI providers.
 * Supports:
 * - Google OAuth (for Gemini API)
 * - Azure AD OAuth (for Azure OpenAI)
 *
 * Features:
 * - Authorization Code flow with PKCE
 * - Token refresh
 * - Secure token storage
 */

import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { URL, URLSearchParams } from 'node:url'

import colors from '../../shared/constants/colors.js'

/**
 * OAuth provider configurations
 */
const OAUTH_CONFIGS = {
  google: {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/generative-language.retriever',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
    // Using the Gemini CLI's client ID for compatibility
    clientId: '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com',
    clientSecret: '', // Public client, no secret needed
    redirectUri: 'http://localhost:8085/oauth/callback',
    callbackPort: 8085,
  },
  azure: {
    // Azure AD endpoints (tenant-specific or common)
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://cognitiveservices.azure.com/.default', 'offline_access'],
    // Client ID and redirect URI need to be configured per-app
    clientId: null, // Set via config
    clientSecret: null, // Optional for public clients
    redirectUri: 'http://localhost:8086/oauth/callback',
    callbackPort: 8086,
  },
}

/**
 * Token storage paths
 */
const getTokenStoragePath = (provider) => {
  const configDir = path.join(os.homedir(), '.config', 'ai-changelog')
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  return path.join(configDir, `${provider}-oauth-tokens.json`)
}

export class OAuthHandlerService {
  constructor(provider, options = {}) {
    this.provider = provider
    this.config = { ...OAUTH_CONFIGS[provider], ...options }
    this.tokens = null
    this.server = null
  }

  /**
   * Generate PKCE code verifier and challenge
   * @returns {{ verifier: string, challenge: string }}
   */
  generatePKCE() {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    return { verifier, challenge }
  }

  /**
   * Generate state parameter for CSRF protection
   * @returns {string}
   */
  generateState() {
    return randomBytes(16).toString('hex')
  }

  /**
   * Build authorization URL
   * @param {Object} pkce - PKCE parameters
   * @param {string} state - State parameter
   * @returns {string}
   */
  buildAuthorizationUrl(pkce, state) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Always show consent screen
    })

    return `${this.config.authorizationEndpoint}?${params.toString()}`
  }

  /**
   * Start local server to receive OAuth callback
   * @param {string} expectedState - Expected state parameter
   * @returns {Promise<string>} Authorization code
   */
  startCallbackServer(expectedState) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.stopCallbackServer()
          reject(new Error('OAuth callback timeout - no response received within 5 minutes'))
        },
        5 * 60 * 1000
      )

      this.server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${this.config.callbackPort}`)

        if (url.pathname !== '/oauth/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        clearTimeout(timeout)

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e74c3c;">Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          this.stopCallbackServer()
          reject(new Error(`OAuth error: ${error}`))
          return
        }

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <head><title>Security Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e74c3c;">Security Error</h1>
                <p>State mismatch - possible CSRF attack.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          this.stopCallbackServer()
          reject(new Error('OAuth state mismatch'))
          return
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #e74c3c;">Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          this.stopCallbackServer()
          reject(new Error('No authorization code received'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1 style="color: #27ae60;">Authentication Successful!</h1>
              <p>You have successfully authenticated with ${this.provider}.</p>
              <p>You can close this window and return to the terminal.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `)
        this.stopCallbackServer()
        resolve(code)
      })

      this.server.on('error', (error) => {
        clearTimeout(timeout)
        if (error.code === 'EADDRINUSE') {
          reject(
            new Error(
              `Port ${this.config.callbackPort} is in use. Please close other applications.`
            )
          )
        } else {
          reject(new Error(`Server error: ${error.message}`))
        }
      })

      this.server.listen(this.config.callbackPort)
    })
  }

  /**
   * Stop the callback server
   */
  stopCallbackServer() {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {string} verifier - PKCE code verifier
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForTokens(code, verifier) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
    })

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret)
    }

    return this.makeTokenRequest(params)
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret)
    }

    return this.makeTokenRequest(params)
  }

  /**
   * Make token endpoint request
   * @param {URLSearchParams} params
   * @returns {Promise<Object>}
   */
  makeTokenRequest(params) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.tokenEndpoint)
      const postData = params.toString()

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      }

      const req = https.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const response = JSON.parse(data)

            if (response.error) {
              reject(
                new Error(`Token error: ${response.error} - ${response.error_description || ''}`)
              )
              return
            }

            resolve(response)
          } catch (error) {
            reject(new Error(`Failed to parse token response: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Token request failed: ${error.message}`))
      })

      req.write(postData)
      req.end()
    })
  }

  /**
   * Save tokens to secure storage
   * @param {Object} tokens
   */
  saveTokens(tokens) {
    const storagePath = getTokenStoragePath(this.provider)
    const tokenData = {
      ...tokens,
      savedAt: Date.now(),
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    }

    fs.writeFileSync(storagePath, JSON.stringify(tokenData, null, 2), {
      mode: 0o600, // Read/write for owner only
    })

    this.tokens = tokenData
  }

  /**
   * Load tokens from storage
   * @returns {Object|null}
   */
  loadTokens() {
    const storagePath = getTokenStoragePath(this.provider)

    if (!fs.existsSync(storagePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(storagePath, 'utf8')
      this.tokens = JSON.parse(content)
      return this.tokens
    } catch {
      return null
    }
  }

  /**
   * Clear stored tokens
   */
  clearTokens() {
    const storagePath = getTokenStoragePath(this.provider)

    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath)
    }

    this.tokens = null
  }

  /**
   * Check if tokens are valid and not expired
   * @returns {boolean}
   */
  hasValidTokens() {
    if (!this.tokens) {
      this.loadTokens()
    }

    if (!this.tokens?.access_token) {
      return false
    }

    // Check if expired (with 5 minute buffer)
    if (this.tokens.expiresAt && Date.now() > this.tokens.expiresAt - 5 * 60 * 1000) {
      return false
    }

    return true
  }

  /**
   * Get valid access token, refreshing if needed
   * @returns {Promise<string>}
   */
  async getValidAccessToken() {
    if (!this.tokens) {
      this.loadTokens()
    }

    if (!this.tokens?.access_token) {
      throw new Error('No tokens available. Please authenticate first.')
    }

    // Check if token is expired or about to expire
    if (this.tokens.expiresAt && Date.now() > this.tokens.expiresAt - 5 * 60 * 1000) {
      if (!this.tokens.refresh_token) {
        throw new Error('Token expired and no refresh token available. Please re-authenticate.')
      }

      // Refresh the token
      const newTokens = await this.refreshAccessToken(this.tokens.refresh_token)

      // Merge with existing tokens (keep refresh_token if not returned)
      const mergedTokens = {
        ...this.tokens,
        ...newTokens,
        refresh_token: newTokens.refresh_token || this.tokens.refresh_token,
      }

      this.saveTokens(mergedTokens)
    }

    return this.tokens.access_token
  }

  /**
   * Perform full OAuth flow
   * @param {Function} openBrowser - Function to open browser (receives URL)
   * @returns {Promise<Object>} Token response
   */
  async authenticate(openBrowser) {
    if (!this.config.clientId) {
      throw new Error(`OAuth not configured for ${this.provider}. Please set client ID.`)
    }

    const pkce = this.generatePKCE()
    const state = this.generateState()
    const authUrl = this.buildAuthorizationUrl(pkce, state)

    console.log(colors.infoMessage(`\n🔐 Starting ${this.provider} OAuth authentication...`))
    console.log(colors.dim('Opening browser for authentication...'))

    // Open browser
    if (openBrowser) {
      await openBrowser(authUrl)
    } else {
      console.log(colors.highlight(`\nPlease open this URL in your browser:\n${authUrl}\n`))
    }

    // Wait for callback
    const code = await this.startCallbackServer(state)

    console.log(colors.successMessage('✓ Authorization code received'))
    console.log(colors.dim('Exchanging code for tokens...'))

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, pkce.verifier)

    // Save tokens
    this.saveTokens(tokens)

    console.log(colors.successMessage(`✓ ${this.provider} authentication successful!`))

    return tokens
  }

  /**
   * Check authentication status
   * @returns {Object}
   */
  getAuthStatus() {
    if (!this.tokens) {
      this.loadTokens()
    }

    if (!this.tokens) {
      return { authenticated: false, reason: 'No tokens found' }
    }

    if (!this.tokens.access_token) {
      return { authenticated: false, reason: 'No access token' }
    }

    if (this.tokens.expiresAt && Date.now() > this.tokens.expiresAt) {
      if (this.tokens.refresh_token) {
        return { authenticated: true, expired: true, canRefresh: true }
      }
      return { authenticated: false, reason: 'Token expired, no refresh token' }
    }

    return {
      authenticated: true,
      expired: false,
      expiresAt: this.tokens.expiresAt ? new Date(this.tokens.expiresAt) : null,
      canRefresh: !!this.tokens.refresh_token,
    }
  }
}

/**
 * Google OAuth Handler with Gemini-specific configuration
 */
export class GoogleOAuthHandler extends OAuthHandlerService {
  constructor(options = {}) {
    super('google', options)
  }

  /**
   * Check for existing Gemini CLI tokens and import them
   * @returns {boolean}
   */
  importFromGeminiCli() {
    const geminiTokensPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')

    if (!fs.existsSync(geminiTokensPath)) {
      return false
    }

    try {
      const content = fs.readFileSync(geminiTokensPath, 'utf8')
      const geminiTokens = JSON.parse(content)

      if (geminiTokens.access_token) {
        this.saveTokens({
          access_token: geminiTokens.access_token,
          refresh_token: geminiTokens.refresh_token,
          expires_in: geminiTokens.expires_in,
          token_type: geminiTokens.token_type || 'Bearer',
          scope: geminiTokens.scope,
        })
        return true
      }
    } catch {
      return false
    }

    return false
  }
}

/**
 * Azure OAuth Handler with Azure AD-specific configuration
 */
export class AzureOAuthHandler extends OAuthHandlerService {
  constructor(options = {}) {
    // Azure requires tenant-specific or app-specific configuration
    const azureOptions = {
      clientId: options.clientId || process.env.AZURE_CLIENT_ID,
      clientSecret: options.clientSecret || process.env.AZURE_CLIENT_SECRET,
      tenantId: options.tenantId || process.env.AZURE_TENANT_ID || 'common',
      ...options,
    }

    // Update endpoints with tenant ID
    if (azureOptions.tenantId && azureOptions.tenantId !== 'common') {
      azureOptions.authorizationEndpoint = `https://login.microsoftonline.com/${azureOptions.tenantId}/oauth2/v2.0/authorize`
      azureOptions.tokenEndpoint = `https://login.microsoftonline.com/${azureOptions.tenantId}/oauth2/v2.0/token`
    }

    super('azure', azureOptions)
  }

  /**
   * Get Azure AD token for Azure OpenAI
   * @returns {Promise<string>}
   */
  async getAzureToken() {
    return this.getValidAccessToken()
  }
}

export default OAuthHandlerService
