import puppeteer from 'puppeteer';
import fs from 'fs';

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const urls = [
    'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/brazil/squad',
    'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/egypt/squad',
    'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/haiti/squad'
  ];

  for (const url of urls) {
    console.log(`Checking ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      const html = await page.content();
      const filename = '../archive/' + url.split('/').slice(-2)[0] + '.html';
      fs.writeFileSync(filename, html);
      console.log(`Saved ${filename} (length: ${html.length})`);
      
      // Check if it contains squad cards
      const hasCards = html.includes('player-badge-card_playerImageContainer__');
      console.log(` -> Has player card class: ${hasCards}`);
    } catch(e) {
      console.error(` -> Error: ${e.message}`);
    }
  }

  await browser.close();
}

test();
