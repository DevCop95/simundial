import fs from 'fs';

function test() {
  const html = fs.readFileSync('rendered.html', 'utf8');
  
  // Let's locate player cards
  // A card usually has class="player-badge-card_..." and contains:
  // - name: player-badge-card_playerName__...
  // - position: player-badge-card_playerPosition__...
  // - image src/srcset inside player-badge-card_playerImage__...
  
  // Let's search for player-badge-card blocks
  // Since it is minified, we can split by player-badge-card_playerName
  const parts = html.split('player-badge-card_playerName');
  console.log(`Found ${parts.length - 1} name elements.`);
  
  // Let's check the first couple of parts
  parts.slice(1, 4).forEach((part, idx) => {
    console.log(`\n--- Part ${idx+1} ---`);
    // Print the first 500 characters
    console.log(part.substring(0, 500));
  });
}

test();
