import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const urlMain = 'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/canada';
  const urlSquad = 'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/canada/squad';

  async function checkUrl(url, label) {
    console.log(`\nTesting ${label}: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      const html = await page.content();
      const cardSplit = html.split('player-badge-card_playerImageContainer__');
      console.log(` -> Found ${cardSplit.length - 1} player cards.`);
      
      const regexImg = /<img[^>]+alt="([^"]+)"/g;
      let count = 0;
      let m;
      while ((m = regexImg.exec(html)) !== null) {
        if (m[1].toLowerCase().includes("davies") || m[1].toLowerCase().includes("david")) {
          console.log(` -> Found image with alt: "${m[1]}"`);
        }
        count++;
      }
    } catch(e) {
      console.error(` -> Error: ${e.message}`);
    }
  }

  await checkUrl(urlMain, "Main Team Page");
  await checkUrl(urlSquad, "Squad Page");

  await browser.close();
}

test();
