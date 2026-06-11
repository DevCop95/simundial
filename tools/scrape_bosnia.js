import puppeteer from 'puppeteer';
import fs from 'fs';
import { teamsData } from '../data.js';

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

async function scrapeBosnia() {
  console.log("Scraping Bosnia-Herzegovina squad...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/bosnia-herzegovina/squad";
  
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[class*="player-badge-card_playerImageContainer__"]', { timeout: 10000 }).catch(() => {});
  
  const html = await page.content();
  const cards = html.split('player-badge-card_playerImageContainer__');
  const squad = [];
  
  for (let i = 1; i < cards.length; i++) {
    const block = cards[i];
    
    // Photo
    const srcsetMatch = block.match(/srcset="([^"]+)"/);
    let photo = "";
    if (srcsetMatch) {
      const rawSrcset = srcsetMatch[1];
      const entries = rawSrcset.split(/,(?=https:\/\/)/);
      const entry320 = entries.find(e => e.includes('width:320')) || entries[0];
      photo = entry320.split(' ')[0].replace(/&amp;/g, '&').replace('gravity:top', 'gravity:top').trim();
    }
    
    // Name
    const nameMatch = block.match(/>([^<]+)<\/span><\/span><\/div>/);
    if (!nameMatch) continue;
    const name = cleanName(nameMatch[1].trim());
    
    // Position
    const posBlock = block.split('player-badge-card_playerPosition__')[1];
    if (!posBlock) continue;
    const posMatch = posBlock.match(/>([^<]+)<\/span><\/span>/);
    if (!posMatch) continue;
    const position = mapPosition(posMatch[1].trim());
    
    squad.push({
      id: `bih_${name.toLowerCase().replace(/[^a-z]/g, '')}`,
      name,
      position,
      age: 20 + Math.floor(Math.random() * 12),
      rating: 70 + Math.floor(Math.random() * 10),
      injured: false,
      isKey: name.includes("Dzeko") || name.includes("Džeko"),
      photo
    });
  }
  
  console.log(`Scraped ${squad.length} players.`);
  
  const bihIndex = teamsData.findIndex(t => t.id === 'BIH');
  if (bihIndex !== -1) {
    // Preserve existing ratings if names match
    squad.forEach(newP => {
       const oldP = teamsData[bihIndex].squad.find(p => p.name.toLowerCase() === newP.name.toLowerCase());
       if (oldP) {
         newP.age = oldP.age;
         newP.rating = oldP.rating;
         newP.isKey = oldP.isKey;
       }
    });
    
    teamsData[bihIndex].squad = squad;
    fs.writeFileSync('../data.js', `export const teamsData = ${JSON.stringify(teamsData, null, 2)};\n`);
    console.log("Updated data.js with real Bosnia squad.");
  }
  
  await browser.close();
}

scrapeBosnia();
