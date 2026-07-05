const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlPath = path.join(__dirname, '../frontend/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Find all script tags
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 1;

while ((match = scriptRegex.exec(html)) !== null) {
  const code = match[1];
  const tempFile = path.join(__dirname, `temp_script_${scriptIndex}.js`);
  fs.writeFileSync(tempFile, code, 'utf8');
  
  try {
    // Run node --check to verify syntax of ES modules
    execSync(`node --check "${tempFile}"`, { stdio: 'pipe' });
    console.log(`Script tag ${scriptIndex}: OK`);
  } catch (err) {
    console.error(`Script tag ${scriptIndex}: SYNTAX ERROR!`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {}
  }
  scriptIndex++;
}
