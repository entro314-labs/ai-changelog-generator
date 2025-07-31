/**
 * Comprehensive JSON Operations Utility
 * Provides advanced JSON parsing, stringification, and error handling capabilities
 * Based on the original lib-old/utils/json-utils.js with enhancements
 */

export class JsonUtils {
  /**
   * Stringify data with optional pretty printing
   * @param {*} data - Data to stringify
   * @param {boolean} pretty - Whether to pretty print (default: true)
   * @returns {string} JSON string
   */
  static stringify(data, pretty = true) {
    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  /**
   * Safe JSON parsing with fallback
   * @param {string} jsonString - JSON string to parse
   * @param {*} fallback - Fallback value if parsing fails (default: null)
   * @returns {*} Parsed data or fallback
   */
  static safeParse(jsonString, fallback = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn(`JSON parse error: ${error.message}`);
      return fallback;
    }
  }

  /**
   * Stringify data for API responses (always pretty printed)
   * @param {*} data - Data to stringify for response
   * @returns {string} Pretty-printed JSON string
   */
  static stringifyForResponse(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Compact JSON stringify (no pretty printing, for logs/storage)
   * @param {*} data - Data to stringify compactly
   * @returns {string} Compact JSON string
   */
  static stringifyCompact(data) {
    return JSON.stringify(data, null, 0);
  }

  /**
   * Safe stringify that handles circular references and undefined values
   * @param {*} data - Data to stringify
   * @param {boolean} pretty - Whether to pretty print
   * @returns {string} JSON string with circular references handled
   */
  static safeStringify(data, pretty = true) {
    const seen = new WeakSet();
    return JSON.stringify(
      data,
      (_, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      },
      pretty ? 2 : 0
    );
  }

  /**
   * Parse JSON with detailed error information
   * @param {string} jsonString - JSON string to parse
   * @param {string} context - Context for error reporting (optional)
   * @returns {Object} {success: boolean, data: *, error: string, position?: Object}
   */
  static parseWithErrorDetails(jsonString, context = '') {
    try {
      const data = JSON.parse(jsonString);
      return { success: true, data, error: null };
    } catch (error) {
      const errorMsg = context 
        ? `JSON parse error in ${context}: ${error.message}`
        : `JSON parse error: ${error.message}`;
      
      return { 
        success: false, 
        data: null, 
        error: errorMsg,
        position: this.getErrorPosition(error, jsonString)
      };
    }
  }

  /**
   * Extract error position from JSON parse error
   * @param {Error} error - JSON parse error
   * @param {string} jsonString - Original JSON string
   * @returns {Object|null} Position information with line/column
   */
  static getErrorPosition(error, jsonString) {
    // Try to extract position from error message
    const positionMatch = error.message.match(/position (\d+)/);
    const lineMatch = error.message.match(/line (\d+)/);
    const columnMatch = error.message.match(/column (\d+)/);
    
    if (positionMatch) {
      const position = parseInt(positionMatch[1]);
      const lines = jsonString.substring(0, position).split('\n');
      return {
        position,
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
        context: this.getErrorContext(jsonString, position)
      };
    }
    
    if (lineMatch && columnMatch) {
      return {
        line: parseInt(lineMatch[1]),
        column: parseInt(columnMatch[1]),
        context: this.getErrorContextByLine(jsonString, parseInt(lineMatch[1]), parseInt(columnMatch[1]))
      };
    }
    
    return null;
  }

  /**
   * Get context around error position for debugging
   * @param {string} jsonString - Original JSON string
   * @param {number} position - Error position
   * @returns {Object} Context information
   */
  static getErrorContext(jsonString, position) {
    const start = Math.max(0, position - 50);
    const end = Math.min(jsonString.length, position + 50);
    const before = jsonString.substring(start, position);
    const after = jsonString.substring(position, end);
    
    return {
      before,
      after,
      marker: '>>> ERROR HERE <<<'
    };
  }

  /**
   * Get context around error line/column for debugging
   * @param {string} jsonString - Original JSON string
   * @param {number} line - Error line number (1-based)
   * @param {number} column - Error column number (1-based)
   * @returns {Object} Context information
   */
  static getErrorContextByLine(jsonString, line, column) {
    const lines = jsonString.split('\n');
    const errorLine = lines[line - 1] || '';
    const contextLines = [];
    
    // Add surrounding lines for context
    for (let i = Math.max(0, line - 3); i < Math.min(lines.length, line + 2); i++) {
      const lineNum = i + 1;
      const isErrorLine = lineNum === line;
      contextLines.push({
        number: lineNum,
        content: lines[i],
        isError: isErrorLine
      });
    }
    
    return {
      line,
      column,
      errorLine,
      marker: ' '.repeat(column - 1) + '^',
      contextLines
    };
  }

  /**
   * Validate JSON string without parsing
   * @param {string} jsonString - JSON string to validate
   * @returns {boolean} True if valid JSON
   */
  static isValidJson(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deep clone object using JSON serialization
   * @param {*} obj - Object to clone
   * @returns {*} Deep cloned object
   */
  static deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.warn('Deep clone failed, returning original object:', error.message);
      return obj;
    }
  }

  /**
   * Format JSON for console output with syntax highlighting
   * @param {*} data - Data to format
   * @param {boolean} colorize - Whether to add console colors
   * @returns {string} Formatted JSON string
   */
  static formatForConsole(data, colorize = true) {
    const jsonString = this.stringifyForResponse(data);
    
    if (!colorize) {
      return jsonString;
    }
    
    // Simple syntax highlighting for console
    return jsonString
      .replace(/"([^"]+)":/g, '\x1b[36m"$1"\x1b[0m:')  // Cyan for keys
      .replace(/: "([^"]+)"/g, ': \x1b[32m"$1"\x1b[0m') // Green for string values
      .replace(/: (\d+)/g, ': \x1b[33m$1\x1b[0m')      // Yellow for numbers
      .replace(/: (true|false)/g, ': \x1b[35m$1\x1b[0m') // Magenta for booleans
      .replace(/: null/g, ': \x1b[90mnull\x1b[0m');     // Gray for null
  }

  /**
   * Minify JSON string by removing unnecessary whitespace
   * @param {string} jsonString - JSON string to minify
   * @returns {string} Minified JSON string
   */
  static minify(jsonString) {
    try {
      return JSON.stringify(JSON.parse(jsonString));
    } catch (error) {
      console.warn('JSON minification failed:', error.message);
      return jsonString;
    }
  }

  /**
   * Pretty print JSON string
   * @param {string} jsonString - JSON string to format
   * @param {number} indent - Number of spaces for indentation (default: 2)
   * @returns {string} Pretty printed JSON string
   */
  static prettify(jsonString, indent = 2) {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, indent);
    } catch (error) {
      console.warn('JSON prettification failed:', error.message);
      return jsonString;
    }
  }

  /**
   * Compare two JSON objects for equality
   * @param {*} obj1 - First object
   * @param {*} obj2 - Second object
   * @returns {boolean} True if objects are equal
   */
  static areEqual(obj1, obj2) {
    try {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch (error) {
      console.warn('JSON comparison failed:', error.message);
      return false;
    }
  }

  /**
   * Extract all string values from JSON object (useful for text analysis)
   * @param {*} obj - JSON object
   * @param {Array} strings - Accumulator array (used internally)
   * @returns {Array} Array of all string values
   */
  static extractStrings(obj, strings = []) {
    if (typeof obj === 'string') {
      strings.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this.extractStrings(item, strings));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => this.extractStrings(value, strings));
    }
    return strings;
  }

  /**
   * Merge multiple JSON objects deeply
   * @param {...Object} objects - Objects to merge
   * @returns {Object} Merged object
   */
  static deepMerge(...objects) {
    const result = {};
    
    for (const obj of objects) {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [key, value] of Object.entries(obj)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = this.deepMerge(result[key] || {}, value);
          } else {
            result[key] = value;
          }
        }
      }
    }
    
    return result;
  }
}

export default JsonUtils;