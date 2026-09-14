# RICH DETECTOR

Live site: **https://whirledclassic.github.io/rich-detector/**

Source: https://github.com/whirledclassic/rich-detector

Bragging-rights game. Rank = dollars spent on this site. Not real-world net worth. 18+.

GitHub Pages runs the browser demo (localStorage, no Stripe). For real payments, run the Node server on a VPS.

## Play on GitHub Pages

1. Open https://whirledclassic.github.io/rich-detector/
2. Claim a handle
3. Shove $1 to take the throne from THE HOUSE

If the first deploy is still spinning, wait a minute and hard-refresh. One-time setup if Pages 404s: repo **Settings → Pages → Source = GitHub Actions**.

## Run the real server

```bash
git clone https://github.com/whirledclassic/rich-detector.git
cd rich-detector
cp .env.example .env
npm install
npm start
```

http://localhost:3000

## Stripe / VPS

Put keys in `.env`. Webhook: `POST /api/stripe/webhook`.

```bash
docker compose up -d --build
```

## License

MIT.
