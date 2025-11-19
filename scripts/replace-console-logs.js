#!/usr/bin/env node

/**
 * Script to replace all console.log statements with logger utility
 * This script will:
 * 1. Find all TypeScript/JavaScript files
 * 2. Replace console.* statements with appropriate logger calls
 * 3. Add logger import where needed
 */

const fs = require('fs');
const path = require('path');

// Directories to process
const DIRECTORIES_TO_PROCESS = [
  path.join(process.cwd(), 'src'),
  path.join(process.cwd(), 'backend')
];

// Files to skip
const FILES_TO_SKIP = [
  'logger.ts',
  'logger.js',
  'replace-console-logs.js',
  '.next',
  'node_modules',
  'dist',
  'build'
];

// File extensions to process
const VALID_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Statistics
let filesProcessed = 0;
let logsReplaced = 0;
let filesModified = 0;

/**
 * Check if a file should be processed
 */
function shouldProcessFile(filePath) {
  // Skip if in skip list
  if (FILES_TO_SKIP.some(skip => filePath.includes(skip))) {
    return false;
  }

  // Check extension
  const ext = path.extname(filePath);
  return VALID_EXTENSIONS.includes(ext);
}

/**
 * Get the appropriate logger import statement
 */
function getLoggerImport(filePath) {
  const isBackend = filePath.includes('backend');
  const ext = path.extname(filePath);
  const isTypeScript = ext === '.ts' || ext === '.tsx';

  if (isBackend) {
    // For backend files, use a simple console wrapper
    return isTypeScript
      ? "import { createLogger } from '../lib/logger';\nconst logger = createLogger('Backend');"
      : "const { createLogger } = require('../lib/logger');\nconst logger = createLogger('Backend');";
  } else {
    // For frontend files
    const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/lib/logger'));
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    return `import { createLogger } from '${importPath.replace(/\\/g, '/').replace(/\.ts$/, '')}';\nconst logger = createLogger('${path.basename(filePath, ext)}');`;
  }
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    let localLogsReplaced = 0;

    // Check if file already has logger import
    const hasLoggerImport = content.includes("from './logger'") ||
                           content.includes('from "./logger"') ||
                           content.includes("from '../lib/logger'") ||
                           content.includes('require("./logger")') ||
                           content.includes("require('../lib/logger')");

    // Replace console statements
    const replacements = [
      { pattern: /console\.log\(/g, replacement: 'logger.log(' },
      { pattern: /console\.info\(/g, replacement: 'logger.info(' },
      { pattern: /console\.warn\(/g, replacement: 'logger.warn(' },
      { pattern: /console\.error\(/g, replacement: 'logger.error(' },
      { pattern: /console\.debug\(/g, replacement: 'logger.debug(' },
      { pattern: /console\.group\(/g, replacement: 'logger.group(' },
      { pattern: /console\.groupEnd\(/g, replacement: 'logger.groupEnd(' },
      { pattern: /console\.time\(/g, replacement: 'logger.time(' },
      { pattern: /console\.timeEnd\(/g, replacement: 'logger.timeEnd(' },
      { pattern: /console\.table\(/g, replacement: 'logger.table(' }
    ];

    for (const { pattern, replacement } of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        localLogsReplaced += matches.length;
        content = content.replace(pattern, replacement);
        modified = true;
      }
    }

    // Add logger import if file was modified and doesn't have it
    if (modified && !hasLoggerImport) {
      const loggerImport = getLoggerImport(filePath);

      // Find the right place to insert the import
      const firstImportMatch = content.match(/^import .* from/m);
      const firstRequireMatch = content.match(/^const .* = require/m);

      if (firstImportMatch) {
        // Add after the last import
        const imports = content.match(/^import .* from .*/gm);
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        content = content.slice(0, lastImportIndex + lastImport.length) +
                 '\n' + loggerImport +
                 content.slice(lastImportIndex + lastImport.length);
      } else if (firstRequireMatch) {
        // Add after 'use client' or 'use server' if present, otherwise at the top
        const useClientMatch = content.match(/^'use client';?$/m);
        const useServerMatch = content.match(/^'use server';?$/m);

        if (useClientMatch) {
          content = content.replace(useClientMatch[0], useClientMatch[0] + '\n\n' + loggerImport);
        } else if (useServerMatch) {
          content = content.replace(useServerMatch[0], useServerMatch[0] + '\n\n' + loggerImport);
        } else {
          content = loggerImport + '\n\n' + content;
        }
      } else {
        // No imports, add at the top (after 'use client' if present)
        const useClientMatch = content.match(/^'use client';?$/m);
        if (useClientMatch) {
          content = content.replace(useClientMatch[0], useClientMatch[0] + '\n\n' + loggerImport);
        } else {
          content = loggerImport + '\n\n' + content;
        }
      }
    }

    // Write back if modified
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
      logsReplaced += localLogsReplaced;
      console.log(`✅ Processed ${filePath}: Replaced ${localLogsReplaced} console statements`);
    }

    filesProcessed++;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Process a directory recursively
 */
function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️ Directory does not exist: ${dirPath}`);
    return;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);

    // Skip if in skip list
    if (FILES_TO_SKIP.some(skip => fullPath.includes(skip))) {
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile() && shouldProcessFile(fullPath)) {
      processFile(fullPath);
    }
  }
}

/**
 * Main execution
 */
console.log('🔍 Starting console.log replacement...\n');

// Create backend logger if backend exists
if (fs.existsSync(path.join(process.cwd(), 'backend'))) {
  const backendLoggerPath = path.join(process.cwd(), 'backend/lib/logger.js');
  const backendLoggerDir = path.dirname(backendLoggerPath);

  if (!fs.existsSync(backendLoggerDir)) {
    fs.mkdirSync(backendLoggerDir, { recursive: true });
  }

  // Create a CommonJS version of the logger for backend
  const backendLogger = `/**
 * Logger utility for backend (Node.js)
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.DEBUG === 'true';

class Logger {
  constructor(module = 'Backend') {
    this.module = module;
  }

  shouldLog(level, force) {
    if (force) return true;
    if (!isDevelopment) return false;
    if (level === 'debug' && !isDebugEnabled) return false;
    return true;
  }

  formatMessage(message) {
    return \`[\${this.module}] \${message}\`;
  }

  log(message, ...args) {
    if (this.shouldLog('log')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message, error, options = {}) {
    if (this.shouldLog('error', options.force)) {
      console.error(this.formatMessage(message), error);
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  group(label) {
    if (this.shouldLog('log')) {
      console.group(this.formatMessage(label));
    }
  }

  groupEnd() {
    if (this.shouldLog('log')) {
      console.groupEnd();
    }
  }

  time(label) {
    if (this.shouldLog('log')) {
      console.time(this.formatMessage(label));
    }
  }

  timeEnd(label) {
    if (this.shouldLog('log')) {
      console.timeEnd(this.formatMessage(label));
    }
  }

  table(data) {
    if (this.shouldLog('log')) {
      console.table(data);
    }
  }
}

function createLogger(module) {
  return new Logger(module);
}

module.exports = {
  Logger,
  createLogger,
  logger: new Logger()
};
`;

  fs.writeFileSync(backendLoggerPath, backendLogger, 'utf8');
  console.log('✅ Created backend logger at:', backendLoggerPath);
}

// Process directories
for (const dir of DIRECTORIES_TO_PROCESS) {
  console.log(`\n📁 Processing directory: ${dir}`);
  processDirectory(dir);
}

// Print summary
console.log('\n' + '='.repeat(50));
console.log('📊 SUMMARY');
console.log('='.repeat(50));
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Console statements replaced: ${logsReplaced}`);
console.log('\n✅ Console.log replacement complete!');
console.log('\n💡 Next steps:');
console.log('1. Review the changes');
console.log('2. Test the application in development mode');
console.log('3. Verify logs appear in dev but not in production build');