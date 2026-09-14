# RICH DETECTOR

Live bragging-rights game. Rank equals **USD successfully paid to this site**. Cosmetics, the throne, and attention are the rewards. Points cannot be withdrawn.

> Ranks spending on Rich Detector only. Not real-world net worth. Entertainment. 18+.

Built for a VPS. Demo mode runs with no Stripe keys so you can play locally in minutes.

## Features

1. **Live world leaderboard** — #1 billboard, gap bar, kill feed, watcher count, heat meter.
2. **The Throne** — `/#/throne` plus sitewide wear while #1 holds. Fallen kings get a cracked frame.
3. **Spend tiers + locker** — $1 / $5 / $15 / $40 / $100 / $250 / $500 unlock titles and borders.
4. **Real-time trackers** — reign seconds, armor countdown, heat, daily crown, gap-to-#1.
5. **Payment integration** — Stripe Checkout + webhooks, or DEMO MODE if no Stripe key.
6. **Visible plays** — Shove, Flex, Banner night, Lock drip, Throne armor, Repair frame.
7. **Daily crown + hall** — UTC day spend crown, longest reigns, assassins, fallen timeline.
8. **Profiles** — `/#/u/HANDLE`.
9. **Return hooks** — dethrone toast, optional sound, sticky SHOVE HUD.
10. **Safety** — health endpoint, banned taglines, no cash-out, disclaimer on every page.

## Quick start

```bash
git clone https://github.com/whirledclassic/rich-detector.git
cd rich-detector
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000

1. Claim a handle.
2. Shove $1. You overthrow **THE HOUSE**.
3. Open a second browser and fight for the chair.

## Stripe

Put keys in `.env`, set `PUBLIC_URL`, webhook `POST /api/stripe/webhook`.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

## License

MIT.
