import fs from 'fs';

function inspect() {
  const html = fs.readFileSync('../archive/rendered.html', 'utf8');
  console.log("File length: ", html.length);
  
  // Let's find some text, e.g. does it contain "Canada" or "Canadá"?
  const hasCanadaEn = html.includes("Canada");
  const hasCanadaEs = html.includes("Canadá");
  console.log("Has 'Canada':", hasCanadaEn);
  console.log("Has 'Canadá':", hasCanadaEs);
  
  // Find all matches for "Alphonso" or "Davies" or "David"
  const hasAlphonso = html.includes("Alphonso");
  const hasDavies = html.includes("Davies");
  const hasDavid = html.includes("David");
  console.log("Has 'Alphonso':", hasAlphonso);
  console.log("Has 'Davies':", hasDavies);
  console.log("Has 'David':", hasDavid);
  
  // Let's find img tags and their sources
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let match;
  const imgSrcs = [];
  while ((match = imgRegex.exec(html)) !== null) {
    imgSrcs.push(match[1]);
  }
  console.log(`Found ${imgSrcs.length} images. Examples:`);
  imgSrcs.slice(0, 15).forEach(src => console.log(" - ", src));
}

inspect();
