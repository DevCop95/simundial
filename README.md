# Mundial Simulator 2026 — Edición Profesional

Un simulador interactivo y premium de la Copa Mundial de la FIFA 2026, diseñado con una experiencia de usuario moderna y estilizada. Cuenta con las **48 selecciones clasificadas**, plantillas oficiales de **26 jugadores reales** por equipo, gestión de alineaciones, estado de lesiones y un motor de simulación inteligente basado en probabilidades reales.

---

## 🌟 Características Principales

* **Plantillas y Fotos Reales**: Datos de los 26 jugadores reales por selección, incluyendo sus posiciones, edades y ratings. Fotos de perfil extraídas directamente de FIFA y Wikipedia (con fallback automático a avatares de iniciales premium con diseño oscuro).
* **Gestión de Alineación Interactiva**:
  * Haz clic en los titulares en la pizarra táctica para seleccionarlos y presiona "Sustituir" en un suplente para intercambiarlos.
  * O usa el menú desplegable **"Cambiar"** junto a cada jugador en la lista para reemplazarlo directamente con un suplente de su misma posición.
* **Simulación Inteligente**:
  * Motor de simulación basado en distribución de Poisson (expectativa de goles).
  * Las clasificaciones de ataque, mediocampo y defensa se recalculan dinámicamente según la alineación activa y las lesiones.
  * Modificador de probabilidad por diferencia de ratings generales, aumentando la coherencia de victorias de selecciones grandes (ej. Francia, Brasil, España, Argentina) sin eliminar la posibilidad de empates o sorpresas históricas.
* **Cuadrícula de Eliminatorias Dinámica**:
  * Soporte completo para el formato de 48 equipos (Fase de grupos -> Dieciseisavos -> Octavos -> Cuartos -> Semifinal -> Final).
  * Resaltado visual de la fase activa con borde de resplandor verde.
  * Desplazamiento automático y suave (`scrollIntoView`) que centra la columna del torneo en juego para una experiencia fluida tanto en computadoras como en dispositivos móviles.
* **Ceremonia de Premiación Realista**:
  * Entrega de la **Bota de Oro** (goleador), **Máximo Asistente**, **Mejor Joven** (edad <= 21) y **Guante de Oro** (mejor portero).
  * Los premios individuales se calculan **únicamente** sobre las estadísticas de los jugadores que realmente juegan los partidos, evitando premios absurdos a suplentes o tercer arqueros.

---

## 📂 Estructura del Proyecto

* **`index.html`**: Estructura de la aplicación web y modales.
* **`style.css`**: Estilo general de la aplicación, implementando diseño responsivo, glassmorphism, paleta de colores HSL y transiciones suaves.
* **`app.js`**: Controlador de interfaz de usuario y renderizadores dinámicos.
* **`simulator.js`**: Lógica de simulación de partidos, progresión de llaves y cálculo de premios individuales.
* **`data.js`**: Dataset general de las 48 selecciones, grupos, valoraciones y jugadores.
* **`tests/`**: Carpeta que contiene las pruebas automatizadas (como [verify.js](file:///c:/Users/POWER/Desktop/vscode/mundial/tests/verify.js)).
* **`tools/`**: Herramientas de desarrollo, scrapers y scripts de utilidad (como [fill_missing_from_wikipedia.js](file:///c:/Users/POWER/Desktop/vscode/mundial/tools/fill_missing_from_wikipedia.js) y [scrape_all_squads.js](file:///c:/Users/POWER/Desktop/vscode/mundial/tools/scrape_all_squads.js)) junto con sus cachés locales.
* **`archive/`**: Respaldos históricos, volcados HTML crudos y mapas de enlaces recolectados de FIFA.com.

---

## 🚀 Cómo Ejecutar

### Prerrequisitos
Node.js instalado (versión 18 o superior).

### Instalación
1. Clona o descarga este repositorio en tu máquina local.
2. Abre la consola en el directorio del proyecto e instala las dependencias (necesarias para los scripts de scraping si deseas volver a ejecutarlos):
   ```bash
   npm install
   ```

### Uso
* Abre **`index.html`** directamente en tu navegador preferido o utilízalo con un servidor local de desarrollo (como Live Server o `npx serve .`).
* Para ejecutar la suite de pruebas y validar el motor:
   ```bash
   npm test
   ```
