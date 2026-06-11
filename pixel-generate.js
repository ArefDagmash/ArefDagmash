const fs = require('fs');

const GITHUB_API = 'https://api.github.com/graphql';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || 'torvalds';

const COLS = 52;
const ROWS = 7;
const SQUARE = 16;
const GAP = 4;
const CELL = SQUARE + GAP;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;
const PAD = 20;

const COLORS = {
  empty: '#ebedf0',
  level1: '#9be9a8',
  level2: '#40c463',
  level3: '#30a14e',
  level4: '#216e39',
};

const COLORS_DARK = {
  empty: '#161b22',
  level1: '#0e4429',
  level2: '#006d32',
  level3: '#26a641',
  level4: '#39d353',
};

function getColor(count, isDark) {
  const colors = isDark ? COLORS_DARK : COLORS;
  if (count === 0) return colors.empty;
  if (count < 10) return colors.level1;
  if (count < 20) return colors.level2;
  if (count < 30) return colors.level3;
  return colors.level4;
}

async function fetchContributions(username) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GITHUB_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${data.errors.map(e => e.message).join(', ')}`);
  }

  const weeks = data.data.user.contributionsCollection.contributionCalendar.weeks;
  const grid = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData = [];
    for (let col = 0; col < COLS; col++) {
      if (col < weeks.length && row < weeks[col].contributionDays.length) {
        rowData.push(weeks[col].contributionDays[row].contributionCount);
      } else {
        rowData.push(0);
      }
    }
    grid.push(rowData);
  }
  return grid;
}

function generatePixelArtSVG(grid, isDark = false) {
  const bgColor = isDark ? '#0d1117' : '#ffffff';
  const textColor = isDark ? '#8b949e' : '#57606a';
  const totalW = WIDTH + PAD * 2;
  const totalH = HEIGHT + PAD * 2;
  const duration = 4;

  // Generate squares with wave animation
  let squares = '';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = PAD + col * CELL;
      const y = PAD + row * CELL;
      const count = grid[row][col];
      const baseColor = getColor(count, isDark);
      
      // Calculate wave delay based on position
      const wavePos = (col + row * 0.5) / (COLS + ROWS * 0.5);
      const delay = (wavePos * duration * 0.7).toFixed(2);
      const fadeIn = (parseFloat(delay) + 0.3).toFixed(2);
      const fadeOut = (parseFloat(delay) + 0.8).toFixed(2);
      const end = duration.toFixed(2);
      
      // Glow color (brighter version)
      const glowColor = count === 0 ? baseColor : 
        count < 10 ? (isDark ? '#1a5c3a' : '#c3f0d0') :
        count < 20 ? (isDark ? '#0a8c4a' : '#7de897') :
        count < 30 ? (isDark ? '#3bd65a' : '#5cd685') :
        (isDark ? '#5af27a' : '#3a9e55');

      squares += `
      <g>
        <rect x="${x}" y="${y}" width="${SQUARE}" height="${SQUARE}" rx="3" fill="${baseColor}">
          <animate attributeName="fill" values="${baseColor};${glowColor};${baseColor}" keyTimes="0;0.5;1" dur="1.5s" begin="${delay}s" repeatCount="indefinite" calcMode="ease-in-out"/>
        </rect>
        <rect x="${x}" y="${y}" width="${SQUARE}" height="${SQUARE}" rx="3" fill="none" stroke="${glowColor}" stroke-width="0" opacity="0">
          <animate attributeName="stroke-width" values="0;2;0" keyTimes="0;0.5;1" dur="1.5s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.6;0" keyTimes="0;0.5;1" dur="1.5s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="x" values="${x};${x-1};${x}" dur="1.5s" begin="${delay}s" repeatCount="indefinite"/>
          <animate attributeName="y" values="${y};${y-1};${y}" dur="1.5s" begin="${delay}s" repeatCount="indefinite"/>
        </rect>
      </g>`;
    }
  }

  // Month labels
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let monthLabels = '';
  const monthPos = [0, 4, 8, 13, 17, 21, 26, 30, 35, 39, 43, 48];
  for (let i = 0; i < months.length; i++) {
    const col = monthPos[i] || (i * 4);
    if (col < COLS) {
      const x = PAD + col * CELL + SQUARE / 2;
      monthLabels += `  <text x="${x}" y="${PAD - 8}" text-anchor="middle" font-size="11" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${months[i]}</text>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${bgColor}" rx="8"/>
  ${monthLabels}
  ${squares}
</svg>`;
}

async function main() {
  console.log(`Fetching contributions for ${USERNAME}...`);

  let grid;
  try {
    grid = await fetchContributions(USERNAME);
  } catch (err) {
    console.error('Failed to fetch contributions:', err.message);
    console.log('Using fallback grid...');
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let i = 0; i < 80; i++) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      grid[r][c] = Math.floor(Math.random() * 30) + 1;
    }
  }

  const svgLight = generatePixelArtSVG(grid, false);
  fs.writeFileSync('pixel-contributions.svg', svgLight);
  console.log('Generated pixel-contributions.svg');

  const svgDark = generatePixelArtSVG(grid, true);
  fs.writeFileSync('pixel-contributions-dark.svg', svgDark);
  console.log('Generated pixel-contributions-dark.svg');

  console.log(`\nTotal contributions: ${grid.flat().reduce((a, b) => a + b, 0)}`);
  console.log(`Active days: ${grid.flat().filter(c => c > 0).length}/365`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
