import fs from 'fs';
import { parse } from '@babel/parser';

const code = fs.readFileSync('src/App.jsx', 'utf8');
const lines = code.split('\n');

for (let i = 0; i < lines.length; i += 100) {
  let partialCode = lines.slice(0, i).join('\n');
  try {
    parse(partialCode, { sourceType: 'module', plugins: ['jsx'] });
  } catch (err) {
    if (err.message.includes('Unexpected token')) {
       // if it expects a closing bracket, it might just say unexpected token, or it might say unterminated string
    }
  }
}
