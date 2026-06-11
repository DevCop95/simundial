import fs from 'fs';

function parse() {
  const html = fs.readFileSync('rendered.html', 'utf8');
  
  // RegExp to find player images and names
  // Structure: alt="[Player Name]" title="" class="image_img__pNjkh ..." ... srcset="[Image URLs]"
  // Or look for: alt="([^"]+)" and transform URLs in the same area
  
  // Let's search for image blocks
  const playerRegex = /<img[^>]+alt="([^"]+)"[^>]+srcset="([^"]+)"/g;
  let match;
  const players = [];
  while ((match = playerRegex.exec(html)) !== null) {
    const name = match[1];
    const srcset = match[2];
    // Extract first URL from srcset
    const firstUrl = srcset.split(',')[0].split(' ')[0].trim();
    players.push({ name, photo: firstUrl });
  }
  
  console.log(`Found ${players.length} players with photos:`);
  players.forEach((p, i) => {
    console.log(`${i+1}. Name: ${p.name}`);
    console.log(`   Photo: ${p.photo}`);
  });
}

parse();
