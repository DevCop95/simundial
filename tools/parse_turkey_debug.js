import fs from 'fs';

const html = fs.readFileSync('turkiye_debug.html', 'utf8');
const cards = html.split('player-badge-card_playerImageContainer__');
console.log('Total cards:', cards.length - 1);

const block = cards[1];

// Look for any digitalhub URL
const allDigitalhub = [...html.matchAll(/https:\/\/digitalhub\.fifa\.com\/transform\/[^"&\s]+/g)];
console.log('Total digitalhub.fifa.com URLs in page:', allDigitalhub.length);
if (allDigitalhub.length > 0) {
  console.log('Sample:', allDigitalhub[0][0].substring(0, 120));
}

// Check what img tags look like in first card
const imgMatches = [...block.matchAll(/<img[^>]+>/g)];
console.log('\nImg tags in first card:', imgMatches.length);
imgMatches.forEach((m, i) => console.log(`  img ${i}:`, m[0].substring(0, 300)));

// Check for data- attributes with srcset
const dataSrcset = block.match(/data-srcset="([^"]+)"/);
console.log('\ndata-srcset:', dataSrcset ? dataSrcset[1].substring(0, 150) : 'none');

// Check what's around the img tag with "flags"
const idx = block.indexOf('flags-sq-4');
if (idx >= 0) {
  console.log('\n--- Context around flags URL ---');
  console.log(block.substring(Math.max(0, idx - 200), idx + 300));
}
