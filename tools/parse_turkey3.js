import fs from 'fs';

const html = fs.readFileSync('turkiye_debug.html', 'utf8');

// Use player-badge-card class as split (broader)
const cards = html.split('class="player-badge-card_container__');
console.log('Cards by player-badge-card_container__:', cards.length - 1);

if (cards.length > 1) {
  // look at the full first card
  const endIdx = cards[1].indexOf('class="player-badge-card_container__');
  const firstCard = endIdx >= 0 ? cards[1].substring(0, endIdx) : cards[1].substring(0, 2000);
  console.log('\n--- First card HTML ---');
  console.log(firstCard);
}
