import fs from 'fs';

const html = fs.readFileSync('turkiye_debug.html', 'utf8');

// Look for the playerImage class (not playerImageContainer)
const cards2 = html.split('player-badge-card_playerImage__');
console.log('Split by playerImage__ (not Container):', cards2.length - 1, 'blocks');

if (cards2.length > 1) {
  const block = cards2[1];
  const srcsetM = block.match(/srcset="([^"]+)"/);
  if (srcsetM) {
    const first = srcsetM[1].split(',')[0].split(' ')[0].trim();
    console.log('First photo URL:', first);
  } else {
    console.log('No srcset. Block preview:', block.substring(0, 500));
  }
}

// Search for all img with digitalhub in their src/srcset
const allImgs = [...html.matchAll(/<img[^>]+digitalhub[^>]+>/g)];
console.log('\nImgs with digitalhub src:', allImgs.length);
allImgs.slice(0, 5).forEach(m => console.log(' ', m[0].substring(0, 200)));

// Find all img tags within player-badge-card sections
const playerCardSections = html.split('player-badge-card_playerInfo__');
console.log('\nSections by playerInfo:', playerCardSections.length - 1);

// Check what's in the region between playerImageContainer and playerInfo for first player
const idx1 = html.indexOf('player-badge-card_playerImageContainer__');
const idx2 = html.indexOf('player-badge-card_playerInfo__');
if (idx1 >= 0 && idx2 >= 0) {
  const region = html.substring(idx1, idx2);
  const imgs = [...region.matchAll(/<img[^>]+>/g)];
  console.log('\nImgs between playerImageContainer and playerInfo:', imgs.length);
  imgs.forEach(m => console.log('  ', m[0].substring(0, 300)));
}
