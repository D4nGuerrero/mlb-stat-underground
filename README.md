# ⚾️ MLB Live

**The underground MLB stats command center.**

Live scores. Deep analytics. Game simulation. Real-time everything. All in one sleek React dashboard for the true baseball sicko.

> "Because box scores are for tourists."

[![Live Data](https://img.shields.io/badge/LIVE%20DATA-%E2%9C%85-brightgreen?style=for-the-badge)](https://github.com/D4nGuerrero/mlb-stat-underground)

---

## ✨ What It Does

MLB Live is a full-featured, production-ready web app that turns the official MLB Stats API into something actually *fun* and *useful*:

- **Real-time scores** with live WebSocket updates
- **Deep player & team profiles** with advanced metrics
- **Stat leaders & standings** that update on the fly
- **Interactive baseball simulator** for what-if scenarios and chaos
- **Built-in API explorer** so you know exactly where the numbers come from

Private repo. Public ambition.

---

## 🗺️ Pages & Routes

| Page            | Route                  | What You Get                                      |
|-----------------|------------------------|---------------------------------------------------|
| **Scores**      | `/`                    | Live & recent games feed. Click any game for details |
| **GameDay**     | `/game/:gamePk`        | Full box score, play-by-play, lineups, live updates |
| **Stats**       | `/stats`               | Advanced query engine (date ranges, filters, splits) |
| **Leaders**     | `/leaders`             | Top performers across every meaningful category   |
| **Standings**   | `/standings`           | Division + Wild Card races with magic numbers     |
| **Simulator**   | `/simulator`           | Full baseball sim — games, seasons, roster tinkering |
| **API Docs**    | `/docs`                | Exhaustive MLB Stats API reference + examples     |
| **Player**      | `/player/:playerId`    | Bio, career splits, xStats, recent form, charts   |
| **Team**        | `/team/:teamId`        | Roster, standings context, key contributors       |

All routes are lightning-fast thanks to React Router v7 and a dark-mode UI that actually respects your eyeballs.

---

## 🚀 Tech Stack

- **React 19** + **Vite** (with React Compiler)
- **Tailwind CSS** + **Lucide icons**
- **React Router v7**
- **date-fns** + **react-datepicker**
- Custom `useMLBWebSocket` hook for real-time magic
- Theme context + clean component architecture

Built for speed, built to last.

---

## 🔧 Getting Started

```bash
# Clone the beast
git clone https://github.com/D4nGuerrero/mlb-stat-underground.git
cd mlb-stat-underground

# Install dependencies
npm install

# Fire it up (dev server on all interfaces)
npm run dev

# Build for production
npm run build
```

Then open `http://localhost:5173` and start digging.

---

## 🎯 Data Sources

- Official **MLB Stats API** (`statsapi.mlb.com`)
- WebSocket feeds for live game events
- Bundled Gameday data assets (see `mlb-atbat-data/`)

No scraping. No bullshit. Just clean, official data.

---

## 🤖 The Simulator

The crown jewel. Simulate individual games or full seasons. Tweak rosters. Run Monte Carlo projections. Find out what *should* have happened.

Because sometimes the box score lies.

---

## 🔄 Roadmap (vibes only)

- [ ] Darker dark mode
- [ ] Custom stat dashboards
- [ ] Historical deep dives (Statcast-era)
- [ ] Mobile PWA perfection
- [ ] Public demo deployment (maybe)

---

## 🤔 Why "Underground"?

Because the surface-level MLB site is fine for casuals.
This one is for the people who actually care about **xERA**, **wOBA**, and why your favorite team is 3.2 wins behind Pythagorean expectation.

---

## ⚙️ License

Private. Touch at your own risk. Or fork it and make it weirder.

---

**Built with ❤️ and way too much baseball data.**

*Last updated: May 2026*  
*Repo size: ~5MB of pure stats juice*

---

> Questions? Bugs? Existential baseball crises?
> Open an issue. Or just stare at the live data until it makes sense.