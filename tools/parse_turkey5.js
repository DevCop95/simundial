import fs from 'fs';

const html = fs.readFileSync('turkiye_debug.html', 'utf8');

const cards = html.split('player-badge-card_playerImageContainer__');
console.log('Cards:', cards.length - 1);

// Print block 1 up to 600 chars
const block1 = cards[1].substring(0, 600);
console.log('\n--- Block 1 (first 600 chars) ---');
console.log(block1);

// Check for img tags with proper player photos
const imgMatches = [...block1.matchAll(/<img[^>]+>/g)];
console.log('\nImg tags in block 1:', imgMatches.length);
imgMatches.forEach((m, i) => console.log('  img', i, ':', m[0]));

// Check if the playerImageContainer only has SVG (no actual photo)
const hasSVG = block1.includes('<svg');
const hasImg = block1.includes('<img');
console.log('\nBlock 1 has SVG:', hasSVG, '| has img:', hasImg);
