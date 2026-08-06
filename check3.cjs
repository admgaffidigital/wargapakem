const fs = require('fs');

const code = fs.readFileSync('src/App.jsx', 'utf8');

let braces = 0;
let parens = 0;
let inString = false;
let strChar = '';
let inLineComment = false;
let inBlockComment = false;
let lineNum = 1;
let templateDepth = 0;

// track brace levels and their open lines
let braceStack = [];
let parenStack = [];

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const nextC = code[i+1];
  
  if (c === '\n') {
    lineNum++;
    inLineComment = false;
    continue;
  }
  if (inLineComment) continue;
  if (inBlockComment) { if (c === '*' && nextC === '/') { inBlockComment = false; i++; } continue; }
  if (inString) { 
    if (c === '\\') { i++; continue; } 
    if (c === strChar && strChar !== '`') { inString = false; continue; }
    if (c === strChar && strChar === '`') { inString = false; continue; }
    continue; 
  }
  if (c === '/' && nextC === '/') { inLineComment = true; i++; continue; }
  if (c === '/' && nextC === '*') { inBlockComment = true; i++; continue; }
  if (c === '"' || c === "'" || c === '`') { inString = true; strChar = c; continue; }
  
  if (c === '{') { braces++; braceStack.push(lineNum); }
  if (c === '}') { braces--; if (braceStack.length > 0) braceStack.pop(); }
  if (c === '(') { parens++; parenStack.push(lineNum); }
  if (c === ')') { parens--; if (parenStack.length > 0) parenStack.pop(); }
}

console.log("Final Braces:", braces, "Parens:", parens);
console.log("Unclosed braces opened at lines:", braceStack.slice(-10));
console.log("Unclosed parens opened at lines:", parenStack.slice(-10));
