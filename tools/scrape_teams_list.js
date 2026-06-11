import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  console.log("Launching browser to get teams list...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const url = 'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams';
  console.log("Navigating to: ", url);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log("Page loaded. Extracting links...");
    
    const links = await page.evaluate(() => {
      // Find all anchors that match /teams/
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => a.href)
        .filter(href => href.includes('/teams/') && !href.endsWith('/teams') && !href.endsWith('/teams/'));
    });
    
    const uniqueLinks = [...new Set(links)];
    console.log(`Found ${uniqueLinks.length} team links:`);
    uniqueLinks.forEach((link, idx) => console.log(`${idx+1}. ${link}`));
    
    fs.writeFileSync('../archive/team_links.json', JSON.stringify(uniqueLinks, null, 2));
    
  } catch (e) {
    console.error("Error: ", e);
  } finally {
    await browser.close();
  }
}

run();
