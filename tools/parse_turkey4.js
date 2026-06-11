import fs from 'fs';

const html = fs.readFileSync('turkiye_debug.html', 'utf8');

// Find Mert Gunok (first Turkey player) in the HTML
const idx = html.indexOf('Mert');
if (idx < 0) {
  console.log("'Mert' not found in HTML");
} else {
  console.log("Found 'Mert' at index", idx);
  // Print surrounding 1000 chars
  console.log(html.substring(Math.max(0, idx - 800), idx + 400));
}

// Also find what class names are used for player cards (any div with 'badge' or 'player')
const classMatches = [...html.matchAll(/class="([^"]*player-badge[^"]*)"/g)];
const uniqueClasses = [...new Set(classMatches.map(m => m[1]))];
console.log('\nAll player-badge class names:', uniqueClasses.slice(0, 20));
