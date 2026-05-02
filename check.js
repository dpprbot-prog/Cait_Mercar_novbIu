const fs = require('fs');
const content = fs.readFileSync('src/app/salary/page.tsx', 'utf8');
try {
  require('babel-core'); // Or something to parse, wait I can just use a simple regex or count tags
} catch (e) {
  console.log('Cant parse');
}
