import { WorldCupSimulator, calculateActiveRatings } from "../simulator.js";

function runTests() {
  console.log("=== INICIANDO PRUEBAS DEL SIMULADOR DEL MUNDIAL ===");

  const sim = new WorldCupSimulator();

  // Test 1: Team & Injury calculation
  console.log("\n[Test 1] Verificando convocatoria y alineación 4-3-3...");
  
  // Verify rosters and starting lineups
  sim.teams.forEach(team => {
    if (team.squad.length < 15 || team.squad.length > 30) {
      throw new Error(`ERROR: La selección ${team.name} (${team.id}) no tiene un tamaño de plantilla válido (15 a 30 jugadores). Tiene: ${team.squad.length}`);
    }
    const starters = team.squad.filter(p => p.isStarter);
    if (starters.length !== 11) {
      throw new Error(`ERROR: La selección ${team.name} (${team.id}) no tiene exactamente 11 titulares. Tiene: ${starters.length}`);
    }
    const countPOR = starters.filter(p => p.position === "POR").length;
    const countDEF = starters.filter(p => p.position === "DEF").length;
    const countMED = starters.filter(p => p.position === "MED").length;
    const countDEL = starters.filter(p => p.position === "DEL").length;

    if (countPOR !== 1 || countDEF !== 4 || countMED !== 3 || countDEL !== 3) {
      throw new Error(`ERROR: La selección ${team.name} (${team.id}) no cumple con la formación 4-3-3. POR: ${countPOR}, DEF: ${countDEF}, MED: ${countMED}, DEL: ${countDEL}`);
    }
  });
  console.log("✓ Verificación de plantillas exitosa: 15 convocados y alineación 4-3-3 (1 POR, 4 DEF, 3 MED, 3 DEL) correctos para los 48 equipos.");

  console.log("\nVerificando cálculo de clasificaciones y lesiones...");
  const arg = sim.findTeam("ARG");
  
  const activeStatsBefore = calculateActiveRatings(arg);
  const initialOverall = activeStatsBefore.rating;
  const initialAttack = activeStatsBefore.attack;
  
  // Find Messi
  const messi = arg.squad.find(p => p.id === "arg_messi" || p.name.toLowerCase().includes("messi"));
  if (!messi) {
    throw new Error("ERROR: No se encontró a Messi en el plantel de Argentina.");
  }
  console.log(`Messi inicial - Estado: Lesionado = ${messi.injured}`);
  console.log(`Argentina inicial activa - Rating General: ${initialOverall}, Ataque: ${initialAttack}`);
  
  // Injure Messi
  messi.injured = true;
  const activeStatsWithMessiInjured = calculateActiveRatings(arg);
  console.log(`Messi lesionado - Rating General: ${activeStatsWithMessiInjured.rating}, Ataque: ${activeStatsWithMessiInjured.attack}`);
  
  if (activeStatsWithMessiInjured.rating >= initialOverall) {
    throw new Error("ERROR: El rating general de Argentina no disminuyó tras lesionarse su jugador clave (Messi).");
  }
  if (activeStatsWithMessiInjured.attack >= initialAttack) {
    throw new Error("ERROR: El rating de ataque de Argentina no disminuyó tras lesionarse su delantero clave (Messi).");
  }
  console.log("✓ Test 1 exitoso: Las lesiones reducen las estadísticas del equipo correctamente.");

  // Restore Messi
  messi.injured = false;

  // Test 2: Group Stage Simulation
  console.log("\n[Test 2] Verificando simulación de Fase de Grupos...");
  sim.simulateGroupStage();
  console.log(`Fase actual tras simular grupos: ${sim.currentPhase}`);
  
  // Verify standings counts
  let totalGroupsOk = true;
  const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  groupLetters.forEach(letter => {
    const grp = sim.groups[letter];
    if (grp.length !== 4) {
      totalGroupsOk = false;
      console.log(`✗ Error: El grupo ${letter} no tiene 4 equipos. Tiene: ${grp.length}`);
    }
    // Check if points are sorted in descending order
    for (let i = 0; i < 3; i++) {
      if (grp[i].points < grp[i+1].points) {
        totalGroupsOk = false;
        console.log(`✗ Error: El grupo ${letter} no está ordenado por puntos. Pos ${i}: ${grp[i].points} pts, Pos ${i+1}: ${grp[i+1].points} pts`);
      }
    }
  });

  if (totalGroupsOk) {
    console.log("✓ Test 2 exitoso: La fase de grupos se simula y se ordena correctamente.");
  } else {
    throw new Error("ERROR en la fase de grupos.");
  }

  // Test 3: Bracket progression
  console.log("\n[Test 3] Verificando progresión de eliminatorias...");
  console.log(`Partidos de Dieciseisavos de Final programados: ${sim.bracket.r32.length}`);
  if (sim.bracket.r32.length !== 16) {
    throw new Error("ERROR: Deberían haber 16 partidos de dieciseisavos.");
  }

  // Simulate R32
  sim.simulatePhase(); // currentPhase changes to "r16"
  console.log(`Fase actual tras simular R32: ${sim.currentPhase}`);
  console.log(`Partidos de Octavos de Final programados: ${sim.bracket.r16.length}`);
  if (sim.bracket.r16.length !== 8) {
    throw new Error("ERROR: Deberían haber 8 partidos de octavos.");
  }

  // Simulate R16
  sim.simulatePhase(); // currentPhase changes to "qf"
  console.log(`Fase actual tras simular R16: ${sim.currentPhase}`);
  console.log(`Partidos de Cuartos de Final programados: ${sim.bracket.qf.length}`);
  if (sim.bracket.qf.length !== 4) {
    throw new Error("ERROR: Deberían haber 4 partidos de cuartos.");
  }

  // Simulate QF
  sim.simulatePhase(); // currentPhase changes to "sf"
  console.log(`Fase actual tras simular QF: ${sim.currentPhase}`);
  console.log(`Partidos de Semifinal programados: ${sim.bracket.sf.length}`);
  if (sim.bracket.sf.length !== 2) {
    throw new Error("ERROR: Deberían haber 2 partidos de semifinales.");
  }

  // Simulate SF
  sim.simulatePhase(); // currentPhase changes to "third_final"
  console.log(`Fase actual tras simular SF: ${sim.currentPhase}`);
  
  // Simulate Finals
  sim.simulatePhase(); // currentPhase changes to "finished"
  console.log(`Fase actual tras simular Finales: ${sim.currentPhase}`);
  console.log(`Campeón: ${sim.champion ? sim.champion.name : "Ninguno"}`);
  console.log(`Tercer puesto: ${sim.thirdPlaceWinner ? sim.thirdPlaceWinner.name : "Ninguno"}`);

  if (!sim.champion || !sim.thirdPlaceWinner) {
    throw new Error("ERROR: El campeón o el tercer puesto no fueron calculados.");
  }
  console.log("✓ Test 3 exitoso: Las fases eliminatorias progresan y el campeón es coronado.");

  // Test 4: Awards
  console.log("\n[Test 4] Verificando premios del torneo...");
  const awards = sim.getAwards();
  console.log("Premios generados:");
  console.log(`- Bota de Oro (Goleador): ${awards.goldenBoot ? `${awards.goldenBoot.player.name} (${awards.goldenBoot.teamName}) con ${awards.goldenBoot.goals} goles` : "Ninguno"}`);
  console.log(`- Máximo Asistente: ${awards.goldenPlaymaker ? `${awards.goldenPlaymaker.player.name} (${awards.goldenPlaymaker.teamName}) con ${awards.goldenPlaymaker.assists} asistencias` : "Ninguno"}`);
  console.log(`- Mejor Joven: ${awards.goldenBoy ? `${awards.goldenBoy.player.name} (${awards.goldenBoy.teamName}) - edad ${awards.goldenBoy.player.age}` : "Ninguno"}`);
  console.log(`- Guante de Oro: ${awards.goldenGlove ? `${awards.goldenGlove.player.name} (${awards.goldenGlove.teamName}) con ${awards.goldenGlove.cleanSheets} vallas invictas y ${awards.goldenGlove.saves} atajadas` : "Ninguno"}`);

  if (!awards.goldenBoot || !awards.goldenPlaymaker || !awards.goldenBoy || !awards.goldenGlove) {
    throw new Error("ERROR: Faltan premios individuales.");
  }
  
  if (awards.goldenBoy.player.age > 21) {
    throw new Error(`ERROR: El Mejor Jugador Joven tiene ${awards.goldenBoy.player.age} años, superando el límite de 21.`);
  }

  console.log("✓ Test 4 exitoso: Los premios individuales son consistentes y válidos.");
  console.log("\n*** TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ***");
}

try {
  runTests();
  process.exit(0);
} catch (error) {
  console.error("\n✗ PRUEBA FALLIDA:", error.message);
  process.exit(1);
}
