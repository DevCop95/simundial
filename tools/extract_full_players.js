import fs from 'fs';

function extract() {
  const html = fs.readFileSync('rendered.html', 'utf8');
  
  // Let's find each player card.
  // We can search for the wrapper class or just split by the card container
  const cards = html.split('player-badge-card_playerImageContainer__');
  console.log(`Found ${cards.length - 1} card blocks.`);
  
  const players = [];
  
  // Skip the first block because it is the HTML header content before any card
  for (let i = 1; i < cards.length; i++) {
    const block = cards[i];
    
    // 1. Extract image src
    // It's in the srcset of the image in the block
    const srcsetMatch = block.match(/srcset="([^"]+)"/);
    if (!srcsetMatch) continue;
    const photo = srcsetMatch[1].split(',')[0].split(' ')[0].trim();
    
    // 2. Extract name
    // It's inside a span with the name
    // We can search for the first span that contains the name
    const nameMatch = block.match(/>([^<]+)<\/span><\/span><\/div>/);
    if (!nameMatch) continue;
    const rawName = nameMatch[1].trim();
    
    // 3. Extract position
    // It is in class="player-badge-card_playerPosition__..."><span ...><span>[Position]</span>
    const posBlock = block.split('player-badge-card_playerPosition__')[1];
    if (!posBlock) continue;
    const posMatch = posBlock.match(/>([^<]+)<\/span><\/span>/);
    if (!posMatch) continue;
    const position = posMatch[1].trim();
    
    players.push({ name: rawName, photo, position });
  }
  
  console.log("Extracted players:", JSON.stringify(players, null, 2));
}

extract();
