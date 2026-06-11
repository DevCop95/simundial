import puppeteer from 'puppeteer';
import fs from 'fs';
import { teamsData as oldTeamsData } from '../data.js';

const slugMap = {
  "CAN": "canada",
  "USA": "usa",
  "MEX": "mexico",
  "GER": "germany",
  "KSA": "saudi-arabia",
  "ALG": "algeria",
  "ARG": "argentina",
  "AUS": "australia",
  "AUT": "austria",
  "BEL": "belgium",
  "BIH": "bosnia-herzegovina",
  "BRA": "brazil",
  "QAT": "qatar",
  "CZE": "czechia",
  "COL": "colombia",
  "CIV": "cote-d-ivoire",
  "CRO": "croatia",
  "CUW": "curacao",
  "ECU": "ecuador",
  "EGY": "egypt",
  "SCO": "scotland",
  "ESP": "spain",
  "FRA": "france",
  "GHA": "ghana",
  "HAI": "haiti",
  "ENG": "england",
  "IRQ": "iraq",
  "CPV": "cabo-verde",
  "JPN": "japan",
  "JOR": "jordan",
  "MAR": "morocco",
  "NOR": "norway",
  "NZL": "new-zealand",
  "NED": "netherlands",
  "PAN": "panama",
  "PRY": "paraguay",
  "PTG": "portugal",
  "COD": "congo-dr",
  "KOR": "korea-republic",
  "IRN": "ir-iran",
  "SEN": "senegal",
  "RSA": "south-africa",
  "SWE": "sweden",
  "SUI": "switzerland",
  "TUN": "tunisia",
  "TUR": "turkiye",
  "URU": "uruguay",
  "UZB": "uzbekistan"
};

// Map Spanish position to English code
function mapPosition(esPos) {
  if (!esPos) return "MED";
  const p = esPos.toLowerCase();
  if (p.includes("arque") || p.includes("porter") || p.includes("goalk")) return "POR";
  if (p.includes("defens") || p.includes("zagu") || p.includes("back")) return "DEF";
  if (p.includes("medi") || p.includes("centr") || p.includes("volan") || p.includes("midf")) return "MED";
  if (p.includes("delan") || p.includes("atac") || p.includes("punta") || p.includes("forw") || p.includes("extre")) return "DEL";
  return "MED"; // fallback
}

// Convert "Dayne ST. CLAIR" to "Dayne St. Clair" or similar title case
function cleanName(raw) {
  if (!raw) return "";
  return raw.split(' ').map(word => {
    if (word.toUpperCase() === word && word.length > 1) {
      // It's the last name in uppercase, capitalize first letter
      return word.charAt(0) + word.slice(1).toLowerCase();
    }
    return word;
  }).join(' ');
}

async function scrapeAll() {
  console.log("Starting scraper for all 48 squads...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set larger viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  const scrapedTeams = [];
  
  for (const oldTeam of oldTeamsData) {
    const slug = slugMap[oldTeam.id];
    if (!slug) {
      console.warn(`No slug found for team ID ${oldTeam.id}. Skipping.`);
      scrapedTeams.push(oldTeam);
      continue;
    }
    
    // Skip if team already has scraped squad data with gravity:top URLs
    const alreadyScraped = oldTeam.squad.length > 15 && oldTeam.squad.some(p => p.photo && p.photo.includes('gravity:top'));
    if (alreadyScraped) {
      console.log(`Skipping ${oldTeam.name} (${oldTeam.id}) - already scraped.`);
      scrapedTeams.push(oldTeam);
      continue;
    }
    
    const url = `https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/${slug}/squad`;
    console.log(`\nScraping ${oldTeam.name} (${oldTeam.id}) from: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(err => {
        console.warn(`Navigation warning for ${oldTeam.name}: ${err.message}. Proceeding anyway.`);
      });
      
      // Wait dynamically for React player card selector to render
      await page.waitForSelector('[class*="player-badge-card_playerImageContainer__"]', { timeout: 12000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
      
      const html = await page.content();
      
      // Extract cards
      const cards = html.split('player-badge-card_playerImageContainer__');
      const squad = [];
      
      for (let i = 1; i < cards.length; i++) {
        const block = cards[i];
        
        // 1. Photo - FIFA srcset URLs contain commas in query params, so split by ',https://'
        const srcsetMatch = block.match(/srcset="([^"]+)"/);
        let photo = "";
        if (srcsetMatch) {
          // Split entries by ',https://' to avoid splitting inside query string commas
          const rawSrcset = srcsetMatch[1];
          const entries = rawSrcset.split(/,(?=https:\/\/)/);
          // Pick 320w entry for good quality, fall back to first
          const entry320 = entries.find(e => e.includes('width:320')) || entries[0];
          const candidate = entry320.split(' ')[0].trim();
          if (candidate.startsWith('https://digitalhub.fifa.com/transform/')) {
            photo = candidate
              .replace(/&amp;/g, '&')
              .replace('gravity:top', 'gravity:top');
          }
        }

        
        // 2. Name
        const nameMatch = block.match(/>([^<]+)<\/span><\/span><\/div>/);
        if (!nameMatch) continue;
        const name = cleanName(nameMatch[1].trim());
        
        // 3. Position
        const posBlock = block.split('player-badge-card_playerPosition__')[1];
        if (!posBlock) continue;
        const posMatch = posBlock.match(/>([^<]+)<\/span><\/span>/);
        if (!posMatch) continue;
        const rawPos = posMatch[1].trim();
        const position = mapPosition(rawPos);
        
        // Match with existing player to inherit ratings and metadata if possible
        const cleanOldName = (n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const searchName = cleanOldName(name);
        
        const existingPlayer = oldTeam.squad.find(p => {
          const oldN = cleanOldName(p.name);
          return searchName.includes(oldN) || oldN.includes(searchName);
        });
        
        let age = existingPlayer ? existingPlayer.age : (20 + Math.floor(Math.random() * 12));
        let rating = existingPlayer ? existingPlayer.rating : (70 + Math.floor(Math.random() * 10));
        let isKey = existingPlayer ? existingPlayer.isKey : false;
        
        squad.push({
          id: `${oldTeam.id.toLowerCase()}_${name.toLowerCase().replace(/[^a-z]/g, '')}`,
          name,
          position,
          age,
          rating,
          injured: false,
          isKey,
          photo // We save the official scraped photo URL!
        });
      }
      
      console.log(`Scraped ${squad.length} players for ${oldTeam.name}.`);
      
      // If we failed to scrape any players, fall back to old squad
      if (squad.length === 0) {
        console.warn(`Scrape failed or empty for ${oldTeam.name}. Using previous squad.`);
        scrapedTeams.push(oldTeam);
      } else {
        // Build new team object
        scrapedTeams.push({
          ...oldTeam,
          squad
        });
      }
      
    } catch (e) {
      console.error(`Error scraping ${oldTeam.name}: `, e.message);
      scrapedTeams.push(oldTeam);
    }
  }
  
  await browser.close();
  
  // Write scrapedTeams into data.js
  console.log("\nAll scraping complete. Writing data to data.js...");
  
  const fileContent = `export const teamsData = ${JSON.stringify(scrapedTeams, null, 2)};\n`;
  fs.writeFileSync('../data.js', fileContent);
  console.log("Successfully wrote all real team players and official photo URLs to data.js!");
}

scrapeAll();
