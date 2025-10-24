#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get ESLint errors
exec('ESLINT_USE_FLAT_CONFIG=false npx eslint src/ --ext .vue,.js,.jsx,.ts,.tsx --format=json', (error, stdout) => {
  const results = JSON.parse(stdout);
  const fixes = new Map();

  results.forEach(result => {
    const filePath = result.filePath;
    const messages = result.messages.filter(m =>
      m.ruleId === 'no-unused-vars' || m.ruleId === '@typescript-eslint/no-unused-vars'
    );

    messages.forEach(msg => {
      const match = msg.message.match(/'([^']+)' is (defined|assigned)/);
      if (match) {
        const varName = match[1];
        // Skip if already starts with underscore
        if (!varName.startsWith('_')) {
          if (!fixes.has(filePath)) {
            fixes.set(filePath, []);
          }
          fixes.set(filePath, [...fixes.get(filePath), { line: msg.line, varName }]);
        }
      }
    });
  });

  console.log(`Found ${fixes.size} files with unused variables to fix`);

  // Apply fixes
  let totalFixed = 0;
  fixes.forEach((varList, filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Group by unique var names
    const uniqueVars = [...new Set(varList.map(v => v.varName))];

    uniqueVars.forEach(varName => {
      // Use regex to replace variable declarations/parameters
      // Match various patterns: const varName, let varName, varName:, (varName), {varName}
      const patterns = [
        // Function parameters
        new RegExp(`\\(([^)]*)\\b${varName}\\b([^)]*)\\)`, 'g'),
        // Destructuring
        new RegExp(`\\{([^}]*)\\b${varName}\\b([^}]*)\\}`, 'g'),
        // Array destructuring
        new RegExp(`\\[([^\\]]*)\\b${varName}\\b([^\\]]*)\\]`, 'g'),
        // Variable declarations
        new RegExp(`\\b(const|let|var)\\s+${varName}\\b`, 'g'),
        // Type annotations
        new RegExp(`\\b${varName}\\s*:`, 'g'),
      ];

      patterns.forEach(pattern => {
        content = content.replace(pattern, (match) => {
          return match.replace(new RegExp(`\\b${varName}\\b`), `_${varName}`);
        });
      });
    });

    fs.writeFileSync(filePath, content);
    totalFixed += uniqueVars.length;
    console.log(`Fixed ${uniqueVars.length} variables in ${path.basename(filePath)}`);
  });

  console.log(`\nTotal: Fixed ${totalFixed} unused variables in ${fixes.size} files`);
});
