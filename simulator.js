import { teamsData } from "./data.js";

// Helper function to calculate Poisson random variable
function poissonRandom(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 10);
  return k - 1;
}

// Calculate active ratings of a team based on starting lineup & player injuries
export function calculateActiveRatings(team) {
  let baseRating = team.rating;
  let baseAttack = team.attack;
  let baseMidfield = team.midfield;
  let baseDefense = team.defense;

  // Find current starters
  const starters = team.squad.filter(p => p.isStarter);

  starters.forEach(player => {
    // If starting player is injured, apply deductions
    if (player.injured) {
      const isKey = player.isKey;
      const factor = isKey ? 1.4 : 1.0;
      
      baseRating -= Math.round(5 * factor);
      if (player.position === "DEL") baseAttack -= Math.round(10 * factor);
      if (player.position === "MED") baseMidfield -= Math.round(8 * factor);
      if (player.position === "DEF") baseDefense -= Math.round(8 * factor);
      if (player.position === "POR") baseDefense -= Math.round(10 * factor);
    }

    // Apply player rating influence (deviation from baseline of 78)
    const ratingDelta = (player.rating - 78) / 8.0;
    baseRating += ratingDelta;
    
    if (player.position === "DEL") baseAttack += ratingDelta * 1.5;
    if (player.position === "MED") baseMidfield += ratingDelta * 1.5;
    if (player.position === "DEF") baseDefense += ratingDelta * 1.5;
    if (player.position === "POR") baseDefense += ratingDelta * 1.5;
  });

  return {
    rating: Math.max(40, Math.min(99, Math.round(baseRating))),
    attack: Math.max(40, Math.min(99, Math.round(baseAttack))),
    midfield: Math.max(40, Math.min(99, Math.round(baseMidfield))),
    defense: Math.max(40, Math.min(99, Math.round(baseDefense)))
  };
}

export class WorldCupSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    // Deep copy teams to avoid sharing state between runs
    this.teams = JSON.parse(JSON.stringify(teamsData));

    // Initialize starters dynamically: 1 POR, 4 DEF, 3 MED, 3 DEL as starters (4-3-3 formation). Others are substitutes.
    this.teams.forEach(team => {
      // Sort squad by position order (POR -> DEF -> MED -> DEL) and then by rating descending
      const posOrder = { "POR": 1, "DEF": 2, "MED": 3, "DEL": 4 };
      team.squad.sort((a, b) => {
        if (posOrder[a.position] !== posOrder[b.position]) {
          return posOrder[a.position] - posOrder[b.position];
        }
        return b.rating - a.rating;
      });

      let countPOR = 0;
      let countDEF = 0;
      let countMED = 0;
      let countDEL = 0;

      team.squad.forEach(p => {
        p.isStarter = false; // default
        if (p.position === "POR" && countPOR < 1) { p.isStarter = true; countPOR++; }
        else if (p.position === "DEF" && countDEF < 4) { p.isStarter = true; countDEF++; }
        else if (p.position === "MED" && countMED < 3) { p.isStarter = true; countMED++; }
        else if (p.position === "DEL" && countDEL < 3) { p.isStarter = true; countDEL++; }
      });
    });

    // Try to load custom squad state from localStorage
    this.loadSquadsFromLocalStorage();
    
    // Player stats tracking
    // Key: playerId, Value: { player, teamName, goals: 0, assists: 0, saves: 0, cleanSheets: 0, ratingSum: 0, matchesPlayed: 0 }
    this.playerStats = {};
    this.teams.forEach(team => {
      team.squad.forEach(p => {
        this.playerStats[p.id] = {
          player: p,
          teamId: team.id,
          teamName: team.name,
          goals: 0,
          assists: 0,
          saves: 0,
          cleanSheets: 0,
          matchesPlayed: 0
        };
      });
    });

    // Group Stage state
    this.groups = {}; // 'A' -> [teams], each team has stats
    const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    groupLetters.forEach(letter => {
      this.groups[letter] = this.teams
        .filter(t => t.group === letter)
        .map(t => ({
          ...t,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0
        }));
    });

    this.groupMatches = []; // array of match objects
    this.initGroupMatches();

    // Knockout state
    this.bracket = {
      r32: [], // 16 matches
      r16: [], // 8 matches
      qf: [],  // 4 matches
      sf: [],  // 2 matches
      third: null, // 1 match
      final: null, // 1 match
    };

    this.currentPhase = "groups"; // "groups", "r32", "r16", "qf", "sf", "third_final", "finished"
    this.champion = null;
    this.thirdPlaceWinner = null;
  }

  // Create match schedule for the group stage
  initGroupMatches() {
    const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    groupLetters.forEach(letter => {
      const grpTeams = this.groups[letter];
      // 6 matches per group (Round Robin)
      // Round 1
      this.groupMatches.push({ id: `${letter}_1`, group: letter, home: grpTeams[0], away: grpTeams[1], played: false, score: null, events: [] });
      this.groupMatches.push({ id: `${letter}_2`, group: letter, home: grpTeams[2], away: grpTeams[3], played: false, score: null, events: [] });
      // Round 2
      this.groupMatches.push({ id: `${letter}_3`, group: letter, home: grpTeams[0], away: grpTeams[2], played: false, score: null, events: [] });
      this.groupMatches.push({ id: `${letter}_4`, group: letter, home: grpTeams[1], away: grpTeams[3], played: false, score: null, events: [] });
      // Round 3
      this.groupMatches.push({ id: `${letter}_5`, group: letter, home: grpTeams[0], away: grpTeams[3], played: false, score: null, events: [] });
      this.groupMatches.push({ id: `${letter}_6`, group: letter, home: grpTeams[1], away: grpTeams[2], played: false, score: null, events: [] });
    });
  }

  // Find a team in the current state by ID
  findTeam(id) {
    return this.teams.find(t => t.id === id);
  }

  // Get active playing 11 for a match (1 GK, 4 DEF, 3 MED, 3 DEL, replacing injured starters with healthy bench players of same position)
  getPlayingLineup(team) {
    const starters = team.squad.filter(p => p.isStarter);
    const healthyStarters = starters.filter(p => !p.injured);
    const injuredStarters = starters.filter(p => p.injured);

    if (injuredStarters.length === 0) {
      return starters;
    }

    const playing = [...healthyStarters];
    
    // Find bench players (not starter, not injured)
    const bench = team.squad.filter(p => !p.isStarter && !p.injured);
    
    // Sort bench by rating descending so we choose the best substitutes
    bench.sort((a, b) => b.rating - a.rating);

    for (const injuredPlayer of injuredStarters) {
      const pos = injuredPlayer.position;
      const rIdx = bench.findIndex(p => p.position === pos);
      if (rIdx !== -1) {
        // Found a same position bench player
        const replacement = bench.splice(rIdx, 1)[0];
        playing.push(replacement);
      } else {
        // No same position bench player, take the highest rated player of any position
        if (bench.length > 0) {
          const replacement = bench.shift();
          playing.push(replacement);
        } else {
          // Fallback: keep the injured starter if there are no bench players left at all
          playing.push(injuredPlayer);
        }
      }
    }

    return playing;
  }

  // Simulate a single match between two teams
  simulateMatch(teamA, teamB, isKnockout = false) {
    const lineupA = this.getPlayingLineup(teamA);
    const lineupB = this.getPlayingLineup(teamB);

    const statsA = calculateActiveRatings(teamA);
    const statsB = calculateActiveRatings(teamB);

    // Lambda calculation for Poisson distribution with rating difference shift
    const ratingDiff = statsA.rating - statsB.rating;
    const shift = ratingDiff * 0.05;

    const lambdaA = Math.max(0.1, (statsA.attack * 1.3 - statsB.defense * 0.95 + 10) / 28 + shift);
    const lambdaB = Math.max(0.1, (statsB.attack * 1.3 - statsA.defense * 0.95 + 10) / 28 - shift);

    let goalsA = poissonRandom(lambdaA);
    let goalsB = poissonRandom(lambdaB);

    // Increment matches played ONLY for active lineup players
    lineupA.forEach(p => {
      this.playerStats[p.id].matchesPlayed += 1;
    });
    lineupB.forEach(p => {
      this.playerStats[p.id].matchesPlayed += 1;
    });

    // Track events
    const events = [];

    // Simulate Scorers and Assisters
    const simulateScorers = (scoringTeam, concedingTeam, numGoals, playingScoring, playingConceding) => {
      const gk = playingConceding.find(p => p.position === "POR");

      // Goalkeeper saves tracking
      if (gk) {
        // saves proportional to goalkeeper rating and opponent attack
        const savesCount = Math.floor(Math.random() * 3) + (gk.rating > 82 ? 2 : 1);
        this.playerStats[gk.id].saves += savesCount;
      }

      for (let g = 0; g < numGoals; g++) {
        // 1. Goal Scorer selection
        // DEL: 75% odds, MED: 22%, DEF: 3%, POR: 0%
        let scorer = null;
        const roll = Math.random() * 100;
        let targetPosition = "DEL";
        if (roll > 75 && roll <= 97) targetPosition = "MED";
        else if (roll > 97) targetPosition = "DEF";

        let candidates = playingScoring.filter(p => p.position === targetPosition);
        if (candidates.length === 0) {
          // fallback to any midfielder/forward
          candidates = playingScoring.filter(p => p.position === "DEL" || p.position === "MED");
          if (candidates.length === 0) candidates = playingScoring;
        }

        // Weighted select based on rating
        const totalRating = candidates.reduce((sum, p) => sum + p.rating, 0);
        let weightRoll = Math.random() * totalRating;
        for (const p of candidates) {
          weightRoll -= p.rating;
          if (weightRoll <= 0) {
            scorer = p;
            break;
          }
        }
        if (!scorer) scorer = candidates[0];

        this.playerStats[scorer.id].goals += 1;

        // 2. Assist Provider selection (70% chance of assist)
        let assister = null;
        if (Math.random() < 0.70 && playingScoring.length > 1) {
          // MED: 60%, DEL: 30%, DEF: 10%
          const assistRoll = Math.random() * 100;
          let assistPos = "MED";
          if (assistRoll > 60 && assistRoll <= 90) assistPos = "DEL";
          else if (assistRoll > 90) assistPos = "DEF";

          // Candidates exclude the scorer
          let assistCandidates = playingScoring.filter(p => p.position === assistPos && p.id !== scorer.id);
          if (assistCandidates.length === 0) {
            assistCandidates = playingScoring.filter(p => p.id !== scorer.id);
          }

          if (assistCandidates.length > 0) {
            const totalAssistRating = assistCandidates.reduce((sum, p) => sum + p.rating, 0);
            let weightAssistRoll = Math.random() * totalAssistRating;
            for (const p of assistCandidates) {
              weightAssistRoll -= p.rating;
              if (weightAssistRoll <= 0) {
                assister = p;
                break;
              }
            }
            if (!assister) assister = assistCandidates[0];
            this.playerStats[assister.id].assists += 1;
          }
        }

        events.push({
          minute: Math.floor(Math.random() * 90) + 1,
          scorer: scorer.name,
          assister: assister ? assister.name : null
        });
      }
    };

    simulateScorers(teamA, teamB, goalsA, lineupA, lineupB);
    simulateScorers(teamB, teamA, goalsB, lineupB, lineupA);

    // Clean sheet tracking for Goalkeepers
    if (goalsB === 0) {
      const gkA = lineupA.find(p => p.position === "POR");
      if (gkA) this.playerStats[gkA.id].cleanSheets += 1;
    }
    if (goalsA === 0) {
      const gkB = lineupB.find(p => p.position === "POR");
      if (gkB) this.playerStats[gkB.id].cleanSheets += 1;
    }

    // Sort events by minute
    events.sort((a, b) => a.minute - b.minute);

    let result = {
      goalsA,
      goalsB,
      extraTime: false,
      penalties: false,
      penaltyScore: null,
      events,
      winner: null
    };

    if (goalsA === goalsB) {
      if (isKnockout) {
        // Simulate Extra Time (30 mins)
        result.extraTime = true;
        const extraLambdaA = lambdaA * 0.33;
        const extraLambdaB = lambdaB * 0.33;
        const extraGoalsA = poissonRandom(extraLambdaA);
        const extraGoalsB = poissonRandom(extraLambdaB);

        goalsA += extraGoalsA;
        goalsB += extraGoalsB;
        result.goalsA = goalsA;
        result.goalsB = goalsB;

        simulateScorers(teamA, teamB, extraGoalsA, lineupA, lineupB);
        simulateScorers(teamB, teamA, extraGoalsB, lineupB, lineupA);

        if (goalsA === goalsB) {
          // Simulate Penalty Shootout
          result.penalties = true;
          let penA = 0;
          let penB = 0;
          
          // Probability of scoring a penalty: base 75%, modified by goalie rating vs kicker rating
          const gkA = lineupA.find(p => p.position === "POR");
          const gkB = lineupB.find(p => p.position === "POR");
          
          const getPenProb = (kickerRating, goalieRating) => {
            return 0.75 + (kickerRating - goalieRating) / 200;
          };

          // 5 kicks round-robin
          for (let i = 0; i < 5; i++) {
            if (Math.random() < getPenProb(80, gkB ? gkB.rating : 75)) penA++;
            if (Math.random() < getPenProb(80, gkA ? gkA.rating : 75)) penB++;
          }

          // Sudden death if draw
          let round = 5;
          while (penA === penB && round < 15) {
            if (Math.random() < getPenProb(80, gkB ? gkB.rating : 75)) penA++;
            if (Math.random() < getPenProb(80, gkA ? gkA.rating : 75)) penB++;
            round++;
          }

          // Ensure a winner
          if (penA === penB) {
            if (Math.random() > 0.5) penA++;
            else penB++;
          }

          result.penaltyScore = { a: penA, b: penB };
          result.winner = penA > penB ? "A" : "B";
        } else {
          result.winner = goalsA > goalsB ? "A" : "B";
        }
      } else {
        result.winner = "Draw";
      }
    } else {
      result.winner = goalsA > goalsB ? "A" : "B";
    }

    return result;
  }

  // Simulate all group matches
  simulateGroupStage() {
    this.groupMatches.forEach(m => {
      if (!m.played) {
        // Find team references in the group structure to update their standings
        const grp = this.groups[m.group];
        const teamH = grp.find(t => t.id === m.home.id);
        const teamA = grp.find(t => t.id === m.away.id);

        const res = this.simulateMatch(teamH, teamA, false);
        m.score = { home: res.goalsA, away: res.goalsB };
        m.events = res.events;
        m.played = true;

        // Update tables
        teamH.played += 1;
        teamA.played += 1;
        teamH.goalsFor += res.goalsA;
        teamH.goalsAgainst += res.goalsB;
        teamA.goalsFor += res.goalsB;
        teamA.goalsAgainst += res.goalsA;
        teamH.goalDifference = teamH.goalsFor - teamH.goalsAgainst;
        teamA.goalDifference = teamA.goalsFor - teamA.goalsAgainst;

        if (res.winner === "A") {
          teamH.won += 1;
          teamH.points += 3;
          teamA.lost += 1;
        } else if (res.winner === "B") {
          teamA.won += 1;
          teamA.points += 3;
          teamH.lost += 1;
        } else {
          teamH.drawn += 1;
          teamH.points += 1;
          teamA.drawn += 1;
          teamA.points += 1;
        }
      }
    });

    // Sort Groups Standings
    Object.keys(this.groups).forEach(letter => {
      this.groups[letter].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return Math.random() - 0.5; // fallback
      });
    });

    this.currentPhase = "r32";
    this.initRoundOf32();
  }

  // Initialize Round of 32 matches based on Group results
  initRoundOf32() {
    const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    
    // 1. Get Winners, Runners-up and Thirds
    const winners = [];
    const runnersUp = [];
    const thirds = [];

    groupLetters.forEach(letter => {
      const grp = this.groups[letter];
      winners.push(this.findTeam(grp[0].id));
      runnersUp.push(this.findTeam(grp[1].id));
      thirds.push(this.findTeam(grp[2].id));
    });

    // 2. Identify the 8 best thirds
    const getThirdsStats = (team) => {
      const letter = team.group;
      const grpTeam = this.groups[letter].find(t => t.id === team.id);
      return grpTeam || { points: 0, goalDifference: 0, goalsFor: 0 };
    };

    const sortedThirds = [...thirds].sort((a, b) => {
      const statsA = getThirdsStats(a);
      const statsB = getThirdsStats(b);
      if (statsB.points !== statsA.points) return statsB.points - statsA.points;
      if (statsB.goalDifference !== statsA.goalDifference) return statsB.goalDifference - statsA.goalDifference;
      if (statsB.goalsFor !== statsA.goalsFor) return statsB.goalsFor - statsA.goalsFor;
      return Math.random() - 0.5;
    });

    const bestThirds = sortedThirds.slice(0, 8);

    // 3. Pair them deterministically
    // - 8 Winners vs 8 Best Thirds
    // - 4 Winners vs 4 Runners-up
    // - 8 Runners-up vs 8 Runners-up
    this.bracket.r32 = [];

    // Pair Winners 0-7 with Best Thirds 0-7
    for (let i = 0; i < 8; i++) {
      this.bracket.r32.push({
        id: `r32_${i + 1}`,
        home: winners[i],
        away: bestThirds[i],
        played: false,
        score: null,
        winner: null,
        details: null
      });
    }

    // Pair Winners 8-11 with RunnersUp 0-3
    for (let i = 0; i < 4; i++) {
      this.bracket.r32.push({
        id: `r32_${i + 9}`,
        home: winners[i + 8],
        away: runnersUp[i],
        played: false,
        score: null,
        winner: null,
        details: null
      });
    }

    // Pair remaining RunnersUp 4-11 with each other (4 vs 5, 6 vs 7, 8 vs 9, 10 vs 11)
    const runIdx = [4, 5, 6, 7, 8, 9, 10, 11];
    for (let i = 0; i < 8; i += 2) {
      this.bracket.r32.push({
        id: `r32_${(i / 2) + 13}`,
        home: runnersUp[runIdx[i]],
        away: runnersUp[runIdx[i + 1]],
        played: false,
        score: null,
        winner: null,
        details: null
      });
    }
  }

  // Initialize Round of 16 matches based on Round of 32 results
  initRoundOf16() {
    this.bracket.r16 = [];
    for (let i = 0; i < 16; i += 2) {
      const match1 = this.bracket.r32[i];
      const match2 = this.bracket.r32[i + 1];
      const home = match1.winner === "home" ? match1.home : match1.away;
      const away = match2.winner === "home" ? match2.home : match2.away;
      this.bracket.r16.push({
        id: `r16_${(i / 2) + 1}`,
        home,
        away,
        played: false,
        score: null,
        winner: null,
        details: null
      });
    }
  }

  // Simulate a knockout phase
  simulatePhase() {
    if (this.currentPhase === "groups") {
      this.simulateGroupStage();
    } else if (this.currentPhase === "r32") {
      this.bracket.r32.forEach(m => this.simulateKnockoutMatch(m));
      this.currentPhase = "r16";
      this.initRoundOf16();
    } else if (this.currentPhase === "r16") {
      this.bracket.r16.forEach(m => this.simulateKnockoutMatch(m));
      this.currentPhase = "qf";
      this.initQuarterFinals();
    } else if (this.currentPhase === "qf") {
      this.bracket.qf.forEach(m => this.simulateKnockoutMatch(m));
      this.currentPhase = "sf";
      this.initSemiFinals();
    } else if (this.currentPhase === "sf") {
      this.bracket.sf.forEach(m => this.simulateKnockoutMatch(m));
      this.currentPhase = "third_final";
      this.initFinalAndThirdPlace();
    } else if (this.currentPhase === "third_final") {
      this.simulateKnockoutMatch(this.bracket.third);
      this.simulateKnockoutMatch(this.bracket.final);

      // Set Champion and Third place
      const finalMatch = this.bracket.final;
      this.champion = finalMatch.winner === "home" ? finalMatch.home : finalMatch.away;
      
      const thirdMatch = this.bracket.third;
      this.thirdPlaceWinner = thirdMatch.winner === "home" ? thirdMatch.home : thirdMatch.away;

      this.currentPhase = "finished";
    }
  }

  // Helper to simulate a specific knockout match object
  simulateKnockoutMatch(m) {
    if (m.played) return;
    const res = this.simulateMatch(m.home, m.away, true);
    m.score = { home: res.goalsA, away: res.goalsB };
    m.winner = res.winner === "A" ? "home" : "away";
    m.details = res;
    m.played = true;
  }

  // Set manual winner (allows user selection to override simulation)
  setManualWinner(phase, matchId, winnerSide) {
    let match = null;
    if (phase === "r32") match = this.bracket.r32.find(m => m.id === matchId);
    else if (phase === "r16") match = this.bracket.r16.find(m => m.id === matchId);
    else if (phase === "qf") match = this.bracket.qf.find(m => m.id === matchId);
    else if (phase === "sf") match = this.bracket.sf.find(m => m.id === matchId);
    else if (phase === "third") match = this.bracket.third;
    else if (phase === "final") match = this.bracket.final;

    if (match && !match.played) {
      match.score = winnerSide === "home" ? { home: 1, away: 0 } : { home: 0, away: 1 };
      match.winner = winnerSide;
      match.played = true;
      match.details = {
        goalsA: match.score.home,
        goalsB: match.score.away,
        extraTime: false,
        penalties: false,
        events: [{ minute: 45, scorer: "Manual Selection", assister: null }]
      };
      
      // Update stats for matches played
      const incrementMatches = (team) => {
        team.squad.forEach(p => {
          if (!p.injured) this.playerStats[p.id].matchesPlayed += 1;
        });
      };
      incrementMatches(match.home);
      incrementMatches(match.away);
    }
  }

  // LocalStorage helper methods
  saveSquadsToLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const squadState = {};
      this.teams.forEach(team => {
        squadState[team.id] = team.squad.map(p => ({
          id: p.id,
          isStarter: p.isStarter,
          injured: p.injured
        }));
      });
      localStorage.setItem("world_cup_squad_state", JSON.stringify(squadState));
    } catch (e) {
      console.error("Error saving squad state to localStorage", e);
    }
  }

  loadSquadsFromLocalStorage() {
    if (typeof localStorage === 'undefined') return false;
    try {
      const saved = localStorage.getItem("world_cup_squad_state");
      if (saved) {
        const squadState = JSON.parse(saved);
        this.teams.forEach(team => {
          const savedSquad = squadState[team.id];
          if (savedSquad) {
            savedSquad.forEach(savedPlayer => {
              const player = team.squad.find(p => p.id === savedPlayer.id);
              if (player) {
                player.isStarter = savedPlayer.isStarter;
                player.injured = savedPlayer.injured;
              }
            });
          }
        });
        return true;
      }
    } catch (e) {
      console.error("Error loading squad state from localStorage", e);
    }
    return false;
  }

  // Initialize Quarter Finals
  initQuarterFinals() {
    // Pairings:
    // QF1: Winner R16_1 vs Winner R16_2
    // QF2: Winner R16_3 vs Winner R16_4
    // QF3: Winner R16_5 vs Winner R16_6
    // QF4: Winner R16_7 vs Winner R16_8
    const pairings = [
      { m1: 0, m2: 1, id: "qf_1" },
      { m1: 2, m2: 3, id: "qf_2" },
      { m1: 4, m2: 5, id: "qf_3" },
      { m1: 6, m2: 7, id: "qf_4" }
    ];

    this.bracket.qf = pairings.map(p => {
      const match1 = this.bracket.r16[p.m1];
      const match2 = this.bracket.r16[p.m2];
      const home = match1.winner === "home" ? match1.home : match1.away;
      const away = match2.winner === "home" ? match2.home : match2.away;
      return {
        id: p.id,
        home,
        away,
        played: false,
        score: null,
        winner: null,
        details: null
      };
    });
  }

  // Initialize Semi Finals
  initSemiFinals() {
    // Pairings:
    // SF1: Winner QF1 vs Winner QF2
    // SF2: Winner QF3 vs Winner QF4
    const pairings = [
      { m1: 0, m2: 1, id: "sf_1" },
      { m1: 2, m2: 3, id: "sf_2" }
    ];

    this.bracket.sf = pairings.map(p => {
      const match1 = this.bracket.qf[p.m1];
      const match2 = this.bracket.qf[p.m2];
      const home = match1.winner === "home" ? match1.home : match1.away;
      const away = match2.winner === "home" ? match2.home : match2.away;
      return {
        id: p.id,
        home,
        away,
        played: false,
        score: null,
        winner: null,
        details: null
      };
    });
  }

  // Initialize Final and Third Place Match
  initFinalAndThirdPlace() {
    const sf1 = this.bracket.sf[0];
    const sf2 = this.bracket.sf[1];

    const finalHome = sf1.winner === "home" ? sf1.home : sf1.away;
    const finalAway = sf2.winner === "home" ? sf2.home : sf2.away;

    const thirdHome = sf1.winner === "home" ? sf1.away : sf1.home;
    const thirdAway = sf2.winner === "home" ? sf2.away : sf2.home;

    this.bracket.final = {
      id: "final",
      home: finalHome,
      away: finalAway,
      played: false,
      score: null,
      winner: null,
      details: null
    };

    this.bracket.third = {
      id: "third",
      home: thirdHome,
      away: thirdAway,
      played: false,
      score: null,
      winner: null,
      details: null
    };
  }

  // Full simulation from current state
  simulateAll() {
    while (this.currentPhase !== "finished") {
      this.simulatePhase();
    }
  }

  // Get awards statistics
  getAwards() {
    const statsList = Object.values(this.playerStats);

    // 1. Goleador (Top Scorer)
    // Primary: Goals, Secondary: Assists, Tertiary: Lower matches played
    const topScorers = [...statsList].sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.matchesPlayed - b.matchesPlayed;
    });
    const goldenBoot = topScorers[0];

    // 2. Máximo Asistente (Top Playmaker)
    // Primary: Assists, Secondary: Goals, Tertiary: Lower matches played
    const topAssisters = [...statsList].sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.matchesPlayed - b.matchesPlayed;
    });
    const goldenPlaymaker = topAssisters[0];

    // 3. Mejor Jugador Joven (Best Young Player, age <= 21)
    // Selected from players <= 21, sorting by sum of goals + assists, then rating
    const youngPlayers = statsList.filter(p => p.player.age <= 21);
    const topYoung = youngPlayers.sort((a, b) => {
      const scoreA = a.goals * 1.5 + a.assists;
      const scoreB = b.goals * 1.5 + b.assists;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.player.rating - a.player.rating;
    });
    const goldenBoy = topYoung[0] || null;

    // 4. Mejor Arquero (Best Goalkeeper / Golden Glove)
    // Selected from POR, sorting by clean sheets, saves, then team rating
    const goalkeepers = statsList.filter(p => p.player.position === "POR");
    const topKeepers = goalkeepers.sort((a, b) => {
      if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
      if (b.saves !== a.saves) return b.saves - a.saves;
      return b.player.rating - a.player.rating;
    });
    const goldenGlove = topKeepers[0];

    return {
      goldenBoot,
      goldenPlaymaker,
      goldenBoy,
      goldenGlove
    };
  }
}
