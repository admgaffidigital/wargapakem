const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Simple heuristic, avoiding lines with quotes to avoid string literals messing up
  if (line.includes('//') && !line.includes('{') && !line.includes('(')) continue;
  
  let cleanLine = line.replace(/".*?"/g, '').replace(/'.*?'/g, '').replace(/`.*?`/g, '').replace(/\/\/.*$/, '');
  
  for (let j = 0; j < cleanLine.length; j++) {
    const c = cleanLine[j];
    if (c === '{' || c === '(' || c === '[') {
      stack.push({ char: c, line: i + 1 });
    } else if (c === '}' || c === ')' || c === ']') {
      if (stack.length > 0) {
        const last = stack[stack.length - 1].char;
        if ((c === '}' && last === '{') || (c === ')' && last === '(') || (c === ']' && last === '[')) {
          stack.pop();
        } else {
            // Mismatch
        }
      }
    }
  }
}

console.log("Unmatched opening brackets:");
console.log(stack.slice(-10));
