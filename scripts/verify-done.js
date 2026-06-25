/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Excluded directories and files
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'coverage',
  '.gemini',
  'out'
];

const EXCLUDE_FILES = [
  'verify-done.js',
  'install-hooks.js',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'next-env.d.ts',
  'eslint.config.mjs',
  'postcss.config.mjs'
];

// Regex Patterns
// Stellar Seed check: starts with S, second char is A-D or 2-7, followed by 54 base32 chars
const STELLAR_SEED_REGEX = /\bS[A-D2-7][A-Z2-7]{54}\b/g;

// PEM / Private Key Check
const PEM_PRIVATE_KEY_REGEX = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

// Postgres Connection String with credentials: e.g. postgres://user:pass@host/db
// Ignore placeholder passwords like [password], <password>, pass, postgres, etc.
const DB_CREDENTIALS_REGEX = /postgres(?:ql)?:\/\/([^:]+):([^@\/]+)@/gi;
const PLACEHOLDER_PASSWORDS = ['password', 'pass', 'your_password', 'yourpassword', '<password>', '[password]', 'postgres', '1234', '123456', 'admin', 'root', 'p'];

// Copywriting Jargon Terms
const JARGON_TERMS = [
  { term: 'wallet', replacement: 'account or coordinates' },
  { term: 'blockchain', replacement: 'protocol' },
  { term: 'polling', replacement: 'scanning ledger' },
  { term: 'transaction', replacement: 'transfer or payment' },
  { term: 'hash', replacement: 'reference or id' }
];

// Jargon checking regexes
// 1. Inside console.log/warn/error/etc.
const CONSOLE_LOG_REGEX = /console\.(log|warn|error|info|debug)\s*\(([\s\S]*?)\)/gi;

// 2. Inside string literals in TS/JS files
const STRING_LITERAL_REGEX = /(["'\`])([\s\S]*?)\1/g;

// 3. Inside JSX text (e.g. >text<)
const JSX_TEXT_REGEX = />([^<]+)</g;

let errorsCount = 0;
let warningsCount = 0;

function logError(message, file, lineNum) {
  errorsCount++;
  if (file) {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${file}${lineNum !== undefined ? `:${lineNum}` : ''}: ${message}`);
  } else {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  }
}

function logWarning(message, file, lineNum) {
  warningsCount++;
  if (file) {
    console.warn(`\x1b[33m[WARNING]\x1b[0m ${file}${lineNum !== undefined ? `:${lineNum}` : ''}: ${message}`);
  } else {
    console.warn(`\x1b[33m[WARNING]\x1b[0m ${message}`);
  }
}

// Check if a path looks like an import path or a relative/URL path
function isIgnorableString(str) {
  str = str.trim();
  if (str.startsWith('/') || str.startsWith('./') || str.startsWith('../') || str.startsWith('@/')) {
    return true; // import/route path
  }
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return true;
  }
  // Check if it's a file extension or mime type or module name
  if (/^[a-zA-Z0-9_\-\/]+$/.test(str) && (str.includes('/') || str.endsWith('.ts') || str.endsWith('.tsx') || str.endsWith('.js') || str.endsWith('.css') || str.includes('node_modules'))) {
    return true;
  }
  return false;
}

function isJsCode(str) {
  if (str.includes('=>') || str.includes('{') || str.includes('}') || str.includes(';')) {
    return true;
  }
  if (/\b(const|let|var|import|return|function|class|export|await|async)\b/.test(str)) {
    return true;
  }
  return false;
}

// Function to walk directories
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        walkDir(filePath, callback);
      }
    } else {
      if (!EXCLUDE_FILES.includes(file) && !file.endsWith('.png') && !file.endsWith('.ico') && !file.endsWith('.jpg') && !file.endsWith('.jpeg')) {
        callback(filePath, relativePath);
      }
    }
  }
}

// Check if .env is gitignored
function checkGitignore() {
  const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    const ignoresEnv = lines.some(l => l === '.env' || l === '.env.local' || l === '.env*' || l === '.env.production');
    if (!ignoresEnv) {
      logError('.gitignore does not appear to ignore .env files! Please ensure .env is gitignored.');
    }
  } else {
    logWarning('.gitignore not found.');
  }

  // Also check if any .env file (other than .env.example) is currently tracked by git
  try {
    const trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
    const files = trackedFiles.split('\n');
    for (const file of files) {
      if (file.startsWith('.env') && file !== '.env.example' && file !== '.env.template') {
        logError(`Sensitive file '${file}' is tracked by git! Run 'git rm --cached ${file}' to stop tracking it.`, file);
      }
    }
  } catch {
    // Git not available or not a repo
  }
}

// Main Scan logic
function scanFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // 1. Secrets Scan (all files)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Stellar Seed Check
    if (STELLAR_SEED_REGEX.test(line)) {
      logError(`Potential Stellar Secret Key (Seed) found! Stellar seeds must not be committed.`, relativePath, lineNum);
    }

    // PEM / Private Key Check
    if (PEM_PRIVATE_KEY_REGEX.test(line)) {
      logError(`Potential Private Key block (PEM) found!`, relativePath, lineNum);
    }

    // Database connection credentials check
    let match;
    while ((match = DB_CREDENTIALS_REGEX.exec(line)) !== null) {
      const password = match[2];
      if (!PLACEHOLDER_PASSWORDS.includes(password.toLowerCase()) && !password.startsWith('$') && !password.includes('process.env')) {
        logError(`Potential hardcoded database password in connection string: "${match[0].substring(0, match[0].indexOf(password))}****@..."`, relativePath, lineNum);
      }
    }
  }

  // 2. Copywriting Jargon Scan (only in src/ presentation layers or console logs)
  const isPresentationFile = relativePath.startsWith('src/presentation/') || relativePath.startsWith('src/app/');
  const isCodeFile = filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx');

  if (isCodeFile) {
    // Scan for console logs with jargon across the whole codebase
    let match;
    while ((match = CONSOLE_LOG_REGEX.exec(content)) !== null) {
      let logContent = match[2];
      // Strip template literal interpolations ${...} to avoid matching code variables
      logContent = logContent.replace(/\$\{[\s\S]*?\}/g, '');

      // Check if log contains any jargon term
      for (const { term, replacement } of JARGON_TERMS) {
        const termRegex = new RegExp(`\\b${term}s?\\b`, 'i');
        if (termRegex.test(logContent)) {
          const index = match.index;
          const lineNum = content.substring(0, index).split('\n').length;
          logError(`Forbidden crypto jargon "${term}" used in console log. Replace with "${replacement}".`, relativePath, lineNum);
        }
      }
    }

    // Scan for jargon in UI text / string literals inside presentation files
    if (isPresentationFile) {
      let strMatch;
      while ((strMatch = STRING_LITERAL_REGEX.exec(content)) !== null) {
        let strVal = strMatch[2];
        if (isIgnorableString(strVal)) continue;
        
        // Strip template literal interpolations ${...} to avoid matching code variables
        strVal = strVal.replace(/\$\{[\s\S]*?\}/g, '');
        
        // Skip string literals without spaces to avoid matching code identifiers/enums
        if (!/\s/.test(strVal)) continue;

        for (const { term, replacement } of JARGON_TERMS) {
          const termRegex = new RegExp(`\\b${term}s?\\b`, 'i');
          if (termRegex.test(strVal)) {
            const index = strMatch.index;
            const lineNum = content.substring(0, index).split('\n').length;
            logError(`Forbidden crypto jargon "${term}" in string literal "${strVal.trim()}". Replace with "${replacement}".`, relativePath, lineNum);
          }
        }
      }

      let jsxMatch;
      while ((jsxMatch = JSX_TEXT_REGEX.exec(content)) !== null) {
        const textVal = jsxMatch[1];
        if (isIgnorableString(textVal)) continue;
        if (isJsCode(textVal)) continue;

        for (const { term, replacement } of JARGON_TERMS) {
          const termRegex = new RegExp(`\\b${term}s?\\b`, 'i');
          if (termRegex.test(textVal)) {
            const index = jsxMatch.index;
            const lineNum = content.substring(0, index).split('\n').length;
            logError(`Forbidden crypto jargon "${term}" in user-facing JSX text: "${textVal.trim()}". Replace with "${replacement}".`, relativePath, lineNum);
          }
        }
      }
    }
  }
}

console.log('Checking repository security and compliance with Definition of Done...');
checkGitignore();

walkDir(PROJECT_ROOT, (filePath, relativePath) => {
  scanFile(filePath, relativePath);
});

console.log('\n--- Verification Summary ---');
console.log(`Errors: ${errorsCount}`);
console.log(`Warnings: ${warningsCount}`);

if (errorsCount > 0) {
  console.error('\n\x1b[31mVerification FAILED.\x1b[0m Please resolve all errors above before completing your task.');
  process.exit(1);
} else {
  console.log('\n\x1b[32mVerification PASSED.\x1b[0m The repository complies with Definition of Done standards.');
  process.exit(0);
}
