import puppeteer from 'puppeteer';
import fs from 'fs';

async function probe() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/turkiye/squad', {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(err => console.warn('Nav warning:', err.message));
  
  await page.waitForSelector('[class*="player-badge-card_playerImageContainer__"]', { timeout: 12000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  
  const html = await page.content();
  const cards = html.split('player-badge-card_playerImageContainer__');
  console.log('Total cards:', cards.length - 1);
  
  // Look at first 3 cards
  for (let i = 1; i <= Math.min(3, cards.length - 1); i++) {
    const block = cards[i];
    const srcsetMatch = block.match(/srcset="([^"]+)"/);
    if (srcsetMatch) {
      const first = srcsetMatch[1].split(',')[0].split(' ')[0].trim();
      console.log(`Card ${i} first srcset URL: ${first.substring(0, 150)}`);
    } else {
      // Check for src= instead
      const srcMatch = block.match(/src="([^"]+)"/);
      if (srcMatch) {
        console.log(`Card ${i} src URL: ${srcMatch[1].substring(0, 150)}`);
      } else {
        console.log(`Card ${i}: no src/srcset found`);
        // print first 400 chars of block
        console.log('Block preview:', block.substring(0, 400));
      }
    }
  }
  
  fs.writeFileSync('../archive/turkiye_debug.html', html);
  await browser.close();
}

probe();
