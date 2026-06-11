import fs from 'fs';
import { teamsData } from '../data.js';

const targets = ['mar_aminesbai', 'cuw_shurandysambo', 'cuw_deveronfonville', 'cuw_godfriedroemeratoe'];
let count = 0;

teamsData.forEach(t => {
  t.squad.forEach(p => {
    if (targets.includes(p.id)) {
      console.log('Resetting bad photo for:', p.name);
      p.photo = '';
      count++;
    }
  });
});

if (count > 0) {
  fs.writeFileSync('../data.js', `export const teamsData = ${JSON.stringify(teamsData, null, 2)};\n`);
  console.log('Successfully cleaned bad photo URLs from data.js');
} else {
  console.log('No targets found to reset.');
}
