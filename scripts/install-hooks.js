/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const gitDir = path.join(projectRoot, '.git');
const hooksDir = path.join(gitDir, 'hooks');
const prePushHookPath = path.join(hooksDir, 'pre-push');

if (fs.existsSync(gitDir)) {
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookContent = `#!/bin/sh
# Git pre-push hook to run Vytrosti verification checks
echo "Running Vytrosti Definition of Done verification..."
npm run verify-done
if [ $? -ne 0 ]; then
  echo "Error: Verification failed. Push aborted. Please fix the violations listed above."
  exit 1
fi
`;

  fs.writeFileSync(prePushHookPath, hookContent, { mode: 0o755 });
  console.log('Successfully installed git pre-push hook at:', prePushHookPath);
} else {
  console.warn('Warning: .git directory not found. Skipping git hook installation.');
}
