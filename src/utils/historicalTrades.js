import { assetUrl } from './baseUrl';

let historicalTradesPromise = null;

async function loadHistoricalTradeRecords() {
  if (!historicalTradesPromise) {
    historicalTradesPromise = fetch(assetUrl('data/historical-trades-pre2009.json'))
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load historical trade data.');
        return res.json();
      })
      .then((json) => json.records ?? []);
  }
  return historicalTradesPromise;
}

export function isHistoricalTrade(txn) {
  return txn?.source === 'retrosheet' && txn?.sourceTransactionId != null;
}

export async function getHistoricalTradesForPlayer(playerId) {
  const id = Number(playerId);
  if (!Number.isFinite(id)) return [];
  const records = await loadHistoricalTradeRecords();
  return records.filter((txn) => Number(txn.person?.id) === id);
}

export async function getHistoricalTradesForTeam(teamId) {
  const id = Number(teamId);
  if (!Number.isFinite(id)) return [];
  const records = await loadHistoricalTradeRecords();
  return records.filter((txn) =>
    Number(txn.fromTeam?.id) === id || Number(txn.toTeam?.id) === id
  );
}

export async function getHistoricalTradeBundle(txn) {
  if (!isHistoricalTrade(txn)) return [txn];
  const records = await loadHistoricalTradeRecords();
  const sourceId = Number(txn.sourceTransactionId);
  return records.filter((row) => Number(row.sourceTransactionId) === sourceId);
}
