// Using global fetch


async function searchWikipedia(playerName, lang = 'en') {
  const querySuffix = lang === 'en' ? ' footballer' : ' futbolista';
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + querySuffix)}&format=json&origin=*`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MundialSimulator/1.0 (contact@example.com)' }
    });
    const data = await res.json();
    if (!data.query || !data.query.search || data.query.search.length === 0) {
      return null;
    }
    // Return the first search result's title
    return data.query.search[0].title;
  } catch (e) {
    console.error(`Error searching Wikipedia (${lang}):`, e.message);
    return null;
  }
}

async function getPageImage(title, lang = 'en') {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MundialSimulator/1.0 (contact@example.com)' }
    });
    const data = await res.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId && pageId !== '-1' && pages[pageId].thumbnail) {
      return pages[pageId].thumbnail.source;
    }
    return null;
  } catch (e) {
    console.error(`Error getting page image (${lang}):`, e.message);
    return null;
  }
}

async function test() {
  const players = [
    { name: 'Nikola Moro', team: 'Croacia' },
    { name: 'Mateo Kovacic', team: 'Croacia' },
    { name: 'Thomas Partey', team: 'Ghana' },
    { name: 'Luis Mejia', team: 'Panamá' },
    { name: 'Mostafa Shoubir', team: 'Egipto' }
  ];

  for (const player of players) {
    console.log(`\nTesting ${player.name} (${player.team})...`);
    // Try English first
    let title = await searchWikipedia(player.name, 'en');
    let img = null;
    if (title) {
      console.log(`  Found English Wikipedia page: "${title}"`);
      img = await getPageImage(title, 'en');
    }
    
    if (!img) {
      // Try Spanish fallback
      console.log(`  No English image found. Trying Spanish...`);
      title = await searchWikipedia(player.name, 'es');
      if (title) {
        console.log(`  Found Spanish Wikipedia page: "${title}"`);
        img = await getPageImage(title, 'es');
      }
    }
    
    console.log(`  Result photo: ${img || 'NOT FOUND'}`);
  }
}

test();
