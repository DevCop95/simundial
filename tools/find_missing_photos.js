import { teamsData } from '../data.js';

const missingPhotos = [];

teamsData.forEach(team => {
  team.squad.forEach(player => {
    if (!player.photo || player.photo.trim() === '') {
      missingPhotos.push({
        team: team.name,
        teamId: team.id,
        playerName: player.name,
        playerId: player.id
      });
    }
  });
});

console.log(`Total players missing photos: ${missingPhotos.length}`);
console.log(JSON.stringify(missingPhotos, null, 2));
