import { WorldCupSimulator, calculateActiveRatings } from "./simulator.js";

// Instantiate the simulator
const sim = new WorldCupSimulator();
let activeTeamIdForModal = null;

// Player image cache to avoid redundant Wikipedia API calls
const playerImageCache = {};

// Fetch player profile image: official FIFA → Wikipedia → initials avatar
async function fetchPlayerImage(player, imgElement) {
  if (!player) return;
  const playerName = player.name;

  // 1. Use official FIFA photo if available
  if (player.photo) {
    imgElement.src = player.photo;
    imgElement.onerror = () => {
      imgElement.onerror = null;
      fetchWikipediaImage(playerName, imgElement);
    };
    return;
  }

  // 2. No official photo — try Wikipedia
  await fetchWikipediaImage(playerName, imgElement);
}

async function fetchWikipediaImage(playerName, imgElement) {
  // Show initials placeholder while loading
  imgElement.src = buildInitialsAvatar(playerName);

  if (playerImageCache[playerName]) {
    imgElement.src = playerImageCache[playerName];
    return;
  }

  try {
    // Try English Wikipedia first
    let url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(playerName)}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
    let res = await fetch(url);
    let data = await res.json();
    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];

    if (pageId && pageId !== '-1' && pages[pageId].thumbnail) {
      const src = pages[pageId].thumbnail.source;
      playerImageCache[playerName] = src;
      imgElement.src = src;
      return;
    }

    // Try Spanish Wikipedia as fallback
    url = `https://es.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(playerName)}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
    res = await fetch(url);
    data = await res.json();
    pages = data.query.pages;
    pageId = Object.keys(pages)[0];

    if (pageId && pageId !== '-1' && pages[pageId].thumbnail) {
      const src = pages[pageId].thumbnail.source;
      playerImageCache[playerName] = src;
      imgElement.src = src;
      return;
    }
  } catch (e) {
    // Silently fall through to initials avatar
  }

  // Final fallback: styled initials avatar
  playerImageCache[playerName] = buildInitialsAvatar(playerName);
}

function buildInitialsAvatar(name) {
  const initials = name
    .split(' ')
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0d1117&color=00e5ff&font-size=0.45&bold=true&length=2`;
}


// DOM Elements
const groupsContainer = document.getElementById("groups-container");
const btnReset = document.getElementById("btn-reset");
const btnNextPhase = document.getElementById("btn-next-phase");
const navBtnBracket = document.getElementById("nav-btn-bracket");

// Modals
const teamModal = document.getElementById("team-modal");
const teamModalClose = document.getElementById("team-modal-close");
const matchModal = document.getElementById("match-modal");
const matchModalClose = document.getElementById("match-modal-close");

// Celebration screen
const celebrationScreen = document.getElementById("celebration-screen");
const btnCelebrationClose = document.getElementById("btn-celebration-close");

// Slider
const sliderContainer = document.getElementById("sim-slider");
const sliderHandle = document.getElementById("slider-handle");
const sliderProgress = document.getElementById("slider-progress");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  setupTabNavigation();
  setupSliderInteraction();
  setupEventHandlers();
  
  // Initial render
  renderGroupStage();
  renderBracket();
  updateActionButtons();
});

// Setup Tab Navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Remove active class
      tabs.forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      // Set active
      tab.classList.add("active");
      const targetId = tab.dataset.tab;
      document.getElementById(targetId).classList.add("active");

      // Auto-scroll bracket to the active stage column when entering the bracket tab
      if (targetId === "tab-bracket") {
        setTimeout(highlightAndScrollActiveColumn, 100);
      }
    });
  });
}

// Setup Event Handlers
function setupEventHandlers() {
  // Close Modals
  teamModalClose.addEventListener("click", () => teamModal.classList.remove("active"));
  matchModalClose.addEventListener("click", () => matchModal.classList.remove("active"));
  
  window.addEventListener("click", (e) => {
    if (e.target === teamModal) teamModal.classList.remove("active");
    if (e.target === matchModal) matchModal.classList.remove("active");
  });

  // Action Buttons
  btnReset.addEventListener("click", () => {
    sim.reset();
    renderGroupStage();
    renderBracket();
    updateActionButtons();
    document.querySelector('[data-tab="tab-groups"]').click();
  });

  btnNextPhase.addEventListener("click", () => {
    if (sim.currentPhase === "finished") return;

    const prevPhase = sim.currentPhase;
    sim.simulatePhase();

    renderGroupStage();
    renderBracket();
    updateActionButtons();

    if (prevPhase === "groups" && sim.currentPhase !== "groups") {
      navBtnBracket.click();
    }

    if (sim.currentPhase === "finished") {
      showCelebration();
    }
  });

  btnCelebrationClose.addEventListener("click", () => {
    celebrationScreen.classList.remove("active");
    stopFireworks();
    sim.reset();
    renderGroupStage();
    renderBracket();
    updateActionButtons();
    document.querySelector('[data-tab="tab-groups"]').click();
  });
}

// Render Group Stage standings
function renderGroupStage() {
  groupsContainer.innerHTML = "";

  Object.keys(sim.groups).forEach(letter => {
    const groupCard = document.createElement("div");
    groupCard.className = "panel group-card";
    
    // Group Header
    const header = document.createElement("div");
    header.className = "group-header";
    
    const title = document.createElement("h3");
    title.className = "group-title";
    title.innerText = `GRUPO ${letter}`;
    
    const simGrpBtn = document.createElement("button");
    simGrpBtn.className = "sim-group-btn";
    simGrpBtn.innerText = "Simular Grupo";
    
    const grpMatches = sim.groupMatches.filter(m => m.group === letter);
    const allPlayed = grpMatches.every(m => m.played);
    if (allPlayed) {
      simGrpBtn.innerText = "Completado";
      simGrpBtn.disabled = true;
      simGrpBtn.style.opacity = "0.5";
      simGrpBtn.style.cursor = "default";
    }

    simGrpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      grpMatches.forEach(m => {
        if (!m.played) {
          const res = sim.simulateMatch(m.home, m.away, false);
          m.score = { home: res.goalsA, away: res.goalsB };
          m.events = res.events;
          m.played = true;

          const grp = sim.groups[letter];
          const teamH = grp.find(t => t.id === m.home.id);
          const teamA = grp.find(t => t.id === m.away.id);

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

      sim.groups[letter].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return Math.random() - 0.5;
      });

      const allGroupsFinished = sim.groupMatches.every(m => m.played);
      if (allGroupsFinished) {
        sim.currentPhase = "r16";
        sim.initRoundOf16();
      }

      renderGroupStage();
      renderBracket();
      updateActionButtons();
    });

    header.appendChild(title);
    header.appendChild(simGrpBtn);
    groupCard.appendChild(header);

    // Table structure
    const table = document.createElement("table");
    table.className = "group-table";
    
    table.innerHTML = `
      <thead>
        <tr>
          <th style="text-align: left;">Selección</th>
          <th title="Partidos Jugados">PJ</th>
          <th title="Goles">Goles</th>
          <th title="Diferencia de Goles">DG</th>
          <th title="Puntos">Pts</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    // Populate rows
    sim.groups[letter].forEach((team, index) => {
      const row = document.createElement("tr");
      if (index === 0) row.className = "qualify-1";
      if (index === 1) row.className = "qualify-2";

      const teamCell = document.createElement("td");
      teamCell.style.textAlign = "left";
      
      const teamDiv = document.createElement("div");
      teamDiv.className = "team-row";
      teamDiv.title = "Ver convocatoria y lesiones";
      teamDiv.innerHTML = `
        <img class="team-flag-icon" src="https://flagcdn.com/${team.flag}.svg" alt="${team.name}">
        <span class="team-badge">${team.id}</span>
        <span>${team.name}</span>
      `;
      teamDiv.addEventListener("click", () => openTeamModal(team.id));
      teamCell.appendChild(teamDiv);

      row.appendChild(teamCell);
      row.appendChild(createCell(team.played));
      row.appendChild(createCell(`${team.goalsFor}:${team.goalsAgainst}`));
      
      const dgCell = createCell(team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference);
      if (team.goalDifference > 0) dgCell.style.color = "var(--primary)";
      row.appendChild(dgCell);

      const ptsCell = createCell(team.points);
      ptsCell.style.fontWeight = "700";
      row.appendChild(ptsCell);

      tbody.appendChild(row);
    });

    groupCard.appendChild(table);
    
    // Matches drop list
    const matchesToggle = document.createElement("details");
    matchesToggle.style.marginTop = "0.75rem";
    matchesToggle.style.fontSize = "0.75rem";
    
    const summary = document.createElement("summary");
    summary.style.color = "var(--text-muted)";
    summary.style.cursor = "pointer";
    summary.innerText = "Ver resultados de partidos";
    matchesToggle.appendChild(summary);

    const matchMatchesList = document.createElement("div");
    matchMatchesList.style.display = "flex";
    matchMatchesList.style.flexDirection = "column";
    matchMatchesList.style.gap = "0.25rem";
    matchMatchesList.style.marginTop = "0.5rem";

    grpMatches.forEach(m => {
      const rowMatch = document.createElement("div");
      rowMatch.style.display = "flex";
      rowMatch.style.justifyContent = "space-between";
      rowMatch.style.padding = "0.25rem 0.5rem";
      rowMatch.style.background = "rgba(255,255,255,0.01)";
      rowMatch.style.borderRadius = "2px";
      rowMatch.style.cursor = m.played ? "pointer" : "default";
      
      if (m.played) {
        rowMatch.title = "Ver detalles del partido";
        rowMatch.addEventListener("click", () => openMatchModal(m, "Fase de Grupos - Grupo " + letter));
      }

      rowMatch.innerHTML = `
        <span style="font-weight: 500;">${m.home.name} vs ${m.away.name}</span>
        <span style="font-family: 'Outfit'; font-weight: 700;">${m.played ? `${m.score.home} - ${m.score.away}` : "vs"}</span>
      `;
      matchMatchesList.appendChild(rowMatch);
    });
    matchesToggle.appendChild(matchMatchesList);
    groupCard.appendChild(matchesToggle);

    groupsContainer.appendChild(groupCard);
  });
}

function createCell(text) {
  const td = document.createElement("td");
  td.innerText = text;
  return td;
}

// Render Bracket / Knockout
function renderBracket() {
  renderBracketColumn("bracket-r32", sim.bracket.r32, "r32");
  renderBracketColumn("bracket-r16", sim.bracket.r16, "r16");
  renderBracketColumn("bracket-qf", sim.bracket.qf, "qf");
  renderBracketColumn("bracket-sf", sim.bracket.sf, "sf");
  renderBracketFinals();

  // Highlight and scroll to the active column in the bracket grid
  highlightAndScrollActiveColumn();
}

// Highlight the active knockout stage column and scroll it into view dynamically
function highlightAndScrollActiveColumn() {
  const currentPhase = sim.currentPhase;
  
  // Clear any existing active classes from bracket columns
  const columns = document.querySelectorAll(".bracket-column");
  columns.forEach(col => {
    col.classList.remove("active-column-highlight");
  });

  let activeColId = null;
  if (currentPhase === "r32") activeColId = "col-r32";
  else if (currentPhase === "r16") activeColId = "col-r16";
  else if (currentPhase === "qf") activeColId = "col-qf";
  else if (currentPhase === "sf") activeColId = "col-sf";
  else if (currentPhase === "third_final") activeColId = "col-finals";

  if (activeColId) {
    const activeCol = document.getElementById(activeColId);
    if (activeCol) {
      activeCol.classList.add("active-column-highlight");
      
      // Scroll to the active column smoothly within the scroll container
      activeCol.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }
}

function renderBracketColumn(containerId, matches, phase) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (matches.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.style.color = "var(--text-muted)";
    placeholder.style.fontSize = "0.8rem";
    placeholder.style.textAlign = "center";
    placeholder.style.padding = "2rem 0";
    placeholder.innerText = "Por definir";
    container.appendChild(placeholder);
    return;
  }

  matches.forEach(m => {
    const card = document.createElement("div");
    card.className = `match-card ${m.played ? "played" : ""}`;
    
    // Team A row
    const teamARow = document.createElement("div");
    teamARow.className = `match-team ${m.played && m.winner === "home" ? "winner-side" : ""} ${m.played && m.winner === "away" ? "loser-side" : ""}`;
    
    const flagA = m.home ? `<img class="team-flag-icon" src="https://flagcdn.com/${m.home.flag}.svg" alt="${m.home.name}">` : "";
    teamARow.innerHTML = `
      <div class="match-team-info">
        ${flagA}
        <span class="team-badge">${m.home ? m.home.id : "?"}</span>
        <span>${m.home ? m.home.name : "Por definir"}</span>
      </div>
      <span class="match-score">${m.played ? m.score.home : ""}</span>
    `;
    if (m.home) {
      teamARow.querySelector(".match-team-info").addEventListener("click", (e) => {
        e.stopPropagation();
        openTeamModal(m.home.id);
      });
      if (!m.played && sim.currentPhase === phase) {
        teamARow.addEventListener("click", () => {
          sim.setManualWinner(phase, m.id, "home");
          renderBracket();
          checkPostManualAdvance();
        });
        teamARow.title = "Seleccionar manualmente como ganador";
      }
    }

    // Team B row
    const teamBRow = document.createElement("div");
    teamBRow.className = `match-team ${m.played && m.winner === "away" ? "winner-side" : ""} ${m.played && m.winner === "home" ? "loser-side" : ""}`;
    
    const flagB = m.away ? `<img class="team-flag-icon" src="https://flagcdn.com/${m.away.flag}.svg" alt="${m.away.name}">` : "";
    teamBRow.innerHTML = `
      <div class="match-team-info">
        ${flagB}
        <span class="team-badge">${m.away ? m.away.id : "?"}</span>
        <span>${m.away ? m.away.name : "Por definir"}</span>
      </div>
      <span class="match-score">${m.played ? m.score.away : ""}</span>
    `;
    if (m.away) {
      teamBRow.querySelector(".match-team-info").addEventListener("click", (e) => {
        e.stopPropagation();
        openTeamModal(m.away.id);
      });
      if (!m.played && sim.currentPhase === phase) {
        teamBRow.addEventListener("click", () => {
          sim.setManualWinner(phase, m.id, "away");
          renderBracket();
          checkPostManualAdvance();
        });
        teamBRow.title = "Seleccionar manualmente como ganador";
      }
    }

    card.appendChild(teamARow);
    card.appendChild(teamBRow);

    if (m.played) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => openMatchModal(m, getPhaseLabel(phase)));
      
      const statusText = document.createElement("div");
      statusText.className = "match-status";
      let statusStr = "Final";
      if (m.details && m.details.penalties) {
        statusStr = `Pen. (${m.details.penaltyScore.a}-${m.details.penaltyScore.b})`;
      } else if (m.details && m.details.extraTime) {
        statusStr = "Prórroga";
      }
      statusText.innerText = statusStr;
      card.appendChild(statusText);
    } else if (m.home && m.away && sim.currentPhase === phase) {
      const simMatchBtn = document.createElement("button");
      simMatchBtn.className = "match-btn-sim";
      simMatchBtn.innerText = "Simular";
      simMatchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sim.simulateKnockoutMatch(m);
        renderBracket();
        checkPostManualAdvance();
      });
      card.appendChild(simMatchBtn);
    }

    container.appendChild(card);
  });
}

function renderBracketFinals() {
  const container = document.getElementById("bracket-finals");
  container.innerHTML = "";

  const final = sim.bracket.final;
  const third = sim.bracket.third;

  if (!final) {
    const placeholder = document.createElement("div");
    placeholder.style.color = "var(--text-muted)";
    placeholder.style.fontSize = "0.8rem";
    placeholder.style.textAlign = "center";
    placeholder.style.padding = "2rem 0";
    placeholder.innerText = "Por definir";
    container.appendChild(placeholder);
    return;
  }

  // Render Third Place Match
  if (third) {
    const thirdTitle = document.createElement("div");
    thirdTitle.style.fontSize = "0.75rem";
    thirdTitle.style.fontWeight = "700";
    thirdTitle.style.color = "var(--text-muted)";
    thirdTitle.style.marginTop = "0.5rem";
    thirdTitle.style.textAlign = "center";
    thirdTitle.innerText = "Tercer Puesto";
    container.appendChild(thirdTitle);

    const m = third;
    const card = document.createElement("div");
    card.className = `match-card ${m.played ? "played" : ""}`;

    const teamARow = document.createElement("div");
    teamARow.className = `match-team ${m.played && m.winner === "home" ? "winner-side" : ""} ${m.played && m.winner === "away" ? "loser-side" : ""}`;
    teamARow.innerHTML = `
      <div class="match-team-info">
        <img class="team-flag-icon" src="https://flagcdn.com/${m.home.flag}.svg" alt="${m.home.name}">
        <span class="team-badge">${m.home.id}</span>
        <span>${m.home.name}</span>
      </div>
      <span class="match-score">${m.played ? m.score.home : ""}</span>
    `;
    teamARow.querySelector(".match-team-info").addEventListener("click", (e) => { e.stopPropagation(); openTeamModal(m.home.id); });
    if (!m.played && sim.currentPhase === "third_final") {
      teamARow.addEventListener("click", () => {
        sim.setManualWinner("third", m.id, "home");
        renderBracketFinals();
        checkPostManualAdvance();
      });
    }

    const teamBRow = document.createElement("div");
    teamBRow.className = `match-team ${m.played && m.winner === "away" ? "winner-side" : ""} ${m.played && m.winner === "home" ? "loser-side" : ""}`;
    teamBRow.innerHTML = `
      <div class="match-team-info">
        <img class="team-flag-icon" src="https://flagcdn.com/${m.away.flag}.svg" alt="${m.away.name}">
        <span class="team-badge">${m.away.id}</span>
        <span>${m.away.name}</span>
      </div>
      <span class="match-score">${m.played ? m.score.away : ""}</span>
    `;
    teamBRow.querySelector(".match-team-info").addEventListener("click", (e) => { e.stopPropagation(); openTeamModal(m.away.id); });
    if (!m.played && sim.currentPhase === "third_final") {
      teamBRow.addEventListener("click", () => {
        sim.setManualWinner("third", m.id, "away");
        renderBracketFinals();
        checkPostManualAdvance();
      });
    }

    card.appendChild(teamARow);
    card.appendChild(teamBRow);

    if (m.played) {
      card.addEventListener("click", () => openMatchModal(m, "Tercer Puesto"));
      const statusText = document.createElement("div");
      statusText.className = "match-status";
      statusText.innerText = m.details.penalties ? `Pen. (${m.details.penaltyScore.a}-${m.details.penaltyScore.b})` : "Final";
      card.appendChild(statusText);
    } else if (sim.currentPhase === "third_final") {
      const simMatchBtn = document.createElement("button");
      simMatchBtn.className = "match-btn-sim";
      simMatchBtn.innerText = "Simular";
      simMatchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sim.simulateKnockoutMatch(m);
        renderBracketFinals();
        checkPostManualAdvance();
      });
      card.appendChild(simMatchBtn);
    }
    container.appendChild(card);
  }

  // Render Grand Final Match
  {
    const finalTitle = document.createElement("div");
    finalTitle.style.fontSize = "0.75rem";
    finalTitle.style.fontWeight = "800";
    finalTitle.style.color = "var(--primary)";
    finalTitle.style.marginTop = "1rem";
    finalTitle.style.textAlign = "center";
    finalTitle.innerText = "GRAN FINAL";
    container.appendChild(finalTitle);

    const m = final;
    const card = document.createElement("div");
    card.className = `match-card ${m.played ? "played" : ""}`;
    card.style.borderColor = "var(--primary)";
    card.style.boxShadow = m.played ? "0 0 15px rgba(0, 255, 102, 0.15)" : "none";

    const teamARow = document.createElement("div");
    teamARow.className = `match-team ${m.played && m.winner === "home" ? "winner-side" : ""} ${m.played && m.winner === "away" ? "loser-side" : ""}`;
    teamARow.innerHTML = `
      <div class="match-team-info">
        <img class="team-flag-icon" src="https://flagcdn.com/${m.home.flag}.svg" alt="${m.home.name}">
        <span class="team-badge" style="color: var(--primary);">${m.home.id}</span>
        <span style="font-weight: 600;">${m.home.name}</span>
      </div>
      <span class="match-score">${m.played ? m.score.home : ""}</span>
    `;
    teamARow.querySelector(".match-team-info").addEventListener("click", (e) => { e.stopPropagation(); openTeamModal(m.home.id); });
    if (!m.played && sim.currentPhase === "third_final") {
      teamARow.addEventListener("click", () => {
        sim.setManualWinner("final", m.id, "home");
        renderBracketFinals();
        checkPostManualAdvance();
      });
    }

    const teamBRow = document.createElement("div");
    teamBRow.className = `match-team ${m.played && m.winner === "away" ? "winner-side" : ""} ${m.played && m.winner === "home" ? "loser-side" : ""}`;
    teamBRow.innerHTML = `
      <div class="match-team-info">
        <img class="team-flag-icon" src="https://flagcdn.com/${m.away.flag}.svg" alt="${m.away.name}">
        <span class="team-badge" style="color: var(--primary);">${m.away.id}</span>
        <span style="font-weight: 600;">${m.away.name}</span>
      </div>
      <span class="match-score">${m.played ? m.score.away : ""}</span>
    `;
    teamBRow.querySelector(".match-team-info").addEventListener("click", (e) => { e.stopPropagation(); openTeamModal(m.away.id); });
    if (!m.played && sim.currentPhase === "third_final") {
      teamBRow.addEventListener("click", () => {
        sim.setManualWinner("final", m.id, "away");
        renderBracketFinals();
        checkPostManualAdvance();
      });
    }

    card.appendChild(teamARow);
    card.appendChild(teamBRow);

    if (m.played) {
      card.addEventListener("click", () => openMatchModal(m, "Gran Final"));
      const statusText = document.createElement("div");
      statusText.className = "match-status";
      statusText.style.color = "var(--primary)";
      statusText.innerText = m.details.penalties ? `Pen. (${m.details.penaltyScore.a}-${m.details.penaltyScore.b})` : "Final";
      card.appendChild(statusText);
    } else if (sim.currentPhase === "third_final") {
      const simMatchBtn = document.createElement("button");
      simMatchBtn.className = "match-btn-sim";
      simMatchBtn.innerText = "Simular Final";
      simMatchBtn.style.borderColor = "var(--primary)";
      simMatchBtn.style.color = "var(--primary)";
      simMatchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sim.simulateKnockoutMatch(m);
        renderBracketFinals();
        checkPostManualAdvance();
      });
      card.appendChild(simMatchBtn);
    }
    container.appendChild(card);
  }
}

// After a manual advancement click, check if the phase needs progression
function checkPostManualAdvance() {
  const currentPhase = sim.currentPhase;
  let allMatchesPlayed = false;

  if (currentPhase === "r32") {
    allMatchesPlayed = sim.bracket.r32.every(m => m.played);
    if (allMatchesPlayed) {
      sim.currentPhase = "r16";
      sim.initRoundOf16();
    }
  } else if (currentPhase === "r16") {
    allMatchesPlayed = sim.bracket.r16.every(m => m.played);
    if (allMatchesPlayed) {
      sim.currentPhase = "qf";
      sim.initQuarterFinals();
    }
  } else if (currentPhase === "qf") {
    allMatchesPlayed = sim.bracket.qf.every(m => m.played);
    if (allMatchesPlayed) {
      sim.currentPhase = "sf";
      sim.initSemiFinals();
    }
  } else if (currentPhase === "sf") {
    allMatchesPlayed = sim.bracket.sf.every(m => m.played);
    if (allMatchesPlayed) {
      sim.currentPhase = "third_final";
      sim.initFinalAndThirdPlace();
    }
  } else if (currentPhase === "third_final") {
    allMatchesPlayed = sim.bracket.final.played && sim.bracket.third.played;
    if (allMatchesPlayed) {
      sim.champion = sim.bracket.final.winner === "home" ? sim.bracket.final.home : sim.bracket.final.away;
      sim.thirdPlaceWinner = sim.bracket.third.winner === "home" ? sim.bracket.third.home : sim.bracket.third.away;
      sim.currentPhase = "finished";
      showCelebration();
    }
  }

  renderBracket();
  updateActionButtons();
}

// Update Sim buttons state depending on phase
function updateActionButtons() {
  if (sim.currentPhase === "groups") {
    btnNextPhase.innerText = "Simular Fase de Grupos";
    btnNextPhase.disabled = false;
    btnNextPhase.style.opacity = "1";
  } else if (sim.currentPhase === "finished") {
    btnNextPhase.innerText = "Torneo Finalizado";
    btnNextPhase.disabled = true;
    btnNextPhase.style.opacity = "0.5";
  } else {
    btnNextPhase.innerText = `Simular ${getPhaseLabel(sim.currentPhase)}`;
    btnNextPhase.disabled = false;
    btnNextPhase.style.opacity = "1";
  }
}

function getPhaseLabel(phase) {
  if (phase === "r32") return "Dieciseisavos de Final";
  if (phase === "r16") return "Octavos de Final";
  if (phase === "qf") return "Cuartos de Final";
  if (phase === "sf") return "Semifinales";
  if (phase === "third_final") return "Finales";
  if (phase === "finished") return "Finalizado";
  return "Fase de Grupos";
}

// Open Team Squad & Stats Modal
let selectedPitchPlayerId = null;

function openTeamModal(teamId) {
  activeTeamIdForModal = teamId;
  const team = sim.findTeam(teamId);
  if (!team) return;

  selectedPitchPlayerId = null; // Reset selection

  // Header info
  document.getElementById("modal-team-flag").src = `https://flagcdn.com/${team.flag}.svg`;
  document.getElementById("modal-team-name").innerText = team.name;
  document.getElementById("modal-team-group").innerText = `GRUPO ${team.group}`;
  document.getElementById("modal-team-desc").innerText = team.description;

  // Render current ratings
  updateModalRatingsBars(team);
  renderTacticalPitch(team);
  renderSquadList(team);

  teamModal.classList.add("active");
}

// Render Starting Lineup on Tactical Pitch
function renderTacticalPitch(team) {
  const pitch = document.getElementById("modal-tactical-pitch");
  
  // Clear existing player nodes, keeping markings
  const players = pitch.querySelectorAll(".pitch-player");
  players.forEach(p => p.remove());

  // Starters list
  const starters = team.squad.filter(p => p.isStarter);

  let countPOR = 0;
  let countDEF = 0;
  let countMED = 0;
  let countDEL = 0;

  starters.forEach(player => {
    const node = document.createElement("div");
    node.className = `pitch-player ${selectedPitchPlayerId === player.id ? "selected" : ""} ${player.injured ? "injured-state" : ""}`;
    
    // Position on field (4-3-3 formation)
    let coords = { x: "50%", y: "50%" };
    if (player.position === "POR") {
      coords = { x: "50%", y: "88%" };
      countPOR++;
    } else if (player.position === "DEF") {
      const defPositions = [
        { x: "15%", y: "70%" }, // Lateral izquierdo
        { x: "38%", y: "73%" }, // Central izquierdo
        { x: "62%", y: "73%" }, // Central derecho
        { x: "85%", y: "70%" }  // Lateral derecho
      ];
      coords = defPositions[countDEF % defPositions.length];
      countDEF++;
    } else if (player.position === "MED") {
      const medPositions = [
        { x: "25%", y: "47%" }, // Volante izquierdo
        { x: "50%", y: "51%" }, // Volante central
        { x: "75%", y: "47%" }  // Volante derecho
      ];
      coords = medPositions[countMED % medPositions.length];
      countMED++;
    } else if (player.position === "DEL") {
      const delPositions = [
        { x: "20%", y: "22%" }, // Extremo izquierdo
        { x: "50%", y: "18%" }, // Delantero centro
        { x: "80%", y: "22%" }  // Extremo derecho
      ];
      coords = delPositions[countDEL % delPositions.length];
      countDEL++;
    }

    node.style.left = coords.x;
    node.style.top = coords.y;

    // Avatar image
    const avatarImg = document.createElement("img");
    avatarImg.className = "pitch-player-avatar";
    fetchPlayerImage(player, avatarImg);

    // Rating Badge overlay
    const ratingBadge = document.createElement("span");
    ratingBadge.className = "pitch-player-badge";
    ratingBadge.innerText = player.rating;

    // Name label
    const nameLabel = document.createElement("span");
    nameLabel.className = "pitch-player-name";
    nameLabel.innerText = player.name.split(" ").pop(); // Show last name to fit

    node.appendChild(avatarImg);
    node.appendChild(ratingBadge);
    node.appendChild(nameLabel);

    // Injury Badge overlay (premium SVG)
    if (player.injured) {
      const injuryBadge = document.createElement("span");
      injuryBadge.className = "pitch-player-injury-badge";
      injuryBadge.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px; display: block;">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      `;
      node.appendChild(injuryBadge);
    }

    // Event listener to select for substitution
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selectedPitchPlayerId === player.id) {
        selectedPitchPlayerId = null;
      } else {
        selectedPitchPlayerId = player.id;
      }
      renderTacticalPitch(team);
      renderSquadList(team);
    });

    pitch.appendChild(node);
  });
}

// Render Squad List & Substitutes Action
function renderSquadList(team) {
  const listContainer = document.getElementById("modal-player-list");
  listContainer.innerHTML = "";

  team.squad.forEach(player => {
    const card = document.createElement("div");
    card.className = `player-card ${player.injured ? "injured-state" : ""}`;
    card.id = `player-card-${player.id}`;

    // Left info
    const infoLeft = document.createElement("div");
    infoLeft.className = "player-info-left";

    // Player Face Avatar dynamically loaded from Wikipedia
    const avatarImg = document.createElement("img");
    avatarImg.className = "player-avatar";
    fetchPlayerImage(player, avatarImg);
    
    const posTag = document.createElement("span");
    posTag.className = `player-pos-tag pos-${player.position}`;
    posTag.innerText = player.position;
    
    // Check starter status tag
    const roleTag = player.isStarter 
      ? `<span style="font-size:0.65rem; color:#10b981; font-weight:800; border: 1px solid #10b981; padding: 0.1rem 0.3rem; border-radius: 2px; text-transform: uppercase;">Titular</span>`
      : `<span style="font-size:0.65rem; color:var(--text-muted); font-weight:700; border: 1px solid var(--glass-border); padding: 0.1rem 0.3rem; border-radius: 2px; text-transform: uppercase;">Suplente</span>`;

    const starIcon = player.isKey 
      ? `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 13px; height: 13px; color: #f59e0b; margin-left: 4px; display: inline-block; vertical-align: -1px;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`
      : '';

    const infoText = document.createElement("div");
    infoText.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="player-name">${player.name}${starIcon}</span>
        ${roleTag}
      </div>
      <div class="player-meta">EDAD: ${player.age} | RATING: ${player.rating}</div>
    `;

    infoLeft.appendChild(avatarImg);
    infoLeft.appendChild(posTag);
    infoLeft.appendChild(infoText);

    // Right elements (swap button + toggle)
    const actionArea = document.createElement("div");
    actionArea.style.display = "flex";
    actionArea.style.alignItems = "center";
    actionArea.style.gap = "1rem";

    // Swap / Substitution control
    if (selectedPitchPlayerId !== null) {
      // Find the selected player from the pitch
      const pitchPlayer = team.squad.find(p => p.id === selectedPitchPlayerId);
      
      if (pitchPlayer && !player.isStarter) {
        // If this player in the list is a bench player and same position, show "Sustituir"
        const btnSubstitute = document.createElement("button");
        if (player.position === pitchPlayer.position) {
          btnSubstitute.className = "btn-substitute";
          btnSubstitute.innerText = "Sustituir";
          btnSubstitute.addEventListener("click", (e) => {
            e.stopPropagation();
            
            // Swap starter status
            const temp = player.isStarter;
            player.isStarter = pitchPlayer.isStarter;
            pitchPlayer.isStarter = temp;
            
            selectedPitchPlayerId = null; // Clear selection
            
            // Refresh
            updateModalRatingsBars(team);
            renderTacticalPitch(team);
            renderSquadList(team);
            renderGroupStage();
            renderBracket();
            
            // Save to LocalStorage
            sim.saveSquadsToLocalStorage();
          });
        } else {
          btnSubstitute.className = "btn-substitute disabled";
          btnSubstitute.disabled = true;
          btnSubstitute.innerText = "Pos. distinta";
        }
        actionArea.appendChild(btnSubstitute);
      }
    } else {
      // Normal state: native select styled as a button
      const selectSwap = document.createElement("select");
      selectSwap.className = "btn-swap";
      selectSwap.title = "Cambiar jugador de la alineación";

      const defOpt = document.createElement("option");
      defOpt.innerText = "Cambiar";
      defOpt.value = "";
      defOpt.disabled = true;
      defOpt.selected = true;
      defOpt.hidden = true;
      selectSwap.appendChild(defOpt);

      // Candidates are of the SAME position, but OPPOSITE starter status
      const candidates = team.squad.filter(p => p.position === player.position && p.isStarter !== player.isStarter);
      candidates.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.innerText = `${c.name} (${c.rating})`;
        selectSwap.appendChild(opt);
      });

      selectSwap.addEventListener("change", (e) => {
        e.stopPropagation();
        const targetId = selectSwap.value;
        if (targetId) {
          const targetPlayer = team.squad.find(p => p.id === targetId);
          if (targetPlayer) {
            // Swap positions
            const temp = player.isStarter;
            player.isStarter = targetPlayer.isStarter;
            targetPlayer.isStarter = temp;
            
            selectedPitchPlayerId = null;
            
            // Refresh details and tables
            updateModalRatingsBars(team);
            renderTacticalPitch(team);
            renderSquadList(team);
            renderGroupStage();
            renderBracket();

            // Save to LocalStorage
            sim.saveSquadsToLocalStorage();
          }
        }
        // Reset select value to placeholder
        selectSwap.value = "";
      });

      actionArea.appendChild(selectSwap);
    }

    // Right toggle switch
    const toggleArea = document.createElement("div");
    toggleArea.className = "player-injury-toggle";

    const labelSwitch = document.createElement("label");
    labelSwitch.className = "switch";
    
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = player.injured;
    
    const sliderSpan = document.createElement("span");
    sliderSpan.className = "slider-switch";

    labelSwitch.appendChild(input);
    labelSwitch.appendChild(sliderSpan);

    const injuryLabel = document.createElement("span");
    injuryLabel.className = "injury-label";
    injuryLabel.innerText = player.injured ? "Lesionado" : "Activo";

    toggleArea.appendChild(labelSwitch);
    toggleArea.appendChild(injuryLabel);

    actionArea.appendChild(toggleArea);

    card.appendChild(infoLeft);
    card.appendChild(actionArea);

    input.addEventListener("change", (e) => {
      const isInjured = e.target.checked;
      player.injured = isInjured;
      
      if (isInjured) {
        card.classList.add("injured-state");
        injuryLabel.innerText = "Lesionado";
      } else {
        card.classList.remove("injured-state");
        injuryLabel.innerText = "Activo";
      }

      updateModalRatingsBars(team);
      renderTacticalPitch(team);
      renderSquadList(team);
      renderGroupStage();

      // Save to LocalStorage
      sim.saveSquadsToLocalStorage();
    });

    listContainer.appendChild(card);
  });
}

// Update progress bars in modal based on live active ratings calculation
function updateModalRatingsBars(team) {
  const activeStats = calculateActiveRatings(team);

  // Set text values
  document.getElementById("stat-val-overall").innerText = activeStats.rating;
  document.getElementById("stat-val-attack").innerText = activeStats.attack;
  document.getElementById("stat-val-midfield").innerText = activeStats.midfield;
  document.getElementById("stat-val-defense").innerText = activeStats.defense;

  // Set bar widths
  document.getElementById("stat-bar-overall").style.width = `${activeStats.rating}%`;
  document.getElementById("stat-bar-attack").style.width = `${activeStats.attack}%`;
  document.getElementById("stat-bar-midfield").style.width = `${activeStats.midfield}%`;
  document.getElementById("stat-bar-defense").style.width = `${activeStats.defense}%`;

  const compareAndColor = (elementId, activeVal, baseVal) => {
    const el = document.getElementById(elementId);
    if (activeVal < baseVal) {
      el.style.color = "var(--primary)";
      el.innerText = `${activeVal} (-${baseVal - activeVal})`;
    } else {
      el.style.color = "white";
    }
  };

  compareAndColor("stat-val-overall", activeStats.rating, team.rating);
  compareAndColor("stat-val-attack", activeStats.attack, team.attack);
  compareAndColor("stat-val-midfield", activeStats.midfield, team.midfield);
  compareAndColor("stat-val-defense", activeStats.defense, team.defense);
}

// Open Match Detail Modal
function openMatchModal(m, phaseName) {
  document.getElementById("match-modal-title").innerText = phaseName;
  document.getElementById("match-modal-home-flag").src = `https://flagcdn.com/${m.home.flag}.svg`;
  document.getElementById("match-modal-home-name").innerText = m.home.name;
  document.getElementById("match-modal-away-flag").src = `https://flagcdn.com/${m.away.flag}.svg`;
  document.getElementById("match-modal-away-name").innerText = m.away.name;
  document.getElementById("match-modal-score").innerText = `${m.score.home} - ${m.score.away}`;

  const extraDetails = document.getElementById("match-modal-extra");
  extraDetails.innerHTML = "";
  if (m.details && m.details.penalties) {
    extraDetails.innerText = `PENALTIES: ${m.details.penaltyScore.a} - ${m.details.penaltyScore.b}`;
  } else if (m.details && m.details.extraTime) {
    extraDetails.innerText = "PRÓRROGA JUGADA";
  }

  // Populate events list
  const eventsList = document.getElementById("match-modal-events");
  eventsList.innerHTML = "";

  if (m.details && m.details.events && m.details.events.length > 0) {
    m.details.events.forEach(ev => {
      const item = document.createElement("div");
      item.className = "event-item";
      item.innerHTML = `
        <div class="event-minute">${ev.minute}'</div>
        <div class="event-detail">
          <div style="font-weight:700;">Gol de ${ev.scorer}</div>
          ${ev.assister ? `<div class="event-assister">Asistencia: ${ev.assister}</div>` : ""}
        </div>
      `;
      eventsList.appendChild(item);
    });
  } else {
    const emptyMsg = document.createElement("div");
    emptyMsg.style.color = "var(--text-muted)";
    emptyMsg.style.fontSize = "0.85rem";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.padding = "1.5rem 0";
    emptyMsg.innerText = "No se registraron detalles del partido.";
    eventsList.appendChild(emptyMsg);
  }

  matchModal.classList.add("active");
}

// Slide-to-Simulate Lock Slider
let isDraggingSlider = false;
let startX = 0;
let handleLeft = 0;

function setupSliderInteraction() {
  const handleWidth = 36;
  
  const getClientX = (e) => {
    return e.touches ? e.touches[0].clientX : e.clientX;
  };

  const startDrag = (e) => {
    if (sim.currentPhase === "finished") return;
    isDraggingSlider = true;
    startX = getClientX(e);
    handleLeft = sliderHandle.offsetLeft;
    sliderHandle.style.transition = "none";
    sliderProgress.style.transition = "none";
  };

  const moveDrag = (e) => {
    if (!isDraggingSlider) return;
    const currentX = getClientX(e);
    const deltaX = currentX - startX;
    
    const maxDrag = sliderContainer.clientWidth - handleWidth - 4;
    let newLeft = Math.max(2, Math.min(maxDrag, handleLeft + deltaX));
    
    sliderHandle.style.left = `${newLeft}px`;
    
    const progressWidth = newLeft + (handleWidth / 2);
    sliderProgress.style.width = `${progressWidth}px`;

    if (newLeft >= maxDrag - 3) {
      triggerQuickFullSimulation();
      endDrag();
    }
  };

  const endDrag = () => {
    if (!isDraggingSlider) return;
    isDraggingSlider = false;
    
    sliderHandle.style.transition = "left 0.25s ease-out";
    sliderProgress.style.transition = "width 0.25s ease-out";
    
    sliderHandle.style.left = "2px";
    sliderProgress.style.width = "20px";
  };

  sliderHandle.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", moveDrag);
  window.addEventListener("mouseup", endDrag);

  sliderHandle.addEventListener("touchstart", startDrag);
  window.addEventListener("touchmove", moveDrag);
  window.addEventListener("touchend", endDrag);
}

// Run the full simulation instantly
function triggerQuickFullSimulation() {
  if (sim.currentPhase === "finished") return;
  sim.simulateAll();
  
  renderGroupStage();
  renderBracket();
  updateActionButtons();
  
  showCelebration();
}

// Celebrate champion!
function showCelebration() {
  const awards = sim.getAwards();
  
  // Champion name and flag
  document.getElementById("celebration-champion").innerText = sim.champion.name.toUpperCase();
  document.getElementById("celebration-champion-flag").src = `https://flagcdn.com/${sim.champion.flag}.svg`;
  
  // Golden Boot (Scorer)
  const bootName = document.getElementById("award-boot-name");
  const bootTeam = document.getElementById("award-boot-team");
  const bootStat = document.getElementById("award-boot-stat");
  const bootAvatar = document.getElementById("award-boot-avatar");
  const bootFlag = document.getElementById("award-boot-flag");
  
  if (awards.goldenBoot) {
    bootName.innerText = awards.goldenBoot.player.name;
    bootTeam.innerText = awards.goldenBoot.teamName;
    bootStat.innerHTML = `${awards.goldenBoot.goals} <span class="award-stat-label">goles</span>`;
    fetchPlayerImage(awards.goldenBoot.player, bootAvatar);
    
    const teamObj = sim.findTeam(awards.goldenBoot.teamId);
    bootFlag.src = `https://flagcdn.com/${teamObj.flag}.svg`;
    bootFlag.classList.remove("hidden");
  } else {
    bootName.innerText = "Por determinar";
    bootTeam.innerText = "-";
    bootStat.innerHTML = `0`;
    bootAvatar.src = "https://ui-avatars.com/api/?name=Boot&background=111111&color=888888";
    bootFlag.classList.add("hidden");
  }

  // Golden Playmaker (Assists)
  const pmName = document.getElementById("award-playmaker-name");
  const pmTeam = document.getElementById("award-playmaker-team");
  const pmStat = document.getElementById("award-playmaker-stat");
  const pmAvatar = document.getElementById("award-playmaker-avatar");
  const pmFlag = document.getElementById("award-playmaker-flag");
  
  if (awards.goldenPlaymaker) {
    pmName.innerText = awards.goldenPlaymaker.player.name;
    pmTeam.innerText = awards.goldenPlaymaker.teamName;
    pmStat.innerHTML = `${awards.goldenPlaymaker.assists} <span class="award-stat-label">asistencias</span>`;
    fetchPlayerImage(awards.goldenPlaymaker.player, pmAvatar);
    
    const teamObj = sim.findTeam(awards.goldenPlaymaker.teamId);
    pmFlag.src = `https://flagcdn.com/${teamObj.flag}.svg`;
    pmFlag.classList.remove("hidden");
  } else {
    pmName.innerText = "Por determinar";
    pmTeam.innerText = "-";
    pmStat.innerHTML = `0`;
    pmAvatar.src = "https://ui-avatars.com/api/?name=Play&background=111111&color=888888";
    pmFlag.classList.add("hidden");
  }

  // Golden Boy (Young Player)
  const boyName = document.getElementById("award-boy-name");
  const boyTeam = document.getElementById("award-boy-team");
  const boyStat = document.getElementById("award-boy-stat");
  const boyAvatar = document.getElementById("award-boy-avatar");
  const boyFlag = document.getElementById("award-boy-flag");
  
  if (awards.goldenBoy) {
    boyName.innerText = awards.goldenBoy.player.name;
    boyTeam.innerText = awards.goldenBoy.teamName;
    boyStat.innerHTML = `${awards.goldenBoy.player.age} <span class="award-stat-label">años</span>`;
    fetchPlayerImage(awards.goldenBoy.player, boyAvatar);
    
    const teamObj = sim.findTeam(awards.goldenBoy.teamId);
    boyFlag.src = `https://flagcdn.com/${teamObj.flag}.svg`;
    boyFlag.classList.remove("hidden");
  } else {
    boyName.innerText = "Por determinar";
    boyTeam.innerText = "-";
    boyStat.innerHTML = `-`;
    boyAvatar.src = "https://ui-avatars.com/api/?name=Boy&background=111111&color=888888";
    boyFlag.classList.add("hidden");
  }

  // Golden Glove (Goalkeeper)
  const gloveName = document.getElementById("award-glove-name");
  const gloveTeam = document.getElementById("award-glove-team");
  const gloveStat = document.getElementById("award-glove-stat");
  const gloveAvatar = document.getElementById("award-glove-avatar");
  const gloveFlag = document.getElementById("award-glove-flag");
  
  if (awards.goldenGlove) {
    gloveName.innerText = awards.goldenGlove.player.name;
    gloveTeam.innerText = awards.goldenGlove.teamName;
    gloveStat.innerHTML = `${awards.goldenGlove.cleanSheets} <span class="award-stat-label">vallas invictas</span>`;
    fetchPlayerImage(awards.goldenGlove.player, gloveAvatar);
    
    const teamObj = sim.findTeam(awards.goldenGlove.teamId);
    gloveFlag.src = `https://flagcdn.com/${teamObj.flag}.svg`;
    gloveFlag.classList.remove("hidden");
  } else {
    gloveName.innerText = "Por determinar";
    gloveTeam.innerText = "-";
    gloveStat.innerHTML = `0`;
    gloveAvatar.src = "https://ui-avatars.com/api/?name=Glove&background=111111&color=888888";
    gloveFlag.classList.add("hidden");
  }

  celebrationScreen.classList.add("active");
  startFireworks();
}

// Canvas Firework Particles System
let fireworksCanvas = null;
let ctx = null;
let particles = [];

function startFireworks() {
  fireworksCanvas = document.getElementById("canvas-fireworks");
  ctx = fireworksCanvas.getContext("2d");
  
  const resizeCanvas = () => {
    fireworksCanvas.width = celebrationScreen.clientWidth;
    fireworksCanvas.height = celebrationScreen.clientHeight;
  };
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  particles = [];
  
  const drawLoop = () => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    
    if (Math.random() < 0.04) {
      createFireworkExplosion(
        Math.random() * fireworksCanvas.width,
        Math.random() * (fireworksCanvas.height * 0.6) + 80
      );
    }

    particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.fade;
      
      if (p.alpha <= 0) {
        particles.splice(idx, 1);
      } else {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    if (celebrationScreen.classList.contains("active")) {
      requestAnimationFrame(drawLoop);
    }
  };

  requestAnimationFrame(drawLoop);
}

function createFireworkExplosion(x, y) {
  const count = 50 + Math.floor(Math.random() * 30);
  // Theme compliant pure white and pure green particles!
  const colors = ["#00ff66", "#ffffff", "#00ff66", "#ffffff", "#22c55e"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.08,
      alpha: 1,
      fade: Math.random() * 0.015 + 0.012,
      size: Math.random() * 2 + 1,
      color: color
    });
  }
}

function stopFireworks() {
  particles = [];
  if (ctx) {
    ctx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
  }
}
