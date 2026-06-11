import fs from 'fs';

function cleanName(raw) {
  if (!raw) return "";
  return raw.split(' ').map(word => {
    if (word.toUpperCase() === word && word.length > 1) {
      return word.charAt(0) + word.slice(1).toLowerCase();
    }
    return word;
  }).join(' ');
}

function mapPosition(esPos) {
  if (!esPos) return "MED";
  const p = esPos.toLowerCase();
  if (p.includes("arque") || p.includes("porter") || p.includes("goalk")) return "POR";
  if (p.includes("defens") || p.includes("zagu") || p.includes("back")) return "DEF";
  if (p.includes("medi") || p.includes("centr") || p.includes("volan") || p.includes("midf")) return "MED";
  if (p.includes("delan") || p.includes("atac") || p.includes("punta") || p.includes("forw") || p.includes("extre")) return "DEL";
  return "MED";
}

function parseFile(filename) {
  const html = fs.readFileSync(filename, 'utf8');
  console.log(`\nParsing ${filename} (length: ${html.length})`);
  
  const cards = html.split('player-badge-card_playerImageContainer__');
  console.log(`Cards split length: ${cards.length}`);
  
  const squad = [];
  for (let i = 1; i < cards.length; i++) {
    const block = cards[i];
    
    // 1. Photo
    const srcsetMatch = block.match(/srcset="([^"]+)"/);
    let photo = "";
    if (srcsetMatch) {
      const candidate = srcsetMatch[1].split(',')[0].split(' ')[0].trim();
      if (candidate.startsWith("https://digitalhub.fifa.com/transform/")) {
        photo = candidate.replace(/&amp;/g, '&');
      }
    }
    
    // 2. Name
    const nameMatch = block.match(/>([^<]+)<\/span><\/span><\/div>/);
    if (!nameMatch) {
      console.log(`  Card ${i}: no name match`);
      continue;
    }
    const name = cleanName(nameMatch[1].trim());
    
    // 3. Position
    const posSplit = block.split('player-badge-card_playerPosition__');
    if (posSplit.length < 2) {
      console.log(`  Card ${i}: no position split`);
      continue;
    }
    const posBlock = posSplit[1];
    const posMatch = posBlock.match(/>([^<]+)<\/span><\/span>/);
    if (!posMatch) {
      console.log(`  Card ${i}: no position match`);
      continue;
    }
    const rawPos = posMatch[1].trim();
    const position = mapPosition(rawPos);
    
    squad.push({ name, position, photo });
  }
  
  console.log(`Successfully parsed ${squad.length} players.`);
  if (squad.length > 0) {
    console.log("Examples:", squad.slice(0, 3));
  }
}

parseFile('brazil.html');
parseFile('egypt.html');
parseFile('haiti.html');
