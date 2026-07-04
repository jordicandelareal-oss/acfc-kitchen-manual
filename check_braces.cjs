const fs = require('fs');
const lines = fs.readFileSync('test_script.js', 'utf8').split('\n');
let stack = [];
lines.forEach((line, i) => {
  for (let c of line) {
    if (c === '{') stack.push(i + 1);
    else if (c === '}') stack.pop();
  }
});
console.log('Unclosed braces at lines:', stack);
