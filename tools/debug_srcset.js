import fs from 'fs';

// Use the cached Canada rendered.html since we know it works
const html = fs.readFileSync('rendered.html', 'utf8');
const cards = html.split('player-badge-card_playerImageContainer__');
console.log('Cards:', cards.length - 1);

if (cards.length > 1) {
  const block = cards[1]; // first player

  const srcsetMatch = block.match(/srcset="([^"]+)"/);
  if (srcsetMatch) {
    console.log('\nFull srcset value:');
    console.log(srcsetMatch[1]);
    console.log('\n--- Parsing srcset ---');
    const parts = srcsetMatch[1].split(',').map(s => s.trim());
    parts.forEach((p, i) => {
      console.log(`Part ${i}: ${p.substring(0, 120)}`);
    });
    
    // Test the new logic
    const part320 = parts.find(s => s.includes('320w')) || parts[0];
    const candidate = part320.split(' ')[0].trim();
    console.log('\nSelected candidate (320w):');
    console.log(candidate.substring(0, 150));
    console.log('Starts with digitalhub:', candidate.startsWith('https://digitalhub.fifa.com/transform/'));
    console.log('After gravity replace:', candidate.replace(/&amp;/g, '&').replace('gravity:top', 'gravity:face').substring(0, 150));
  } else {
    console.log('No srcset found in block 1');
  }
}
