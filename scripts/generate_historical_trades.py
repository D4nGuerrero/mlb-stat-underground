#!/usr/bin/env python3
"""Generate supplemental pre-2009 MLB trade data.

StatsAPI transaction history is sparse before 2009. Retrosheet keeps an older
transaction archive keyed by Retrosheet/Baseball-Reference player ids, and the
Chadwick register maps many of those ids to MLBAM ids. This script joins those
sources and writes a compact StatsAPI-like JSON file that the app can merge into
player/team transaction views.

Sources:
  - Retrosheet transaction database: https://www.retrosheet.org/transactions/
  - Chadwick register: https://github.com/chadwickbureau/register
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path


RETROSHEET_ZIP_URL = "https://www.retrosheet.org/transactions/tranDB.zip"
CHADWICK_TREE_URL = "https://api.github.com/repos/chadwickbureau/register/git/trees/master?recursive=1"
CHADWICK_RAW_BASE = "https://raw.githubusercontent.com/chadwickbureau/register/master/"
OUT_PATH = Path("public/data/historical-trades-pre2009.json")


TEAMS = {
    109: ("Arizona Diamondbacks", "ARI"),
    144: ("Atlanta Braves", "ATL"),
    110: ("Baltimore Orioles", "BAL"),
    111: ("Boston Red Sox", "BOS"),
    112: ("Chicago Cubs", "CHC"),
    145: ("Chicago White Sox", "CWS"),
    113: ("Cincinnati Reds", "CIN"),
    114: ("Cleveland Guardians", "CLE"),
    115: ("Colorado Rockies", "COL"),
    116: ("Detroit Tigers", "DET"),
    117: ("Houston Astros", "HOU"),
    118: ("Kansas City Royals", "KC"),
    108: ("Los Angeles Angels", "LAA"),
    119: ("Los Angeles Dodgers", "LAD"),
    146: ("Miami Marlins", "MIA"),
    158: ("Milwaukee Brewers", "MIL"),
    142: ("Minnesota Twins", "MIN"),
    121: ("New York Mets", "NYM"),
    147: ("New York Yankees", "NYY"),
    133: ("Sacramento Athletics", "SAC"),
    143: ("Philadelphia Phillies", "PHI"),
    134: ("Pittsburgh Pirates", "PIT"),
    135: ("San Diego Padres", "SD"),
    137: ("San Francisco Giants", "SF"),
    136: ("Seattle Mariners", "SEA"),
    138: ("St. Louis Cardinals", "STL"),
    139: ("Tampa Bay Rays", "TB"),
    140: ("Texas Rangers", "TEX"),
    141: ("Toronto Blue Jays", "TOR"),
    120: ("Washington Nationals", "WSH"),
}


# Retrosheet uses historical team codes. These map a historical franchise code to
# the current MLB franchise id so team pages can show all-time trade history.
RETRO_TEAM_TO_MLBAM = {
    "ARI": 109,
    "ATL": 144,
    "BSN": 144,
    "MLN": 144,
    "BAL": 110,
    "MLA": 110,
    "SLA": 110,
    "BOS": 111,
    "CHN": 112,
    "CHA": 145,
    "CIN": 113,
    "CLE": 114,
    "COL": 115,
    "DET": 116,
    "HOU": 117,
    "KCA": 118,
    "LAA": 108,
    "CAL": 108,
    "ANA": 108,
    "LAN": 119,
    "BRO": 119,
    "FLO": 146,
    "MIA": 146,
    "MIL": 158,
    "SE1": 158,
    "MIN": 142,
    "WS1": 142,
    "NYN": 121,
    "NYA": 147,
    "OAK": 133,
    "PHA": 133,
    "KC1": 133,
    "PHI": 143,
    "PIT": 134,
    "SDN": 135,
    "SFN": 137,
    "NY1": 137,
    "SEA": 136,
    "SLN": 138,
    "TBA": 139,
    "TEX": 140,
    "WS2": 140,
    "TOR": 141,
    "WAS": 120,
    "WSN": 120,
    "MON": 120,
}


TRADE_TYPE_LABELS = {
    "T": "Trade",
    "Tn": "Trade - refused to report",
    "Tp": "Trade - added player",
    "Tr": "Trade - returned player",
    "Tv": "Trade - voided",
}


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "mlb-stat-underground historical-trades"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def normalize_retro_type(value: str) -> str:
    return value.strip()


def normalize_date(raw: str) -> tuple[str, str]:
    year = raw[0:4]
    month = raw[4:6]
    day = raw[6:8]
    if month == "00":
        return f"{year}-01-01", "year"
    if day == "00":
        return f"{year}-{month}-01", "month"
    return f"{year}-{month}-{day}", "day"


def player_name(row: dict[str, str]) -> str:
    first = (row.get("name_first") or row.get("name_given") or "").strip()
    last = (row.get("name_last") or "").strip()
    suffix = (row.get("name_suffix") or "").strip()
    return " ".join(part for part in [first, last, suffix] if part)


def load_retrosheet_rows() -> list[dict[str, str]]:
    data = fetch_bytes(RETROSHEET_ZIP_URL)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        raw = archive.read("tran.txt").decode("utf-8")

    fields = [
        "primary_date",
        "time",
        "approximate",
        "secondary_date",
        "secondary_approximate",
        "transaction_id",
        "player",
        "type",
        "from_team",
        "from_league",
        "to_team",
        "to_league",
        "draft_type",
        "draft_round",
        "pick_number",
        "info",
    ]
    return [dict(zip(fields, row)) for row in csv.reader(io.StringIO(raw))]


def chadwick_people_paths() -> list[str]:
    tree = json.loads(fetch_bytes(CHADWICK_TREE_URL).decode("utf-8"))
    paths = [
        item["path"]
        for item in tree.get("tree", [])
        if re.fullmatch(r"data/people-[0-9a-z]\.csv", item.get("path", ""))
    ]
    return sorted(paths)


def load_player_map(retro_ids: set[str]) -> dict[str, dict[str, object]]:
    players: dict[str, dict[str, object]] = {}
    for path in chadwick_people_paths():
        text = fetch_bytes(CHADWICK_RAW_BASE + path).decode("utf-8")
        for row in csv.DictReader(io.StringIO(text)):
            retro = (row.get("key_retro") or "").strip()
            if not retro or retro not in retro_ids:
                continue

            mlbam_raw = (row.get("key_mlbam") or "").strip()
            players[retro] = {
                "id": int(mlbam_raw) if mlbam_raw.isdigit() else None,
                "fullName": player_name(row) or retro,
                "retroId": retro,
            }
    return players


def team_obj(retro_code: str, league: str) -> dict[str, object] | None:
    code = (retro_code or "").strip()
    if not code:
        return None

    team_id = RETRO_TEAM_TO_MLBAM.get(code)
    if team_id:
        name, abbr = TEAMS[team_id]
        return {"id": team_id, "name": name, "abbreviation": abbr, "retroCode": code, "league": league or None}

    return {"name": code, "abbreviation": code, "retroCode": code, "league": league or None}


def asset_label(row: dict[str, str], player: dict[str, object] | None) -> str:
    if player and player.get("fullName"):
        return str(player["fullName"])
    raw_player = (row.get("player") or "").strip()
    info = (row.get("info") or "").strip()
    return raw_player or info or "Cash Considerations"


def description_for(row: dict[str, str], player: dict[str, object] | None, from_team: dict[str, object] | None, to_team: dict[str, object] | None) -> str:
    label = asset_label(row, player)
    from_name = from_team.get("name") if from_team else "Unknown team"
    to_name = to_team.get("name") if to_team else "Unknown team"
    info = (row.get("info") or "").strip()
    retro_type = normalize_retro_type(row.get("type") or "")
    extra = f" ({info})" if info and info.lower() not in label.lower() else ""

    if retro_type == "Tr":
        return f"{label} returned to {to_name} from {from_name} after trade{extra}."
    if retro_type == "Tv":
        return f"Trade involving {label} between {from_name} and {to_name} was voided{extra}."
    if retro_type == "Tn":
        return f"{from_name} traded {label} to {to_name}; player refused to report{extra}."
    if retro_type == "Tp":
        return f"{label} was added to a trade from {from_name} to {to_name}{extra}."
    return f"{from_name} traded {label} to {to_name}{extra}."


def make_person(raw_player: str, player: dict[str, object] | None, fallback_label: str) -> dict[str, object] | None:
    if player:
        result = {"fullName": player["fullName"], "retroId": player["retroId"]}
        if player.get("id"):
            result["id"] = player["id"]
        return result

    raw = (raw_player or "").strip()
    if raw:
        return {"fullName": raw, "retroId": raw}

    if fallback_label:
        return {"fullName": fallback_label}
    return None


def build_records() -> dict[str, object]:
    rows = load_retrosheet_rows()
    pre_2009_trade_rows = [
        row
        for row in rows
        if int((row.get("primary_date") or "0000")[0:4] or 0) < 2009
        and normalize_retro_type(row.get("type") or "").startswith("T")
    ]

    retro_ids = {
        row["player"].strip()
        for row in pre_2009_trade_rows
        if re.fullmatch(r"[a-z]{4}[a-z0-9]\d{3}", row.get("player", "").strip())
    }
    player_map = load_player_map(retro_ids)

    records = []
    by_transaction: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in pre_2009_trade_rows:
        raw_date = row["primary_date"]
        date, precision = normalize_date(raw_date)
        retro_type = normalize_retro_type(row["type"])
        from_team = team_obj(row["from_team"], row["from_league"])
        to_team = team_obj(row["to_team"], row["to_league"])
        retro_player = row["player"].strip()
        player = player_map.get(retro_player)
        fallback = row["info"].strip()
        person = make_person(retro_player, player, fallback)
        description = description_for(row, player, from_team, to_team)

        record = {
            "id": f"retro-{row['transaction_id']}",
            "source": "retrosheet",
            "sourceTransactionId": int(row["transaction_id"]),
            "date": date,
            "rawDate": raw_date,
            "datePrecision": precision,
            "approximate": row["approximate"] == "@",
            "typeCode": "TR",
            "typeDesc": TRADE_TYPE_LABELS.get(retro_type, "Trade"),
            "retroType": retro_type,
            "description": description,
            "info": row["info"].strip() or None,
            "fromTeam": from_team,
            "toTeam": to_team,
        }
        if person:
            record["person"] = person

        records.append(record)
        by_transaction[row["transaction_id"]].append(record)

    return {
        "generatedAt": None,
        "sources": [
            RETROSHEET_ZIP_URL,
            "https://github.com/chadwickbureau/register",
        ],
        "notes": "Pre-2009 trade-related Retrosheet transactions mapped to MLBAM player/team ids where available.",
        "count": len(records),
        "transactionCount": len(by_transaction),
        "records": sorted(records, key=lambda item: (item["date"], item["sourceTransactionId"]), reverse=True),
    }


def main() -> int:
    data = build_records()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {data['count']} rows across {data['transactionCount']} trade ids to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
