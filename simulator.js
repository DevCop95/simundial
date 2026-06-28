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

    const allGroupsFinished = this.groupMatches.every(m => m.played);
    if (allGroupsFinished) {
      this.currentPhase = "r32";
      this.initRoundOf32();
    }
  }

  // Create match schedule for the group stage
  initGroupMatches() {
    const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    groupLetters.forEach(letter => {
      const grpTeams = this.groups[letter];
      // 6 matches per group (Round Robin)
      // Round 1
      this.groupMatches.push({ id: `${letter}_1`, group: letter, home: grpTeams[0], away: grpTeams[1], played: false, score: null, events: [], redCards: [] });
      this.groupMatches.push({ id: `${letter}_2`, group: letter, home: grpTeams[2], away: grpTeams[3], played: false, score: null, events: [], redCards: [] });
      // Round 2
      this.groupMatches.push({ id: `${letter}_3`, group: letter, home: grpTeams[0], away: grpTeams[2], played: false, score: null, events: [], redCards: [] });
      this.groupMatches.push({ id: `${letter}_4`, group: letter, home: grpTeams[1], away: grpTeams[3], played: false, score: null, events: [], redCards: [] });
      // Round 3
      this.groupMatches.push({ id: `${letter}_5`, group: letter, home: grpTeams[0], away: grpTeams[3], played: false, score: null, events: [], redCards: [] });
      this.groupMatches.push({ id: `${letter}_6`, group: letter, home: grpTeams[1], away: grpTeams[2], played: false, score: null, events: [], redCards: [] });
    });

    // ─── RESULTADOS REALES FIJOS (Jornada 1 – 11 Junio 2026) ───────────────────
    this._applyFixedGroupResults();
  }

  // Pre-load real results so they are never overridden by simulation
  _applyFixedGroupResults() {
    // === JORNADA 1 ===
    // ── Grupo A ──
    this._applyFixedMatch("A_1", 2, 0, [
      { minute: 9, team: "home", scorer: "Julian Quinones", scorerId: "mex_julianquinones", assister: null, assisterId: null },
      { minute: 67, team: "home", scorer: "Raul Jimenez", scorerId: "mex_rauljimenez", assister: "Roberto Alvarado", assisterId: "mex_robertoalvarado" }
    ], [
      { minute: 49, team: "away", player: "Sphephelo Sithole", playerId: "rsa_sphephelosithole" },
      { minute: 84, team: "away", player: "Themba Zwane", playerId: "rsa_thembazwane" },
      { minute: 94, team: "home", player: "Cesar Montes", playerId: "mex_cesarmontes" }
    ]);

    this._applyFixedMatch("A_2", 2, 1, [
      { minute: 59, team: "away", scorer: "Ladislav Krejci", scorerId: "cze_ladislavkrejci", assister: "Vladimir Coufal", assisterId: "cze_vladimircoufal" },
      { minute: 67, team: "home", scorer: "Hwang Inbeom", scorerId: "kor_hwanginbeom", assister: null, assisterId: null },
      { minute: 80, team: "home", scorer: "Oh Hyeongyu", scorerId: "kor_ohhyeongyu", assister: "Hwang Inbeom", assisterId: "kor_hwanginbeom" }
    ]);

    // ── Grupo B ──
    this._applyFixedMatch("B_1", 1, 1, [
      { minute: 21, team: "away", scorer: "Jovo Lukic", scorerId: "bih_jovolukic", assister: "Sead Kolasinac", assisterId: "bih_seadkolasinac" },
      { minute: 78, team: "home", scorer: "Cyle Larin", scorerId: "can_cylelarin", assister: "Promise David", assisterId: "can_promisedavid" }
    ]);

    this._applyFixedMatch("B_2", 1, 1, [
      { minute: 17, team: "away", scorer: "Breel Embolo", scorerId: "sui_breelembolo", assister: null, assisterId: null },
      { minute: 94, team: "home", scorer: "Boualem Khoukhi", scorerId: "qat_boualemkhoukhi", assister: "Homam Ahmed", assisterId: "qat_homamahmed" }
    ]);

    // ── Grupo C ──
    this._applyFixedMatch("C_1", 1, 1, [
      { minute: 21, team: "away", scorer: "Ismael Saibari", scorerId: "mar_ismaelsaibari", assister: "Brahim Diaz", assisterId: "mar_brahimdiaz" },
      { minute: 32, team: "home", scorer: "Vinicius Junior", scorerId: "bra_viniciusjunior", assister: "Bruno Guimaraes", assisterId: "bra_brunoguimaraes" }
    ]);

    this._applyFixedMatch("C_2", 0, 1, [
      { minute: 29, team: "away", scorer: "John McGinn", scorerId: "sco_johnmcginn", assister: null, assisterId: null }
    ]);

    // ── Grupo D ──
    this._applyFixedMatch("D_1", 4, 1, [
      { minute: 7, team: "home", scorer: "Damian Bobadilla (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 31, team: "home", scorer: "Folarin Balogun", scorerId: "usa_folarinbalogun", assister: "Christian Pulisic", assisterId: "usa_christianpulisic" },
      { minute: 45, team: "home", scorer: "Folarin Balogun", scorerId: "usa_folarinbalogun", assister: "Malik Tillman", assisterId: "usa_maliktillman" },
      { minute: 73, team: "away", scorer: "Mauricio", scorerId: "pry_mauricio", assister: "Julio Enciso", assisterId: "pry_julioenciso" },
      { minute: 90, team: "home", scorer: "Giovanni Reyna", scorerId: "usa_giovannireyna", assister: "Alex Freeman", assisterId: "usa_alexfreeman" }
    ]);

    this._applyFixedMatch("D_2", 2, 0, [
      { minute: 27, team: "home", scorer: "Nestory Irankunda", scorerId: "aus_nestoryirankunda", assister: "Paul Okon-engstler", assisterId: "aus_paulokonengstler" },
      { minute: 75, team: "home", scorer: "Connor Metcalfe", scorerId: "aus_connormetcalfe", assister: null, assisterId: null }
    ]);

    // ── Grupo E ──
    this._applyFixedMatch("E_1", 7, 1, [
      { minute: 6, team: "home", scorer: "Felix Nmecha", scorerId: "ger_felixnmecha", assister: "Florian Wirtz", assisterId: "ger_florianwirtz" },
      { minute: 21, team: "away", scorer: "Livano Comenencia", scorerId: "cuw_livanocomenencia", assister: null, assisterId: null },
      { minute: 38, team: "home", scorer: "Nico Schlotterbeck", scorerId: "ger_nicoschlotterbeck", assister: null, assisterId: null },
      { minute: 45, team: "home", scorer: "Kai Havertz", scorerId: "ger_kaihavertz", assister: null, assisterId: null },
      { minute: 47, team: "home", scorer: "Jamal Musiala", scorerId: "ger_jamalmusiala", assister: null, assisterId: null },
      { minute: 68, team: "home", scorer: "Nathaniel Brown", scorerId: "ger_nathanielbrown", assister: null, assisterId: null },
      { minute: 78, team: "home", scorer: "Deniz Undav", scorerId: "ger_denizundav", assister: "Joshua Kimmich", assisterId: "ger_joshuakimmich" },
      { minute: 88, team: "home", scorer: "Kai Havertz", scorerId: "ger_kaihavertz", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("E_2", 1, 0, [
      { minute: 90, team: "home", scorer: "Amad Diallo", scorerId: "civ_amaddiallo", assister: "Wilfried Singo", assisterId: "civ_wilfriedsingo" }
    ]);

    // ── Grupo F ──
    this._applyFixedMatch("F_1", 2, 2, [
      { minute: 51, team: "home", scorer: "Virgil Van Dijk", scorerId: "ned_virgilvandijk", assister: "Ryan Gravenberch", assisterId: "ned_ryangravenberch" },
      { minute: 57, team: "away", scorer: "Keito Nakamura", scorerId: "jpn_keitonakamura", assister: null, assisterId: null },
      { minute: 64, team: "home", scorer: "Crysencio Summerville", scorerId: "ned_crysenciosummerville", assister: null, assisterId: null },
      { minute: 89, team: "away", scorer: "Daichi Kamada", scorerId: "jpn_daichikamada", assister: "Kento Shiogai", assisterId: "jpn_kentoshiogai" }
    ]);

    this._applyFixedMatch("F_2", 5, 1, [
      { minute: 7, team: "home", scorer: "Yasin Ayari", scorerId: "swe_yasinayari", assister: "Viktor Gyokeres", assisterId: "swe_viktorgyokeres" },
      { minute: 30, team: "home", scorer: "Alexander Isak", scorerId: "swe_alexanderisak", assister: null, assisterId: null },
      { minute: 43, team: "away", scorer: "Omar Rekik", scorerId: "tun_omarrekik", assister: "Hannibal Mejbri", assisterId: "tun_hannibalmejbri" },
      { minute: 59, team: "home", scorer: "Viktor Gyokeres", scorerId: "swe_viktorgyokeres", assister: "Alexander Isak", assisterId: "swe_alexanderisak" },
      { minute: 84, team: "home", scorer: "Mattias Svanberg", scorerId: "swe_mattiassvanberg", assister: "Alexander Isak", assisterId: "swe_alexanderisak" },
      { minute: 96, team: "home", scorer: "Yasin Ayari", scorerId: "swe_yasinayari", assister: "Lucas Bergvall", assisterId: "swe_lucasbergvall" }
    ]);

    // ── Grupo G ──
    this._applyFixedMatch("G_1", 1, 1, [
      { minute: 19, team: "away", scorer: "Emam Ashour", scorerId: "egy_emamashour", assister: "Mohamed Salah", assisterId: "egy_mohamedsalah" },
      { minute: 66, team: "home", scorer: "Mohamed Hany (Autogol)", scorerId: null, assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("G_2", 2, 2, [
      { minute: 7, team: "away", scorer: "Elijah Just", scorerId: "nzl_elijahjust", assister: "Chris Wood", assisterId: "nzl_chriswood" },
      { minute: 32, team: "home", scorer: "Ramin Rezaeian", scorerId: "irn_raminrezaeian", assister: null, assisterId: null },
      { minute: 54, team: "away", scorer: "Elijah Just", scorerId: "nzl_elijahjust", assister: "Chris Wood", assisterId: "nzl_chriswood" },
      { minute: 64, team: "home", scorer: "Mohammad Mohebbi", scorerId: "irn_mohammadmohebbi", assister: "Ramin Rezaeian", assisterId: "irn_raminrezaeian" }
    ]);

    // ── Grupo H ──
    this._applyFixedMatch("H_1", 0, 0, []);

    this._applyFixedMatch("H_2", 1, 1, [
      { minute: 41, team: "home", scorer: "Abdulelah Alamri", scorerId: "ksa_abdulelahalamri", assister: null, assisterId: null },
      { minute: 80, team: "away", scorer: "Maxi Araujo", scorerId: "uru_maxiaraujo", assister: null, assisterId: null }
    ]);

    // ── Grupo I ──
    this._applyFixedMatch("I_1", 3, 1, [
      { minute: 66, team: "home", scorer: "Kylian Mbappe", scorerId: "fra_kylianmbappe", assister: null, assisterId: null },
      { minute: 82, team: "home", scorer: "Bradley Barcola", scorerId: "fra_bradleybarcola", assister: null, assisterId: null },
      { minute: 90 + 5, team: "away", scorer: "Ibrahim Mbaye", scorerId: "sen_ibrahimmbaye", assister: null, assisterId: null },
      { minute: 90 + 6, team: "home", scorer: "Kylian Mbappe", scorerId: "fra_kylianmbappe", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("I_2", 1, 4, [
      { minute: 29, team: "away", scorer: "Erling Haaland", scorerId: "nor_erlinghaaland", assister: "David Moller Wolfe", assisterId: "nor_davidmollerwolfe" },
      { minute: 39, team: "home", scorer: "Aymen Hussein", scorerId: "irq_aymenhussein", assister: "Amir Alammari", assisterId: "irq_amiralammari" },
      { minute: 43, team: "away", scorer: "Erling Haaland", scorerId: "nor_erlinghaaland", assister: null, assisterId: null },
      { minute: 76, team: "away", scorer: "Leo Ostigard", scorerId: "nor_leoostigard", assister: null, assisterId: null },
      { minute: 90 + 6, team: "away", scorer: "Aymen Hussein (Autogol)", scorerId: null, assister: null, assisterId: null }
    ]);

    // ── Grupo J ──
    this._applyFixedMatch("J_1", 3, 0, [
      { minute: 16, team: "home", scorer: "Lionel Messi", scorerId: "arg_lionelmessi", assister: null, assisterId: null },
      { minute: 60, team: "home", scorer: "Lionel Messi", scorerId: "arg_lionelmessi", assister: null, assisterId: null },
      { minute: 76, team: "home", scorer: "Lionel Messi", scorerId: "arg_lionelmessi", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("J_2", 3, 1, [
      { minute: 21, team: "home", scorer: "Romano Schmid", scorerId: "aut_romanoschmid", assister: null, assisterId: null },
      { minute: 50, team: "away", scorer: "Ali Olwan", scorerId: "jor_aliolwan", assister: null, assisterId: null },
      { minute: 76, team: "home", scorer: "Yazan Alarab (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 90 + 12, team: "home", scorer: "Marko Arnautovic", scorerId: "aut_markoarnautovic", assister: null, assisterId: null }
    ]);

    // ── Grupo K ──
    this._applyFixedMatch("K_1", 1, 1, [
      { minute: 6, team: "home", scorer: "Joao Neves", scorerId: "ptg_joaoneves", assister: null, assisterId: null },
      { minute: 45 + 5, team: "away", scorer: "Yoane Wissa", scorerId: "cod_yoanewissa", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("K_2", 1, 3, [
      { minute: 40, team: "away", scorer: "Daniel Munoz", scorerId: "col_danielmunoz", assister: null, assisterId: null },
      { minute: 60, team: "home", scorer: "Abbosbek Fayzullaev", scorerId: "uzb_abbosbekfayzullaev", assister: null, assisterId: null },
      { minute: 65, team: "away", scorer: "Luis Diaz", scorerId: "col_luisdiaz", assister: null, assisterId: null },
      { minute: 90 + 9, team: "away", scorer: "Jaminton Campaz", scorerId: "col_jamintoncampaz", assister: null, assisterId: null }
    ]);

    // ── Grupo L ──
    this._applyFixedMatch("L_1", 4, 2, [
      { minute: 12, team: "home", scorer: "Harry Kane", scorerId: "eng_harrykane", assister: null, assisterId: null },
      { minute: 36, team: "away", scorer: "Martin Baturina", scorerId: "cro_martinbaturina", assister: null, assisterId: null },
      { minute: 39, team: "home", scorer: "Harry Kane", scorerId: "eng_harrykane", assister: null, assisterId: null },
      { minute: 45, team: "away", scorer: "Petar Musa", scorerId: "cro_petarmusa", assister: null, assisterId: null },
      { minute: 47, team: "home", scorer: "Jude Bellingham", scorerId: "eng_judebellingham", assister: null, assisterId: null },
      { minute: 85, team: "home", scorer: "Marcus Rashford", scorerId: "eng_marcusrashford", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("L_2", 1, 0, [
      { minute: 90 + 5, team: "home", scorer: "Caleb Yirenkyi", scorerId: "gha_calebyirenkyi", assister: null, assisterId: null }
    ]);


    // === JORNADA 2 ===
    // ── Grupo A ──
    this._applyFixedMatch("A_3", 1, 0, [
      { minute: 50, team: "home", scorer: "Luis Romo", scorerId: "mex_luisromo", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("A_4", 1, 1, [
      { minute: 6, team: "away", scorer: "Michal Sadilek", scorerId: "cze_michalsadilek", assister: null, assisterId: null },
      { minute: 83, team: "home", scorer: "Teboho Mokoena", scorerId: "rsa_tebohomokoena", assister: null, assisterId: null }
    ]);

    // ── Grupo B ──
    this._applyFixedMatch("B_3", 6, 0, [
      { minute: 15, team: "home", scorer: "Jonathan David", scorerId: "can_jonathandavid", assister: null, assisterId: null },
      { minute: 25, team: "home", scorer: "Cyle Larin", scorerId: "can_cylelarin", assister: null, assisterId: null },
      { minute: 40, team: "home", scorer: "Jonathan David", scorerId: "can_jonathandavid", assister: null, assisterId: null },
      { minute: 55, team: "home", scorer: "Catar (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 70, team: "home", scorer: "Jonathan David", scorerId: "can_jonathandavid", assister: null, assisterId: null },
      { minute: 85, team: "home", scorer: "Nathan Saliba", scorerId: "can_nathansaliba", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("B_4", 1, 4, [
      { minute: 74, team: "away", scorer: "Johan Manzambi", scorerId: "sui_johanmanzambi", assister: null, assisterId: null },
      { minute: 84, team: "away", scorer: "Ruben Vargas", scorerId: "sui_rubenvargas", assister: null, assisterId: null },
      { minute: 90, team: "away", scorer: "Johan Manzambi", scorerId: "sui_johanmanzambi", assister: null, assisterId: null },
      { minute: 90 + 3, team: "home", scorer: "Ermin Mahmic", scorerId: "bih_erminmahmic", assister: null, assisterId: null },
      { minute: 90 + 7, team: "away", scorer: "Granit Xhaka", scorerId: "sui_granitxhaka", assister: null, assisterId: null }
    ], [
      { minute: 80, team: "home", player: "Tarik Muharemovic", playerId: "bih_tarikmuharemovic" }
    ]);

    // ── Grupo C ──
    this._applyFixedMatch("C_3", 3, 0, [
      { minute: 23, team: "home", scorer: "Matheus Cunha", scorerId: "bra_matheuscunha", assister: null, assisterId: null },
      { minute: 36, team: "home", scorer: "Matheus Cunha", scorerId: "bra_matheuscunha", assister: null, assisterId: null },
      { minute: 45 + 3, team: "home", scorer: "Vinicius Junior", scorerId: "bra_viniciusjunior", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("C_4", 1, 0, [
      { minute: 2, team: "home", scorer: "Ismael Saibari", scorerId: "mar_ismaelsaibari", assister: null, assisterId: null }
    ]);

    // ── Grupo D ──
    this._applyFixedMatch("D_3", 2, 0, [
      { minute: 11, team: "home", scorer: "Cameron Burgess (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 43, team: "home", scorer: "Alex Freeman", scorerId: "usa_alexfreeman", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("D_4", 1, 0, [
      { minute: 1, team: "home", scorer: "Matias Galarza", scorerId: "pry_matiasgalarza", assister: null, assisterId: null }
    ]);

    // ── Grupo E ──
    this._applyFixedMatch("E_3", 2, 1, [
      { minute: 30, team: "away", scorer: "Franck Kessie", scorerId: "civ_franckkessie", assister: null, assisterId: null },
      { minute: 68, team: "home", scorer: "Deniz Undav", scorerId: "ger_denizundav", assister: null, assisterId: null },
      { minute: 90 + 4, team: "home", scorer: "Deniz Undav", scorerId: "ger_denizundav", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("E_4", 0, 0, []);

    // ── Grupo F ──
    this._applyFixedMatch("F_3", 5, 1, [
      { minute: 5, team: "home", scorer: "Brian Brobbey", scorerId: "ned_brianbrobbey", assister: null, assisterId: null },
      { minute: 17, team: "home", scorer: "Brian Brobbey", scorerId: "ned_brianbrobbey", assister: null, assisterId: null },
      { minute: 47, team: "home", scorer: "Cody Gakpo", scorerId: "ned_codygakpo", assister: null, assisterId: null },
      { minute: 54, team: "home", scorer: "Cody Gakpo", scorerId: "ned_codygakpo", assister: null, assisterId: null },
      { minute: 59, team: "away", scorer: "Anthony Elanga", scorerId: "swe_anthonyelanga", assister: null, assisterId: null },
      { minute: 89, team: "home", scorer: "Crysencio Summerville", scorerId: "ned_crysenciosummerville", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("F_4", 4, 0, [
      { minute: 4, team: "home", scorer: "Daichi Kamada", scorerId: "jpn_daichikamada", assister: null, assisterId: null },
      { minute: 31, team: "home", scorer: "Ayase Ueda", scorerId: "jpn_ayaseueda", assister: null, assisterId: null },
      { minute: 69, team: "home", scorer: "Junya Ito", scorerId: "jpn_junyaito", assister: null, assisterId: null },
      { minute: 83, team: "home", scorer: "Ayase Ueda", scorerId: "jpn_ayaseueda", assister: null, assisterId: null }
    ]);

    // ── Grupo H ──
    this._applyFixedMatch("H_3", 4, 0, [
      { minute: 10, team: "home", scorer: "Lamine Yamal", scorerId: "esp_lamineyamal", assister: "Mikel Oyarzabal", assisterId: "esp_mikeloyarzabal" },
      { minute: 21, team: "home", scorer: "Mikel Oyarzabal", scorerId: "esp_mikeloyarzabal", assister: "Aymeric Laporte", assisterId: "esp_aymericlaporte" },
      { minute: 24, team: "home", scorer: "Mikel Oyarzabal", scorerId: "esp_mikeloyarzabal", assister: "Dani Olmo", assisterId: "esp_daniolmo" },
      { minute: 49, team: "home", scorer: "Hassan Altambakti (Autogol)", scorerId: null, assister: null, assisterId: null }
    ]);

    // ── Grupo G Jornada 2 ──
    this._applyFixedMatch("G_3", 0, 0, [], [
      { minute: 66, team: "home", player: "Nathan Ngoy", playerId: "bel_nathanngoy" }
    ]);

    this._applyFixedMatch("G_4", 3, 1, [
      { minute: 15, team: "away", scorer: "Finn Surman", scorerId: "nzl_finnsurman", assister: null, assisterId: null },
      { minute: 59, team: "home", scorer: "Ziko", scorerId: "egy_mostafazico", assister: null, assisterId: null },
      { minute: 67, team: "home", scorer: "Mohamed Salah", scorerId: "egy_mohamedsalah", assister: null, assisterId: null },
      { minute: 82, team: "home", scorer: "Trezeguet", scorerId: "egy_trezeguet", assister: null, assisterId: null }
    ]);

    // ── Grupo H Jornada 2 ──
    this._applyFixedMatch("H_4", 2, 2, [
      { minute: 21, team: "home", scorer: "Kevin Pina", scorerId: "cpv_kevinpina", assister: null, assisterId: null },
      { minute: 44, team: "away", scorer: "Maximiliano Araujo", scorerId: "uru_maxiaraujo", assister: null, assisterId: null },
      { minute: 45 + 6, team: "away", scorer: "Agustin Canobbio", scorerId: "uru_agustincanobbio", assister: null, assisterId: null },
      { minute: 61, team: "home", scorer: "Helio Varela", scorerId: "cpv_heliovarela", assister: null, assisterId: null }
    ]);

    // ── Grupo I Jornada 2 ──
    this._applyFixedMatch("I_3", 3, 0, [
      { minute: 14, team: "home", scorer: "Kylian Mbappe", scorerId: "fra_kylianmbappe", assister: null, assisterId: null },
      { minute: 54, team: "home", scorer: "Kylian Mbappe", scorerId: "fra_kylianmbappe", assister: null, assisterId: null },
      { minute: 66, team: "home", scorer: "Ousmane Dembele", scorerId: "fra_ousmanedembele", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("I_4", 2, 3, [
      { minute: 43, team: "away", scorer: "Marcus Holmgren Pedersen", scorerId: "nor_marcusholmgrenpedersen", assister: null, assisterId: null },
      { minute: 48, team: "away", scorer: "Erling Haaland", scorerId: "nor_erlinghaaland", assister: null, assisterId: null },
      { minute: 53, team: "home", scorer: "Ismaila Sarr", scorerId: "sen_ismailasarr", assister: null, assisterId: null },
      { minute: 58, team: "away", scorer: "Erling Haaland", scorerId: "nor_erlinghaaland", assister: null, assisterId: null },
      { minute: 90 + 3, team: "home", scorer: "Ismaila Sarr", scorerId: "sen_ismailasarr", assister: null, assisterId: null }
    ]);

    // ── Grupo J Jornada 2 ──
    this._applyFixedMatch("J_3", 2, 0, [
      { minute: 38, team: "home", scorer: "Lionel Messi", scorerId: "arg_lionelmessi", assister: null, assisterId: null },
      { minute: 90 + 5, team: "home", scorer: "Lionel Messi", scorerId: "arg_lionelmessi", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("J_4", 2, 1, [
      { minute: 36, team: "away", scorer: "Nizar Alrashdan", scorerId: "jor_nizaralrashdan", assister: null, assisterId: null },
      { minute: 69, team: "home", scorer: "Nadhir Benbouali", scorerId: "alg_nadhirbenbouali", assister: null, assisterId: null },
      { minute: 82, team: "home", scorer: "Amine Gouiri", scorerId: "alg_aminegouiri", assister: null, assisterId: null }
    ]);

    // ── Grupo K Jornada 2 ──
    this._applyFixedMatch("K_3", 5, 0, [
      { minute: 6, team: "home", scorer: "Cristiano Ronaldo", scorerId: "ptg_cristianoronaldo", assister: null, assisterId: null },
      { minute: 17, team: "home", scorer: "Nuno Mendes", scorerId: "ptg_nunomendes", assister: null, assisterId: null },
      { minute: 39, team: "home", scorer: "Cristiano Ronaldo", scorerId: "ptg_cristianoronaldo", assister: null, assisterId: null },
      { minute: 60, team: "home", scorer: "Abdukodir Khusanov (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 87, team: "home", scorer: "Rafael Leao", scorerId: "ptg_rafaelleao", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("K_4", 0, 1, [
      { minute: 76, team: "away", scorer: "Daniel Munoz", scorerId: "col_danielmunoz", assister: null, assisterId: null }
    ]);

    // ── Grupo L Jornada 2 ──
    this._applyFixedMatch("L_3", 0, 0, []);

    this._applyFixedMatch("L_4", 1, 0, [
      { minute: 54, team: "home", scorer: "Ante Budimir", scorerId: "cro_antebudimir", assister: null, assisterId: null }
    ]);


    // === JORNADA 3 ===
    // ── Grupo A Jornada 3 ──
    this._applyFixedMatch("A_5", 3, 0, [
      { minute: 55, team: "home", scorer: "Mateo Chavez", scorerId: "mex_mateochavez", assister: null, assisterId: null },
      { minute: 61, team: "home", scorer: "Julian Quinones", scorerId: "mex_julianquinones", assister: null, assisterId: null },
      { minute: 90 + 4, team: "home", scorer: "Alvaro Fidalgo", scorerId: "mex_alvarofidalgo", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("A_6", 1, 0, [
      { minute: 63, team: "home", scorer: "Thapelo Maseko", scorerId: "rsa_thapelomaseko", assister: null, assisterId: null }
    ]);

    // ── Grupo B Jornada 3 ──
    this._applyFixedMatch("B_5", 1, 2, [
      { minute: 46, team: "away", scorer: "Ruben Vargas", scorerId: "sui_rubenvargas", assister: null, assisterId: null },
      { minute: 57, team: "away", scorer: "Johan Manzambi", scorerId: "sui_johanmanzambi", assister: null, assisterId: null },
      { minute: 76, team: "home", scorer: "Promise David", scorerId: "can_promisedavid", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("B_6", 3, 1, [
      { minute: 29, team: "home", scorer: "Kerim Alajbegovic", scorerId: "bih_kerimalajbegovic", assister: null, assisterId: null },
      { minute: 34, team: "home", scorer: "Mahmoud Abunada (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 42, team: "away", scorer: "Hassan Alhaydos", scorerId: "qat_hassanalhaydos", assister: null, assisterId: null },
      { minute: 82, team: "home", scorer: "Ermin Mahmic", scorerId: "bih_erminmahmic", assister: null, assisterId: null }
    ]);

    // ── Grupo C Jornada 3 ──
    this._applyFixedMatch("C_5", 3, 0, [
      { minute: 7, team: "home", scorer: "Vinicius Junior", scorerId: "bra_viniciusjunior", assister: null, assisterId: null },
      { minute: 45 + 3, team: "home", scorer: "Vinicius Junior", scorerId: "bra_viniciusjunior", assister: null, assisterId: null },
      { minute: 60, team: "home", scorer: "Matheus Cunha", scorerId: "bra_matheuscunha", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("C_6", 4, 2, [
      { minute: 10, team: "away", scorer: "Yassine Bounou (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 39, team: "home", scorer: "Achraf Hakimi", scorerId: "mar_achrafhakimi", assister: null, assisterId: null },
      { minute: 43, team: "away", scorer: "Wilson Isidor", scorerId: "hai_wilsonisidor", assister: null, assisterId: null },
      { minute: 45 + 1, team: "home", scorer: "Ismael Saibari", scorerId: "mar_ismaelsaibari", assister: null, assisterId: null },
      { minute: 78, team: "home", scorer: "Soufiane Rahimi", scorerId: "mar_soufianerahimi", assister: null, assisterId: null },
      { minute: 89, team: "home", scorer: "Gessime Yassine", scorerId: "mar_gessimeyassine", assister: null, assisterId: null }
    ]);

    // ── Grupo D Jornada 3 ──
    this._applyFixedMatch("D_5", 2, 3, [
      { minute: 3, team: "home", scorer: "Auston Trusty", scorerId: "usa_austontrusty", assister: null, assisterId: null },
      { minute: 10, team: "away", scorer: "Arda Guler", scorerId: "tur_ardaguler", assister: null, assisterId: null },
      { minute: 31, team: "away", scorer: "Orkun Kokcu", scorerId: "tur_orkunkokcu", assister: null, assisterId: null },
      { minute: 49, team: "home", scorer: "Sebastian Berhalter", scorerId: "usa_sebastianberhalter", assister: null, assisterId: null },
      { minute: 90 + 8, team: "away", scorer: "Kaan Ayhan", scorerId: "tur_kaanayhan", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("D_6", 0, 0, []);

    // ── Grupo E Jornada 3 ──
    this._applyFixedMatch("E_5", 1, 2, [
      { minute: 2, team: "home", scorer: "Leroy Sane", scorerId: "ger_leroysane", assister: null, assisterId: null },
      { minute: 9, team: "away", scorer: "Nilson Angulo", scorerId: "ecu_nilsonangulo", assister: null, assisterId: null },
      { minute: 77, team: "away", scorer: "Gonzalo Plata", scorerId: "ecu_gonzaloplata", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("E_6", 0, 2, [
      { minute: 7, team: "away", scorer: "Nicolas Pepe", scorerId: "civ_nicolaspepe", assister: null, assisterId: null },
      { minute: 64, team: "away", scorer: "Nicolas Pepe", scorerId: "civ_nicolaspepe", assister: null, assisterId: null }
    ]);

    // ── Grupo F Jornada 3 ──
    this._applyFixedMatch("F_5", 3, 1, [
      { minute: 3, team: "home", scorer: "Ellyes Skhiri (Autogol)", scorerId: null, assister: null, assisterId: null },
      { minute: 7, team: "home", scorer: "Brian Brobbey", scorerId: "ned_brianbrobbey", assister: null, assisterId: null },
      { minute: 54, team: "away", scorer: "Hazem Mastouri", scorerId: "tun_hazemmastouri", assister: null, assisterId: null },
      { minute: 63, team: "home", scorer: "Jan Paul Van Hecke", scorerId: "ned_janpaulvanhecke", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("F_6", 1, 1, [
      { minute: 56, team: "home", scorer: "Daizen Maeda", scorerId: "jpn_daizenmaeda", assister: null, assisterId: null },
      { minute: 62, team: "away", scorer: "Anthony Elanga", scorerId: "swe_anthonyelanga", assister: null, assisterId: null }
    ]);

    // ── Grupo G Jornada 3 ──
    this._applyFixedMatch("G_5", 5, 1, [
      { minute: 28, team: "home", scorer: "Leandro Trossard", scorerId: "bel_leandrotrossard", assister: null, assisterId: null },
      { minute: 50, team: "home", scorer: "Leandro Trossard", scorerId: "bel_leandrotrossard", assister: null, assisterId: null },
      { minute: 67, team: "home", scorer: "Kevin De Bruyne", scorerId: "bel_kevindebruyne", assister: null, assisterId: null },
      { minute: 84, team: "away", scorer: "Elijah Just", scorerId: "nzl_elijahjust", assister: null, assisterId: null },
      { minute: 86, team: "home", scorer: "Romelu Lukaku", scorerId: "bel_romelulukaku", assister: null, assisterId: null },
      { minute: 90 + 4, team: "home", scorer: "Alexis Saelemaekers", scorerId: "bel_alexissaelemaekers", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("G_6", 1, 1, [
      { minute: 5, team: "home", scorer: "Mahmoud Saber", scorerId: "egy_mahmoudsaber", assister: null, assisterId: null },
      { minute: 14, team: "away", scorer: "Ramin Rezaeian", scorerId: "irn_raminrezaeian", assister: null, assisterId: null }
    ]);

    // ── Grupo H Jornada 3 ──
    this._applyFixedMatch("H_5", 1, 0, [
      { minute: 42, team: "home", scorer: "Alex Baena", scorerId: "esp_alexbaena", assister: null, assisterId: null }
    ], [
      { minute: 90, team: "away", player: "Agustin Canobbio", playerId: "uru_agustincanobbio" }
    ]);

    this._applyFixedMatch("H_6", 0, 0, []);

    // ── Grupo I Jornada 3 ──
    this._applyFixedMatch("I_5", 4, 1, [
      { minute: 7, team: "home", scorer: "Ousmane Dembele", scorerId: "fra_ousmanedembele", assister: null, assisterId: null },
      { minute: 19, team: "home", scorer: "Ousmane Dembele", scorerId: "fra_ousmanedembele", assister: null, assisterId: null },
      { minute: 20, team: "away", scorer: "Thelo Aasgaard", scorerId: "nor_theloaasgaard", assister: null, assisterId: null },
      { minute: 31, team: "home", scorer: "Ousmane Dembele", scorerId: "fra_ousmanedembele", assister: null, assisterId: null },
      { minute: 90 + 3, team: "home", scorer: "Desire Doue", scorerId: "fra_desiredoue", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("I_6", 5, 0, [
      { minute: 4, team: "home", scorer: "Habib Diarra", scorerId: "sen_habibdiarra", assister: null, assisterId: null },
      { minute: 56, team: "home", scorer: "Ismaila Sarr", scorerId: "sen_ismailasarr", assister: null, assisterId: null },
      { minute: 59, team: "home", scorer: "Pape Gueye", scorerId: "sen_papegueye", assister: null, assisterId: null },
      { minute: 71, team: "home", scorer: "Pape Gueye", scorerId: "sen_papegueye", assister: null, assisterId: null },
      { minute: 82, team: "home", scorer: "Iliman Ndiaye", scorerId: "sen_ilimanndiaye", assister: null, assisterId: null }
    ], [
      { minute: 13, team: "away", player: "Rebin Sulaka", playerId: "irq_rebinsulaka" }
    ]);

    // ── Grupo J Jornada 3 ──
    this._applyFixedMatch("J_5", 3, 1, [
      { minute: 19, team: "home", scorer: "Giovani Lo Celso", scorerId: "arg_giovanilocelso", assister: null, assisterId: null },
      { minute: 31, team: "home", scorer: "Lautaro Martinez", scorerId: "arg_lautaromartinez", assister: null, assisterId: null },
      { minute: 55, team: "away", scorer: "Mousa Altamari", scorerId: "jor_mousaaltamari", assister: null, assisterId: null },
      { minute: 80, team: "home", scorer: "Lionel Messi", scorerId: "arg_lionelmessi", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("J_6", 3, 3, [
      { minute: 28, team: "away", scorer: "Marko Arnautovic", scorerId: "aut_markoarnautovic", assister: null, assisterId: null },
      { minute: 41, team: "home", scorer: "Rafik Belghali", scorerId: "alg_rafikbelghali", assister: null, assisterId: null },
      { minute: 55, team: "away", scorer: "Marcel Sabitzer", scorerId: "aut_marcelsabitzer", assister: null, assisterId: null },
      { minute: 60, team: "home", scorer: "Riyad Mahrez", scorerId: "alg_riyadmahrez", assister: null, assisterId: null },
      { minute: 90 + 3, team: "home", scorer: "Riyad Mahrez", scorerId: "alg_riyadmahrez", assister: null, assisterId: null },
      { minute: 90 + 5, team: "away", scorer: "Sasa Kalajdzic", scorerId: "aut_sasakalajdzic", assister: null, assisterId: null }
    ]);

    // ── Grupo K Jornada 3 ──
    this._applyFixedMatch("K_5", 0, 0, []);

    this._applyFixedMatch("K_6", 3, 1, [
      { minute: 10, team: "away", scorer: "Eldor Shomurodov", scorerId: "uzb_eldorshomurodov", assister: null, assisterId: null },
      { minute: 68, team: "home", scorer: "Yoane Wissa", scorerId: "cod_yoanewissa", assister: null, assisterId: null },
      { minute: 78, team: "home", scorer: "Fiston Mayele", scorerId: "cod_fistonmayele", assister: null, assisterId: null },
      { minute: 90 + 1, team: "home", scorer: "Yoane Wissa", scorerId: "cod_yoanewissa", assister: null, assisterId: null }
    ]);

    // ── Grupo L Jornada 3 ──
    this._applyFixedMatch("L_5", 2, 0, [
      { minute: 62, team: "home", scorer: "Jude Bellingham", scorerId: "eng_judebellingham", assister: null, assisterId: null },
      { minute: 67, team: "home", scorer: "Harry Kane", scorerId: "eng_harrykane", assister: null, assisterId: null }
    ]);

    this._applyFixedMatch("L_6", 2, 1, [
      { minute: 31, team: "home", scorer: "Petar Sucic", scorerId: "cro_petarsucic", assister: null, assisterId: null },
      { minute: 73, team: "away", scorer: "Derrick Luckassen", scorerId: "gha_derrickluckassen", assister: null, assisterId: null },
      { minute: 83, team: "home", scorer: "Nikola Vlasic", scorerId: "cro_nikolavlasic", assister: null, assisterId: null }
    ]);

    // Sort all groups standings after preloading results
    Object.keys(this.groups).forEach(letter => {
      this.groups[letter].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return 0; // Stable sort fallback (relative order preserved)
      });
    });
  }

  // Helper function to apply fixed match results and update standings/statistics
  _applyFixedMatch(matchId, homeScore, awayScore, events = [], redCards = []) {
    const match = this.groupMatches.find(m => m.id === matchId);
    if (!match) return;

    match.played = true;
    match.fixed = true;
    match.score = { home: homeScore, away: awayScore };
    match.events = events;
    match.redCards = redCards;

    const grp = this.groups[match.group];
    const grpHome = grp.find(t => t.id === match.home.id);
    const grpAway = grp.find(t => t.id === match.away.id);

    if (grpHome && grpAway) {
      grpHome.played += 1;
      grpAway.played += 1;
      grpHome.goalsFor += homeScore;
      grpHome.goalsAgainst += awayScore;
      grpAway.goalsFor += awayScore;
      grpAway.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        grpHome.won += 1;
        grpHome.points += 3;
        grpAway.lost += 1;
      } else if (homeScore < awayScore) {
        grpAway.won += 1;
        grpAway.points += 3;
        grpHome.lost += 1;
      } else {
        grpHome.drawn += 1;
        grpHome.points += 1;
        grpAway.drawn += 1;
        grpAway.points += 1;
      }
      grpHome.goalDifference = grpHome.goalsFor - grpHome.goalsAgainst;
      grpAway.goalDifference = grpAway.goalsFor - grpAway.goalsAgainst;
    }

    const homeTeam = this.findTeam(match.home.id);
    const awayTeam = this.findTeam(match.away.id);

    [homeTeam, awayTeam].forEach(team => {
      if (team) {
        team.squad.forEach(p => {
          if (!p.injured && this.playerStats[p.id]) {
            this.playerStats[p.id].matchesPlayed += 1;
          }
        });
      }
    });

    events.forEach(e => {
      if (e.scorerId && this.playerStats[e.scorerId]) {
        this.playerStats[e.scorerId].goals += 1;
      }
      if (e.assisterId && this.playerStats[e.assisterId]) {
        this.playerStats[e.assisterId].assists += 1;
      }
    });

    redCards.forEach(rc => {
      if (rc.playerId) {
        const player = [homeTeam, awayTeam]
          .filter(Boolean)
          .flatMap(t => t.squad)
          .find(p => p.id === rc.playerId);
        if (player) {
          player.suspended = true;
        }
      }
    });
  }
  // Find a team in the current state by ID
  findTeam(id) {
    return this.teams.find(t => t.id === id);
  }

  // Get active playing 11 for a match (1 GK, 4 DEF, 3 MED, 3 DEL, replacing injured/suspended starters with bench players)
  getPlayingLineup(team) {
    const starters = team.squad.filter(p => p.isStarter);
    // Suspended players are treated like injured: they cannot play
    const healthyStarters = starters.filter(p => !p.injured && !p.suspended);
    const unavailableStarters = starters.filter(p => p.injured || p.suspended);

    if (unavailableStarters.length === 0) {
      return starters;
    }

    const playing = [...healthyStarters];
    
    // Find bench players (not starter, not injured, not suspended)
    const bench = team.squad.filter(p => !p.isStarter && !p.injured && !p.suspended);
    
    // Sort bench by rating descending so we choose the best substitutes
    bench.sort((a, b) => b.rating - a.rating);

    for (const unavailablePlayer of unavailableStarters) {
      const pos = unavailablePlayer.position;
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
          // Fallback: use the unavailable player only if truly no one else is left
          if (!unavailablePlayer.suspended) playing.push(unavailablePlayer);
        }
      }
    }

    return playing;
  }

  // Clear suspensions for all squad members of a team after they have served their ban
  _clearSuspensions(teamId) {
    const team = this.findTeam(teamId);
    if (team) {
      team.squad.forEach(p => { p.suspended = false; });
    }
  }

  // Simulate a single match between two teams
  simulateMatch(teamA, teamB, isKnockout = false) {
    const suspendedBeforeA = teamA.squad.filter(p => p.suspended);
    const suspendedBeforeB = teamB.squad.filter(p => p.suspended);

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
        // Simulate shots on target based on opponent attack rating
        const shotsOnTarget = Math.max(numGoals, Math.floor((scoringTeam.attack / 22) + Math.random() * 4));
        const savesCount = Math.max(0, shotsOnTarget - numGoals);
        this.playerStats[gk.id].saves += savesCount;
      }

      for (let g = 0; g < numGoals; g++) {
        // 1. Goal Scorer selection
        // DEL: 65% odds, MED: 25%, DEF: 10%, POR: 0%
        let scorer = null;
        const roll = Math.random() * 100;
        let targetPosition = "DEL";
        if (roll > 65 && roll <= 90) targetPosition = "MED";
        else if (roll > 90) targetPosition = "DEF";

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

    // ── Simular Tarjetas Rojas ─────────────────────────────────────────────
    const redCards = [];
    const simulateLineupRedCards = (lineup, teamType) => {
      const outfield = lineup.filter(p => p.position !== "POR");
      const candidates = outfield.length > 0 ? outfield : lineup;
      if (Math.random() < 0.06 && candidates.length > 0) {
        const player = candidates[Math.floor(Math.random() * candidates.length)];
        player.suspended = true;
        const minute = Math.floor(Math.random() * 90) + 1;
        redCards.push({
          minute,
          team: teamType,
          player: player.name
        });
      }
    };
    simulateLineupRedCards(lineupA, "home");
    simulateLineupRedCards(lineupB, "away");

    // Limpiar suspensiones que existían ANTES del partido (ya cumplieron sanción)
    suspendedBeforeA.forEach(p => { p.suspended = false; });
    suspendedBeforeB.forEach(p => { p.suspended = false; });

    let result = {
      goalsA,
      goalsB,
      extraTime: false,
      penalties: false,
      penaltyScore: null,
      events,
      redCards,
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
          
          // Dynamic kicker ratings based on team stats
          const kickerRatingA = Math.round(statsA.attack * 0.6 + statsA.midfield * 0.4);
          const kickerRatingB = Math.round(statsB.attack * 0.6 + statsB.midfield * 0.4);

          // Probability of scoring a penalty: base 75%, modified by goalie rating vs kicker rating
          const gkA = lineupA.find(p => p.position === "POR");
          const gkB = lineupB.find(p => p.position === "POR");
          
          const getPenProb = (kickerRating, goalieRating) => {
            return 0.75 + (kickerRating - goalieRating) / 200;
          };

          // 5 kicks round-robin
          for (let i = 0; i < 5; i++) {
            if (Math.random() < getPenProb(kickerRatingA, gkB ? gkB.rating : 75)) penA++;
            if (Math.random() < getPenProb(kickerRatingB, gkA ? gkA.rating : 75)) penB++;
          }

          // Sudden death if draw
          let round = 5;
          while (penA === penB && round < 15) {
            if (Math.random() < getPenProb(kickerRatingA, gkB ? gkB.rating : 75)) penA++;
            if (Math.random() < getPenProb(kickerRatingB, gkA ? gkA.rating : 75)) penB++;
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
        m.redCards = res.redCards || [];
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
    const pairings = [
      // Lado Izquierdo (Top to Bottom)
      { home: "GER", away: "PRY" },
      { home: "FRA", away: "SWE" },
      { home: "RSA", away: "CAN" },
      { home: "NED", away: "MAR" },
      { home: "PTG", away: "CRO" },
      { home: "ESP", away: "AUT" },
      { home: "USA", away: "BIH" },
      { home: "BEL", away: "SEN" },

      // Lado Derecho (Top to Bottom)
      { home: "BRA", away: "JPN" },
      { home: "CIV", away: "NOR" },
      { home: "MEX", away: "ECU" },
      { home: "ENG", away: "COD" },
      { home: "ARG", away: "CPV" },
      { home: "AUS", away: "EGY" },
      { home: "SUI", away: "ALG" },
      { home: "COL", away: "GHA" }
    ];

    this.bracket.r32 = [];
    pairings.forEach((pair, idx) => {
      const homeTeam = this.findTeam(pair.home);
      const awayTeam = this.findTeam(pair.away);
      this.bracket.r32.push({
        id: `r32_${idx + 1}`,
        home: homeTeam,
        away: awayTeam,
        played: false,
        score: null,
        winner: null,
        details: null
      });
    });
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
    m.redCards = res.redCards || [];
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
    // Selected from players <= 21, sorting by weight of goals + assists + matches played, then rating
    const youngPlayers = statsList.filter(p => p.player.age <= 21);
    const topYoung = youngPlayers.sort((a, b) => {
      const scoreA = a.goals * 2.0 + a.assists * 1.2 + a.matchesPlayed * 0.5;
      const scoreB = b.goals * 2.0 + b.assists * 1.2 + b.matchesPlayed * 0.5;
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
