/**
 * Build-time snapshot of MLB Pipeline rankings.
 * Used when the browser cannot call data-graph.mlb.com (CORS).
 *
 * Writes: public/data/pipeline-rankings.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '../public/data/pipeline-rankings.json');
const GRAPH_URL = 'https://data-graph.mlb.com/graphql';
const SEASON = Number(process.env.PIPELINE_SEASON) || new Date().getFullYear();

const TEAM_SLUGS = [
  'angels', 'dbacks', 'orioles', 'redsox', 'cubs', 'reds', 'guardians', 'rockies',
  'tigers', 'astros', 'royals', 'dodgers', 'nationals', 'mets', 'athletics', 'pirates',
  'padres', 'mariners', 'giants', 'cardinals', 'rays', 'rangers', 'bluejays', 'twins',
  'phillies', 'braves', 'whitesox', 'marlins', 'yankees', 'brewers',
];

const QUERY = `
  query GetPlayerRankings($slug: String!, $limit: Int) {
    getPlayerRankingsFromSelection(slug: $slug, limit: $limit) {
      rank
      playerEntity {
        eta
        position
        heroImage: formattedThumbnail(aspectRatio: "16:9", width: 640)
        playerPhotoCustomUrl
        signed
        prospectBio {
          contentTitle
          contentText
        }
        player {
          id
          fullName
          birthDate
          currentAge
          height
          weight
          primaryPosition { abbreviation name }
        }
      }
    }
  }
`;

async function fetchSelection(slug, limit) {
  const response = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: { slug, limit },
    }),
  });

  if (!response.ok) {
    throw new Error(`${slug}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`${slug}: ${payload.errors[0]?.message ?? 'GraphQL error'}`);
  }

  return payload.data?.getPlayerRankingsFromSelection ?? [];
}

async function main() {
  const selections = {};
  const failures = [];

  const jobs = [
    { slug: `sel-pr-${SEASON}-top100`, limit: 100 },
    ...TEAM_SLUGS.map((team) => ({
      slug: `sel-pr-${SEASON}-${team}`,
      limit: 30,
    })),
  ];

  // Modest concurrency so we don't hammer the API.
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      try {
        const rows = await fetchSelection(job.slug, job.limit);
        selections[job.slug] = rows;
        process.stdout.write(`✓ ${job.slug} (${rows.length})\n`);
      } catch (err) {
        failures.push(`${job.slug}: ${err.message}`);
        process.stdout.write(`✗ ${job.slug}: ${err.message}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (!Object.keys(selections).length) {
    console.error('No rankings fetched; aborting write.');
    process.exit(1);
  }

  const payload = {
    season: SEASON,
    updatedAt: new Date().toISOString(),
    selections,
    failures,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  console.log(`Wrote ${OUT_FILE} (${Object.keys(selections).length} selections)`);
  if (failures.length) {
    console.warn(`Completed with ${failures.length} failures.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
