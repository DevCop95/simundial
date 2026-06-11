import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { teamsData } from '../data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_PATH = join(__dirname, 'wikipedia_cache.json');
let cache = {};
if (fs.existsSync(CACHE_PATH)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    console.log(`Loaded ${Object.keys(cache).length} entries from wikipedia_cache.json`);
  } catch (e) {
    console.warn("Could not parse cache file, starting fresh.");
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithRetry(url, options = {}, retries = 5, backoff = 3000) {
  const headers = {
    'User-Agent': CHROME_UA,
    ...options.headers
  };
  options.headers = headers;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoff * Math.pow(2, i);
        console.warn(`\n[429 Rate Limit] Hit rate limit on: ${url}`);
        console.warn(`Waiting ${waitTime / 1000}s to cool down before retry...`);
        await sleep(waitTime);
        continue;
      }
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      const waitTime = backoff * Math.pow(2, i);
      console.warn(`\n[Network Error] ${e.message}. Retrying in ${waitTime / 1000}s...`);
      await sleep(waitTime);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

const FOOTBALL_KEYWORDS = [
  'football', 'soccer', 'fútbol', 'futbol', 'futbolista', 'footballer',
  'player', 'jugador', 'goalkeeper', 'portero', 'guardameta',
  'defender', 'defensa', 'midfielder', 'centrocampista', 'mediocampista',
  'striker', 'delantero', 'forward', 'atacante', 'squad', 'club', 'team',
  'capitán', 'captain', 'debut', 'selección', 'national team'
];

const REJECT_KEYWORDS = [
  'logo', 'flag', 'crest', 'shield', 'kit', 'jersey', 'shirt', 'escudo', 
  'bandera', 'silhouette', 'placeholder', 'stub', 'stadium', 'stadi', 
  'arena', 'map', 'globe', 'monument', 'cup', 'trophy', 'blank', 'no_image',
  'default', 'silhouette', 'federation', 'association', '.svg', 'waalwijk', 'angers'
];

const countryNames = {
  "México": { es: "méxico", en: "mexico", nationals: ["mexicano", "mexicana", "mexican"] },
  "Sudáfrica": { es: "sudáfrica", en: "south africa", nationals: ["south african", "sudafricano", "sudafricana"] },
  "Corea del Sur": { es: "corea", en: "korea", nationals: ["south korean", "coreano", "coreana"] },
  "Rep. Checa": { es: "checa", en: "czech", nationals: ["czech", "checo", "checa"] },
  "Canadá": { es: "canadá", en: "canada", nationals: ["canadian", "canadiense"] },
  "Bosnia-Herz.": { es: "bosnia", en: "bosnia", nationals: ["bosnian", "bosnio", "bosnia"] },
  "Catar": { es: "catar", en: "qatar", nationals: ["qatari", "catarí"] },
  "Suiza": { es: "suiza", en: "switzerland", nationals: ["swiss", "suizo", "suiza"] },
  "Brasil": { es: "brasil", en: "brazil", nationals: ["brazilian", "brasileño", "brasileña", "brasilero", "brasilera"] },
  "Marruecos": { es: "marruecos", en: "morocco", nationals: ["moroccan", "marroquí"] },
  "Haití": { es: "haití", en: "haiti", nationals: ["haitian", "haitiano", "haitiana"] },
  "Escocia": { es: "escocia", en: "scotland", nationals: ["scottish", "escocés", "escocesa"] },
  "Estados Unidos": { es: "estados unidos", en: "united states", nationals: ["american", "usa", "estadounidense"] },
  "Paraguay": { es: "paraguay", en: "paraguay", nationals: ["paraguayan", "paraguayo", "paraguaya"] },
  "Australia": { es: "australia", en: "australia", nationals: ["australian", "australiano", "australiana"] },
  "Turquía": { es: "turquía", en: "turkey", nationals: ["turkish", "turco", "turca", "turkiye"] },
  "Alemania": { es: "alemania", en: "germany", nationals: ["german", "alemán", "alemana"] },
  "Curaçao": { es: "curaçao", en: "curacao", nationals: ["curacao", "curaçao", "curazao", "curazoleño", "curazoleña"] },
  "Costa de Marfil": { es: "marfil", en: "ivory coast", nationals: ["ivorian", "marfileño", "marfileña", "côte d'ivoire", "cote d'ivoire"] },
  "Ecuador": { es: "ecuador", en: "ecuador", nationals: ["ecuadorian", "ecuatoriano", "ecuatoriana"] },
  "Países Bajos": { es: "holanda", en: "netherlands", nationals: ["dutch", "neerlandés", "neerlandesa", "holandés", "holandesa"] },
  "Japón": { es: "japón", en: "japan", nationals: ["japanese", "japonés", "japonesa"] },
  "Suecia": { es: "suecia", en: "sweden", nationals: ["swedish", "sueco", "sueca"] },
  "Túnez": { es: "túnez", en: "tunisia", nationals: ["tunisian", "tunecino", "tunecina"] },
  "Bélgica": { es: "bélgica", en: "belgium", nationals: ["belgian", "belga"] },
  "Egipto": { es: "egipto", en: "egypt", nationals: ["egyptian", "egipcio", "egipcia"] },
  "Irán": { es: "irán", en: "iran", nationals: ["iranian", "iraní", "persa"] },
  "Nueva Zelanda": { es: "nueva zelanda", en: "new zealand", nationals: ["new zealander", "neozelandés", "neozelandesa"] },
  "España": { es: "españa", en: "spain", nationals: ["spanish", "español", "española", "espanol"] },
  "Cabo Verde": { es: "cabo verde", en: "cape verde", nationals: ["cape verdean", "caboverdiano", "caboverdiana"] },
  "Arabia Saudita": { es: "arabia", en: "saudi", nationals: ["saudi", "saudí", "saudita"] },
  "Uruguay": { es: "uruguay", en: "uruguay", nationals: ["uruguayan", "uruguayo", "uruguaya"] },
  "Francia": { es: "francia", en: "france", nationals: ["french", "francés", "francesa"] },
  "Senegal": { es: "senegal", en: "senegal", nationals: ["senegalese", "senegalés", "senegalesa"] },
  "Irak": { es: "irak", en: "iraq", nationals: ["iraqi", "iraquí"] },
  "Noruega": { es: "noruega", en: "norway", nationals: ["norwegian", "noruego", "noruega"] },
  "Argentina": { es: "argentina", en: "argentina", nationals: ["argentine", "argentinian", "argentino", "argentina"] },
  "Argelia": { es: "argelia", en: "algeria", nationals: ["algerian", "argelino", "argelina"] },
  "Austria": { es: "austria", en: "austria", nationals: ["austrian", "austriaco", "austriaca"] },
  "Jordania": { es: "jordania", en: "jordan", nationals: ["jordanian", "jordano", "jordana"] },
  "Portugal": { es: "portugal", en: "portugal", nationals: ["portuguese", "portugués", "portuguesa"] },
  "R.D. Congo": { es: "congo", en: "congo", nationals: ["congolese", "congoleño", "congoleña"] },
  "Uzbekistán": { es: "uzbekistán", en: "uzbekistan", nationals: ["uzbek", "uzbeko", "uzbeka"] },
  "Colombia": { es: "colombia", en: "colombia", nationals: ["colombian", "colombiano", "colombiana"] },
  "Inglaterra": { es: "inglaterra", en: "england", nationals: ["english", "inglés", "inglesa"] },
  "Croacia": { es: "croacia", en: "croatia", nationals: ["croatian", "croata"] },
  "Ghana": { es: "ghana", en: "ghana", nationals: ["ghanaian", "ghanés", "ghanesa"] },
  "Panamá": { es: "panamá", en: "panama", nationals: ["panamanian", "panameño", "panameña"] }
};

function isValidPlayerImage(url) {
  if (!url) return false;
  const l = url.toLowerCase();
  
  const isImg = l.includes('.jpg') || l.includes('.png') || l.includes('.jpeg') || l.includes('.webp');
  if (!isImg) return false;
  
  const hasReject = REJECT_KEYWORDS.some(kw => l.includes(kw));
  if (hasReject) return false;
  
  return true;
}

function calculateScore(page, playerName, countryName) {
  let score = 0;
  
  const title = (page.title || '').toLowerCase();
  const desc = (page.description || '').toLowerCase();
  const excerpt = (page.excerpt || '').toLowerCase();
  
  const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  
  const normTitle = normalize(title);
  const normDesc = normalize(desc);
  const normExcerpt = normalize(excerpt);
  const normPlayerName = normalize(playerName);
  
  // 1. Title match
  const nameParts = normPlayerName.split(/\s+/).filter(p => p.length > 2);
  let namePartsMatched = 0;
  for (const part of nameParts) {
    if (normTitle.includes(part)) {
      score += 6;
      namePartsMatched++;
    }
  }
  
  if (normTitle === normPlayerName) {
    score += 15;
  }
  
  // 2. Football keywords match
  const hasFootballWord = FOOTBALL_KEYWORDS.some(kw => normDesc.includes(kw));
  if (hasFootballWord) score += 12;
  else if (FOOTBALL_KEYWORDS.some(kw => normExcerpt.includes(kw))) score += 6;
  
  // 3. Country match
  const country = countryNames[countryName];
  if (country) {
    const countryKeywords = [
      country.es, country.en, 
      ...(country.nationals || [])
    ].map(k => normalize(k));
    
    const matchesCountry = countryKeywords.some(kw => 
      normTitle.includes(kw) || normDesc.includes(kw) || normExcerpt.includes(kw)
    );
    if (matchesCountry) {
      score += 20;
    }
  }
  
  // 4. Penalties for stubs, surname lists, disambiguation
  if (normDesc.includes("disambiguation") || normTitle.includes("(disambiguation)")) {
    score -= 30;
  }
  if (normDesc.includes("surname") || normDesc.includes("given name") || normDesc.includes("family name")) {
    score -= 25;
  }
  
  return score;
}

async function searchWikipediaREST(playerName, lang = 'en', suffix = ' footballer', countryName = '') {
  const query = playerName + (suffix || '');
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=3`;
  
  try {
    const res = await fetchWithRetry(url);
    const data = await res.json();
    if (!data.pages || data.pages.length === 0) {
      return null;
    }

    // Rank pages
    const scoredPages = data.pages.map(page => ({
      page,
      score: calculateScore(page, playerName, countryName)
    }));

    // Sort descending
    scoredPages.sort((a, b) => b.score - a.score);

    const best = scoredPages[0];
    // We accept results with a match score >= 18
    if (best && best.score >= 18) {
      return best.page.key;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getPageSummaryImage(key, lang = 'en') {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
  try {
    const res = await fetchWithRetry(url);
    const data = await res.json();
    if (data.thumbnail && data.thumbnail.source) {
      const src = data.thumbnail.source;
      if (isValidPlayerImage(src)) {
        return src;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function findPhotoForPlayer(player, teamName) {
  const name = player.name;
  
  // 1. English with footballer suffix
  let key = await searchWikipediaREST(name, 'en', ' footballer', teamName);
  let img = key ? await getPageSummaryImage(key, 'en') : null;
  if (img) return img;

  // 2. Spanish with futbolista suffix
  key = await searchWikipediaREST(name, 'es', ' futbolista', teamName);
  img = key ? await getPageSummaryImage(key, 'es') : null;
  if (img) return img;

  // 3. English plain search
  key = await searchWikipediaREST(name, 'en', '', teamName);
  img = key ? await getPageSummaryImage(key, 'en') : null;
  if (img) return img;

  // 4. Spanish plain search
  key = await searchWikipediaREST(name, 'es', '', teamName);
  img = key ? await getPageSummaryImage(key, 'es') : null;
  if (img) return img;

  // 5. English with soccer suffix
  key = await searchWikipediaREST(name, 'en', ' soccer', teamName);
  img = key ? await getPageSummaryImage(key, 'en') : null;
  if (img) return img;

  return null;
}

async function main() {
  const missing = [];
  teamsData.forEach(team => {
    team.squad.forEach(player => {
      if (!player.photo || player.photo.trim() === '') {
        missing.push({ team: team.name, player, teamId: team.id });
      }
    });
  });

  console.log(`Found ${missing.length} players missing photos in data.js.`);
  if (missing.length === 0) {
    console.log("No missing photos to fetch!");
    return;
  }

  // Sequential execution (concurrency = 1) with delay to keep it natural and avoid blocks
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < missing.length; i++) {
    const { team, player, teamId } = missing[i];
    const pid = player.id;
    
    console.log(`[${i + 1}/${missing.length}] Processing ${player.name} (${team})...`);

    // If we already resolved this player ID in cache (and it's not null), we can use it
    if (cache[pid]) {
      player.photo = cache[pid];
      successCount++;
      skipCount++;
      console.log(`  [CACHE] Hit: ${cache[pid]}`);
      continue;
    }

    try {
      const photoUrl = await findPhotoForPlayer(player, team);
      if (photoUrl) {
        player.photo = photoUrl;
        cache[pid] = photoUrl;
        successCount++;
        console.log(`  [FOUND] ${photoUrl}`);
      } else {
        cache[pid] = null; // Save null so we don't query it again
        failCount++;
        console.log(`  [NOT FOUND]`);
      }
    } catch (err) {
      console.error(`  [ERROR] ${err.message}`);
    }

    // Save cache every 5 players
    if (i % 5 === 0) {
      saveCache();
    }
    
    // Natural delay between players (1200ms)
    await sleep(1200);
  }

  saveCache();

  console.log(`\nScraping complete!`);
  console.log(`Total checked: ${missing.length}`);
  console.log(`Total found: ${successCount}`);
  console.log(`Total not found: ${failCount}`);
  console.log(`Loaded from cache: ${skipCount}`);

  // Save updated teamsData back to data.js
  console.log("\nWriting updated teamsData to data.js...");
  const fileContent = `export const teamsData = ${JSON.stringify(teamsData, null, 2)};\n`;
  const targetDataPath = join(__dirname, '../data.js');
  fs.writeFileSync(targetDataPath, fileContent);
  console.log("Successfully wrote all found photos to data.js!");
}

main();
