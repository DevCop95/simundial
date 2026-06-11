import puppeteer from 'puppeteer';
import fs from 'fs';

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const url = 'https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/teams/canada/squad';
  console.log("Navigating to: ", url);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log("Page loaded. Extracting HTML content...");
    const content = await page.content();
    console.log("Length of rendered HTML: ", content.length);
    
    fs.writeFileSync('../archive/rendered.html', content);
    console.log("Rendered HTML saved successfully to ../archive/rendered.html.");
    
  } catch (e) {
    console.error("Error during puppeteer run: ", e);
  } finally {
    await browser.close();
  }
}

run();
