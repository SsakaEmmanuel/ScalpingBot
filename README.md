# ScalpingBot

Demo-first trading research dashboard. Live order execution is not implemented.

## Pocket Option Signal Lab

Open [Pocket Signals](./pocket-signals.html) from the project navigation.

- The live forex mode requests 1-minute candles from Twelve Data. Obtain an API key from [Twelve Data](https://twelvedata.com/) and enter it in the page. The key is stored in that browser's local storage and is not committed to this repository.
- Browser-side API keys are not secret from anyone with access to that browser/device. For a public deployment, move the provider request behind a server-side endpoint and store the key as a server secret.
- Forex provider prices may be delayed or differ from Pocket Option's quotes.
- Pocket Option OTC quotes are not provided by this forex feed. OTC mode is explicitly labelled simulation; do not treat its generated candles as live signals.
- Synthetic candles are for interface testing only. Manual candle input is not independently verified.
- Signal scores are rule-based setup scores, not probabilities of winning or guarantees.
- Paper journaling and risk limits do not place trades. No Pocket Option login or live order automation is included.
- Telegram alerts require a secure HTTPS relay you control. Keep Telegram bot tokens on the server; never paste them into the page.

## Testing

1. Open `pocket-signals.html`.
2. Select Forex and Live forex candles.
3. Enter a Twelve Data API key and save it on this device.
4. Choose a supported asset and tap **Analyze for signal**.
5. Check the feed status and candle timestamp before interpreting the setup.
6. Use the journal for demo observations only. Validate a strategy against historical data and a demo account before relying on it.
