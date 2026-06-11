import { teamsData } from '../data.js';

function inspect() {
  console.log(`Total teams in data.js: ${teamsData.length}`);
  const list = teamsData.map(t => ({ id: t.id, name: t.name, group: t.group }));
  console.log(JSON.stringify(list, null, 2));
}

inspect();
