# ScalpingBot

A mobile-friendly trading research dashboard with **Demo** and **Live** market-data modes. Live broker order execution is not implemented.

## Pocket Signals Pro

Open [Pocket Signals](./pocket-signals.html) from the project navigation.

### What it includes

- **Demo mode:** creates Demo candles so you can exercise the interface, signal rules, journal, and risk controls without implying a live quote.
- **Live mode:** requests 1-minute, 5-minute, or 15-minute forex candles from Twelve Data. The supported symbols in the page include EUR/USD, GBP/USD, USD/JPY, AUD/USD, EUR/JPY, and XAU/USD.
- **Rule-based signal engine:** EMA 9/21 trend alignment, RSI(14), recent breakout, short momentum, candle-body direction, and volatility checks. The score is a setup-quality score, not a probability of winning.
- **Chart and feed diagnostics:** candle chart with moving-average overlays, latest provider timestamp, data-age check, and clear feed errors.
- **Historical candle test:** a forward-only candle comparison that evaluates each setup using earlier candles and checks the later close at the selected horizon. It is not a broker execution replay or a promise of future performance.
- **Auto-scan and alerts:** configurable 1-minute or 5-minute scan cadence, browser notifications, and an optional HTTPS relay endpoint. Duplicate alerts from the same candle/setup are suppressed.
- **Risk guard and journal:** daily entry cap, reference risk budget, daily loss lock, manually marked paper outcomes, estimated paper P/L, and CSV export.

### Connect the Live forex feed

1. Open `pocket-signals.html` in the running app or deployed site. GitHub's source-code view does not run the tool.
2. Select **Live market data** and keep Market type on **Forex**.
3. Get an API key from [Twelve Data](https://twelvedata.com/), enter it in the page, then choose **Save key**.
4. Tap **Analyze now** and inspect the feed-status message and latest candle timestamp before interpreting the signal.
5. Start auto-scan only after a successful manual request. Live data requests use provider quota; choose a polling interval appropriate for your plan.

Twelve Data documents time-series intervals and parameters at [its API documentation](https://twelvedata.com/docs). Access, rate limits, data latency, and symbol coverage depend on the provider account and plan.

### Safety and operating limits

- **Live means Live market data and alerts only.** This page does not log in to Pocket Option or place real-money orders.
- Pocket Option OTC quotes are not supplied by the Twelve Data forex feed. OTC is available only in **Demo** mode.
- Demo candles are for exercising the workflow and researching the rule engine; they must not be interpreted as actual quotes.
- A browser-stored API key is not secret from someone who can inspect that browser or device. For public deployment, use a server-side endpoint with the key stored as a server secret.
- Telegram bot tokens must stay on a server. The page accepts only your own HTTPS relay URL, not a bot token. The relay must allow the page's origin through CORS.
- Risk limits are local research guardrails; they do not control any broker balance. Results marked in the journal are manually entered.
- The historical candle test excludes execution details such as platform quote differences, latency, payout changes, and slippage. Review meaningful samples and use a broker-provided demo account before making decisions.

## Static checks

Run the built-in source checks with Node.js 20 or later:

```sh
node tests/check-pocket-signals.mjs
```

GitHub Actions runs these checks when the Pocket Signals page, test file, or workflow changes.
