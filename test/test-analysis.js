import fs from 'fs';
const content = fs.readFileSync('final-method-check.js', 'utf8');

console.log('=== Enhanced Content Analysis Test ===');
console.log('File: final-method-check.js');
console.log('Content preview:', content.substring(0, 200));

const consoleStatements = (content.match(/console\.(log|error|warn|info)/g) || []).length;

let purpose = '';
if (content.includes('verification') || content.includes('check')) {
  purpose = 'verification script';
} else if (content.includes('test') || content.includes('spec')) {
  purpose = 'test file';
} else {
  purpose = 'JavaScript module';
}

const meaningfulContent = content
  .split('\n')
  .filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*'))
  .join(' ')
  .toLowerCase();

let functionality = [];
if (meaningfulContent.includes('method') && meaningfulContent.includes('analysis')) {
  functionality.push('analyzing methods');
}
if (meaningfulContent.includes('legacy') || meaningfulContent.includes('old')) {
  functionality.push('legacy code handling');
}
if (meaningfulContent.includes('repository') || meaningfulContent.includes('repo')) {
  functionality.push('repository analysis');
}
if (meaningfulContent.includes('investigation') || meaningfulContent.includes('check')) {
  functionality.push('investigation checklist');
}

let analysis = `Added final-method-check ${purpose}`;
if (functionality.length > 0) {
  analysis += ` for ${functionality.slice(0, 2).join(' and ')}`;
}

console.log('\n=== Analysis Results ===');
console.log('Console statements:', consoleStatements);
console.log('Purpose detected:', purpose);
console.log('Functionality detected:', functionality);
console.log('\nENHANCED DESCRIPTION:');
console.log(analysis);

console.log('\nVS OLD GENERIC DESCRIPTION:');
console.log('Added final-method-check.js JavaScript module (95%)');