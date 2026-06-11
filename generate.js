const fs = require('fs');

const GITHUB_API = 'https://api.github.com/graphql';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || 'torvalds';

const COLS = 52;
const ROWS = 7;
const SQUARE = 11;
const GAP = 3;
const CELL = SQUARE + GAP;
const WIDTH = COLS * SQUARE + (COLS - 1) * GAP;
const HEIGHT = ROWS * SQUARE + (ROWS - 1) * GAP;
const HEADER_HEIGHT = 20;
const TOTAL_HEIGHT = HEIGHT + HEADER_HEIGHT;

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
        const day = weeks[col].contributionDays[row];
        rowData.push(day.contributionCount);
      } else {
        rowData.push(0);
      }
    }
    grid.push(rowData);
  }

  return grid;
}

function generateSVG(grid, isDark = false) {
  const bgColor = isDark ? '#0d1117' : '#ffffff';
  const textColor = isDark ? '#8b949e' : '#57606a';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let monthLabels = '';
  const monthPositions = [0, 4, 8, 13, 17, 21, 26, 30, 35, 39, 43, 48];
  for (let i = 0; i < months.length; i++) {
    const col = monthPositions[i] || (i * 4);
    if (col < COLS) {
      const x = col * CELL + SQUARE / 2;
      monthLabels += `  <text x="${x}" y="15" text-anchor="middle" font-size="10" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${months[i]}</text>\n`;
    }
  }

  let squares = '';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * CELL;
      const y = row * CELL + HEADER_HEIGHT;
      const count = grid[row][col];
      const color = getColor(count, isDark);
      squares += `  <rect x="${x}" y="${y}" width="${SQUARE}" height="${SQUARE}" rx="2" fill="${color}"/>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${TOTAL_HEIGHT}" width="${WIDTH}" height="${TOTAL_HEIGHT}">
  <rect width="100%" height="100%" fill="${bgColor}" rx="6"/>
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
    process.exit(1);
  }

  const svgLight = generateSVG(grid, false);
  fs.writeFileSync('contribution-graph.svg', svgLight);
  console.log('Generated contribution-graph.svg');

  const svgDark = generateSVG(grid, true);
  fs.writeFileSync('contribution-graph-dark.svg', svgDark);
  console.log('Generated contribution-graph-dark.svg');

  const stats = {
    totalContributions: grid.flat().reduce((a, b) => a + b, 0),
    nonZeroDays: grid.flat().filter(c => c > 0).length,
  };

  console.log(`Total contributions: ${stats.totalContributions}`);
  console.log(`Active days: ${stats.nonZeroDays}/365`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
