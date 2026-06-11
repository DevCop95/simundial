import fs from 'fs';

function extract() {
  const html = fs.readFileSync('rendered.html', 'utf8');
  
  // Search for Alphonso
  let idx = 0;
  while (true) {
    idx = html.indexOf("Alphonso", idx);
    if (idx === -1) break;
    console.log(`\n=== Found 'Alphonso' at index ${idx} ===`);
    const start = Math.max(0, idx - 300);
    const end = Math.min(html.length, idx + 300);
    console.log(html.substring(start, end));
    idx += 8;
  }
}

extract();
