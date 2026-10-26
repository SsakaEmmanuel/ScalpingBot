import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_ORIGIN = "https://ssakaemmanuel.github.io";
const FUNCTION_NAME = "ctrader-connect";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": APP_ORIGIN,
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "vary": "origin",
};
const REDIRECT_BASE = () => {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("Supabase is not configured.");
  return base.replace(/\/$/, "") + "/functions/v1/" + FUNCTION_NAME;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function html(title: string, message: string, ok: boolean) {
  const color = ok ? "#42d6ad" : "#ff8585";
  const safeTitle = title.replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]!));
  const safeMessage = message.replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]!));
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${safeTitle}</title><style>body{margin:0;background:#0b1020;color:#eef4ff;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;margin:20px;padding:28px;border:1px solid #293853;border-radius:18px;background:#111a2e}h1{font-size:26px;color:${color}}p{line-height:1.7;color:#b8c6dc}a{display:inline-block;margin-top:14px;color:#42d6ad}small{color:#91a3bf}</style><main class="card"><h1>${safeTitle}</h1><p>${safeMessage}</p><a href="https://ssakaemmanuel.github.io/ScalpingBot/ctrader.html">Return to ScalpingBot ↗</a><p><small>Demo access only. No trades were placed.</small></p></main><script>history.replaceState(null,"",location.pathname);</script></html>`, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration is incomplete.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function getPublicKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try { return JSON.parse(raw).default; } catch { /* handled below */ }
  }
  throw new Error("Supabase authentication is not configured.");
}
async function requireUser(req: Request): Promise<{ id: string; email?: string }> {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("Sign in to ScalpingBot before connecting cTrader.");
  const token = authorization.slice(7).trim();
  if (!token) throw new Error("Sign in to ScalpingBot before connecting cTrader.");
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("Supabase is not configured.");
  const response = await fetch(base.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: getPublicKey(), authorization: "Bearer " + token },
  });
  if (!response.ok) throw new Error("Your ScalpingBot session is invalid or expired. Sign in again.");
  const user = await response.json();
  if (!user?.id) throw new Error("Your ScalpingBot session is invalid or expired. Sign in again.");
  return { id: String(user.id), email: user.email };
}
function requireSecrets() {
  const clientId = Deno.env.get("CTRADER_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("CTRADER_CLIENT_SECRET")?.trim();
  const key = Deno.env.get("CTRADER_TOKEN_ENCRYPTION_KEY")?.trim();
  const missing = [
    !clientId && "CTRADER_CLIENT_ID",
    !clientSecret && "CTRADER_CLIENT_SECRET",
    !key && "CTRADER_TOKEN_ENCRYPTION_KEY",
  ].filter(Boolean);
  if (missing.length) throw new Error("Missing Supabase Edge Function secret(s): " + missing.join(", ") + ".");
  decodeKey(key!);
  return { clientId: clientId!, clientSecret: clientSecret!, key: key! };
}
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}
function decodeKey(value: string): Uint8Array {
  const bytes = base64ToBytes(value.trim());
  if (bytes.length !== 32) throw new Error("CTRADER_TOKEN_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.");
  return bytes;
}
async function encryptToken(plain: string, keyText: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", decodeKey(keyText), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return "v1." + bytesToBase64Url(iv) + "." + bytesToBase64Url(new Uint8Array(ciphertext));
}
async function decryptToken(value: string, keyText: string): Promise<string> {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Stored cTrader token format is invalid.");
  const key = await crypto.subtle.importKey("raw", decodeKey(keyText), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(parts[1]) }, key, base64ToBytes(parts[2]));
  return new TextDecoder().decode(plain);
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomState(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
function normalizeSymbol(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
async function exchangeToken(params: Record<string, string>) {
  const { clientId, clientSecret } = requireSecrets();
  const url = new URL("https://openapi.ctrader.com/apps/token");
  for (const [key, value] of Object.entries({ ...params, client_id: clientId, client_secret: clientSecret })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.accessToken || !body.refreshToken) {
    // Deliberately avoid echoing token endpoint URLs, query parameters, or secrets.
    throw new Error("cTrader token exchange failed. Check the Client ID, Client Secret, redirect URI, and authorization code; then retry the connection.");
  }
  return {
    accessToken: String(body.accessToken),
    refreshToken: String(body.refreshToken),
    tokenType: String(body.tokenType || "Bearer"),
    expiresIn: Math.max(60, Number(body.expiresIn) || 2628000),
  };
}
type ApiMessage = { payloadType?: number; clientMsgId?: string; payload?: Record<string, any> };
function waitForSocketOpen(ws: WebSocket, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { clean(); reject(new Error("cTrader demo connection timed out.")); }, timeoutMs);
    const clean = () => { clearTimeout(timer); ws.removeEventListener("open", onOpen); ws.removeEventListener("error", onError); ws.removeEventListener("close", onClose); };
    const onOpen = () => { clean(); resolve(); };
    const onError = () => { clean(); reject(new Error("Could not connect to cTrader's demo API.")); };
    const onClose = () => { clean(); reject(new Error("cTrader closed the demo API connection before it was ready.")); };
    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onError, { once: true });
    ws.addEventListener("close", onClose, { once: true });
  });
}
async function decodeWsData(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return await data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return String(data);
}
function sendAndWait(ws: WebSocket, payloadType: number, payload: Record<string, unknown>, expectedType: number, timeoutMs = 15000): Promise<ApiMessage> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, message?: ApiMessage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
      if (error) reject(error); else resolve(message!);
    };
    const onError = () => finish(new Error("cTrader demo API connection failed."));
    const onClose = () => finish(new Error("cTrader closed the API connection during the request."));
    const onMessage = (event: MessageEvent) => {
      void decodeWsData(event.data).then((text) => {
        let message: ApiMessage;
        try { message = JSON.parse(text); } catch { return; }
        if (Number(message.payloadType) === 2142) {
          const description = message.payload?.description || message.payload?.errorCode;
          finish(new Error("cTrader rejected a read-only request" + (description ? ": " + String(description).slice(0, 120) : ".") ));
          return;
        }
        if (Number(message.payloadType) === expectedType) finish(undefined, message);
      }).catch(() => {});
    };
    const timer = setTimeout(() => finish(new Error("cTrader did not answer a read-only request in time.")), timeoutMs);
    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", onError, { once: true });
    ws.addEventListener("close", onClose, { once: true });
    try {
      ws.send(JSON.stringify({ clientMsgId: crypto.randomUUID(), payloadType, payload }));
    } catch {
      finish(new Error("Could not send a read-only request to cTrader."));
    }
  });
}
async function withDemoSocket<T>(run: (ws: WebSocket) => Promise<T>): Promise<T> {
  const ws = new WebSocket("wss://demo.ctraderapi.com:5036");
  try {
    await waitForSocketOpen(ws);
    return await run(ws);
  } finally {
    try { ws.close(); } catch { /* ignore close errors */ }
  }
}
async function listDemoAccounts(accessToken: string) {
  const { clientId, clientSecret } = requireSecrets();
  return await withDemoSocket(async (ws) => {
    await sendAndWait(ws, 2100, { clientId, clientSecret }, 2101);
    const accountsRes = await sendAndWait(ws, 2149, { accessToken }, 2150);
    const accounts = accountsRes.payload?.ctidTraderAccount || accountsRes.payload?.ctidTraderAccounts || [];
    if (!Array.isArray(accounts)) throw new Error("cTrader returned an unexpected account list.");
    return accounts.filter((account: Record<string, unknown>) => account.isLive === false);
  });
}
async function ensureFreshTokens(admin: ReturnType<typeof createClient>, userId: string, row: Record<string, any>, keyText: string) {
  const expiryMs = row.access_token_expires_at ? Date.parse(row.access_token_expires_at) : 0;
  if (expiryMs > Date.now() + 120000) {
    return { accessToken: await decryptToken(row.access_token_ciphertext, keyText), row };
  }
  const refreshToken = await decryptToken(row.refresh_token_ciphertext, keyText);
  const token = await exchangeToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  const now = new Date();
  const accessCipher = await encryptToken(token.accessToken, keyText);
  const refreshCipher = await encryptToken(token.refreshToken, keyText);
  const changes = {
    access_token_ciphertext: accessCipher,
    refresh_token_ciphertext: refreshCipher,
    token_type: token.tokenType,
    access_token_expires_at: new Date(now.getTime() + token.expiresIn * 1000).toISOString(),
    updated_at: now.toISOString(),
  };
  const { error } = await admin.from("ctrader_connections").update(changes).eq("user_id", userId);
  if (error) throw new Error("Could not securely update the cTrader session. Reconnect cTrader and try again.");
  return {
    accessToken: token.accessToken,
    row: { ...row, ...changes },
  };
}
async function connectAccount(accessToken: string, accountId: string, fn: (ws: WebSocket) => Promise<unknown>) {
  const { clientId, clientSecret } = requireSecrets();
  return await withDemoSocket(async (ws) => {
    await sendAndWait(ws, 2100, { clientId, clientSecret }, 2101);
    await sendAndWait(ws, 2102, { ctidTraderAccountId: accountId, accessToken }, 2103);
    return await fn(ws);
  });
}
async function accountInfo(accessToken: string, accountId: string) {
  return await connectAccount(accessToken, accountId, async (ws) => {
    const traderRes = await sendAndWait(ws, 2121, { ctidTraderAccountId: accountId }, 2122);
    const trader = traderRes.payload?.trader;
    if (!trader) throw new Error("cTrader did not return account details.");
    const assetsRes = await sendAndWait(ws, 2112, { ctidTraderAccountId: accountId }, 2113);
    const assets = assetsRes.payload?.asset || [];
    const currency = Array.isArray(assets) ? assets.find((a: Record<string, any>) => String(a.assetId) === String(trader.depositAssetId)) : null;
    const moneyDigits = Number(trader.moneyDigits ?? 2);
    const balance = Number(trader.balance) / Math.pow(10, moneyDigits);
    return {
      accountId,
      accountType: ({ 0: "Hedged", 1: "Netted", 2: "Spread betting" } as Record<number, string>)[Number(trader.accountType)] || "Demo account",
      broker: String(trader.brokerName || "Pepperstone"),
      currency: currency?.name || currency?.displayName || null,
      balance: Number.isFinite(balance) ? balance : null,
      leverage: trader.leverageInCents == null ? null : Number(trader.leverageInCents) / 100,
      readOnly: true,
      environment: "demo",
      checkedAt: new Date().toISOString(),
    };
  });
}
async function readMarketData(accessToken: string, accountId: string, rawSymbol: string, timeframe: string, count: number) {
  const periods: Record<string, number> = { M1: 1, M5: 5, M15: 7 };
  const period = periods[timeframe];
  if (!period) throw new Error("Choose M1, M5, or M15.");
  const wanted = normalizeSymbol(rawSymbol);
  if (!wanted || wanted.length < 6 || wanted.length > 12) throw new Error("Enter a valid symbol such as EUR/USD.");
  const safeCount = Math.min(250, Math.max(60, Math.trunc(count || 100)));
  return await connectAccount(accessToken, accountId, async (ws) => {
    const symbolsRes = await sendAndWait(ws, 2114, { ctidTraderAccountId: accountId }, 2115);
    const symbols = symbolsRes.payload?.symbol || [];
    const symbol = Array.isArray(symbols) ? symbols.find((s: Record<string, any>) => normalizeSymbol(String(s.name || "")) === wanted) : null;
    if (!symbol) throw new Error("That symbol is not available on this cTrader demo account. Check the exact name in cTrader.");
    const barsRes = await sendAndWait(ws, 2137, {
      ctidTraderAccountId: accountId,
      symbolId: String(symbol.symbolId),
      period,
      count: safeCount,
      toTimestamp: Date.now(),
    }, 2138, 20000);
    const bars = barsRes.payload?.trendbar || [];
    if (!Array.isArray(bars)) throw new Error("cTrader returned an unexpected candle response.");
    const candles = bars.map((bar: Record<string, any>) => {
      const lowRaw = Number(bar.low);
      const low = lowRaw / 100000;
      const scale = (value: unknown) => (lowRaw + Number(value || 0)) / 100000;
      return {
        time: Number(bar.utcTimestampInMinutes) * 60,
        open: scale(bar.deltaOpen),
        high: scale(bar.deltaHigh),
        low,
        close: scale(bar.deltaClose),
        volume: Number(bar.volume || 0),
      };
    }).filter((bar: Record<string, number>) => [bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
      .sort((a: Record<string, number>, b: Record<string, number>) => a.time - b.time);
    if (!candles.length) throw new Error("No completed candles were returned for this symbol and timeframe.");
    return {
      source: "cTrader Open API",
      broker: "Pepperstone demo",
      environment: "demo",
      readOnly: true,
      symbol: String(symbol.name || rawSymbol),
      symbolId: String(symbol.symbolId),
      timeframe,
      retrievedAt: new Date().toISOString(),
      candleCount: candles.length,
      candles,
    };
  });
}
async function getConnectionRow(admin: ReturnType<typeof createClient>, userId: string, accountId: string) {
  if (!/^\d{1,20}$/.test(accountId)) throw new Error("Choose a valid linked demo account.");
  const { data, error } = await admin.from("ctrader_connections")
    .select("id,user_id,broker,environment,ctid_trader_account_id,account_label,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,token_type,created_at,updated_at")
    .eq("user_id", userId).eq("ctid_trader_account_id", accountId).eq("environment", "demo").maybeSingle();
  if (error || !data) throw new Error("That demo account is not connected to your ScalpingBot user. Connect it first.");
  return data as Record<string, any>;
}
function requireMethod(req: Request, method: string) {
  if (req.method !== method) throw new Error("Use " + method + " for this action.");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: JSON_HEADERS });
  const url = new URL(req.url);
  // cTrader redirects here with ?code=...&state=... . Never return the code or tokens to the browser.
  if (req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) {
    const oauthError = url.searchParams.get("error");
    if (oauthError) return html("cTrader connection cancelled", "Authorization was cancelled or declined. Return to ScalpingBot and try again when ready.", false);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !state) return html("Connection not completed", "cTrader did not return the expected authorization details. Return to ScalpingBot and restart the connection.", false);
    try {
      const secrets = requireSecrets();
      const admin = getAdmin();
      const stateHash = await sha256Hex(state);
      const now = new Date();
      const { data: stateRow, error: stateError } = await admin.from("ctrader_oauth_states")
        .update({ consumed_at: now.toISOString() })
        .eq("state_hash", stateHash).is("consumed_at", null).gt("expires_at", now.toISOString())
        .select("user_id").maybeSingle();
      if (stateError || !stateRow?.user_id) return html("Connection expired", "This authorization link expired or was already used. Return to ScalpingBot and start again.", false);
      const token = await exchangeToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_BASE() });
      const accounts = await listDemoAccounts(token.accessToken);
      if (!accounts.length) return html("No demo account found", "The cTrader authorization succeeded, but no demo account was granted. Check the Accounts permission and authorize your Pepperstone demo account.", false);
      const accessCipher = await encryptToken(token.accessToken, secrets.key);
      const refreshCipher = await encryptToken(token.refreshToken, secrets.key);
      const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
      const rows = accounts.map((account: Record<string, any>) => ({
        user_id: String(stateRow.user_id),
        broker: String(account.brokerTitleShort || "Pepperstone"),
        environment: "demo",
        ctid_trader_account_id: String(account.ctidTraderAccountId),
        account_label: String((account.brokerTitleShort || "cTrader") + " · Demo · " + (account.traderLogin || account.ctidTraderAccountId)),
        access_token_ciphertext: accessCipher,
        refresh_token_ciphertext: refreshCipher,
        access_token_expires_at: expiresAt,
        token_type: token.tokenType,
        updated_at: now.toISOString(),
      }));
      const { error: saveError } = await admin.from("ctrader_connections").upsert(rows, { onConflict: "user_id,ctid_trader_account_id" });
      if (saveError) throw new Error("The cTrader account was authorized but secure token storage failed. Check the Supabase function configuration and reconnect.");
      return html("cTrader demo connected", "ScalpingBot securely stored the authorization for " + accounts.length + " demo account(s). Return to the cTrader connection page to test account information and candles.", true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected connection error.";
      return html("Connection needs attention", message, false);
    }
  }
  try {
    requireMethod(req, "POST");
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const admin = getAdmin();

    if (action === "start") {
      const secrets = requireSecrets();
      const state = randomState();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await admin.from("ctrader_oauth_states").insert({
        state_hash: await sha256Hex(state),
        user_id: user.id,
        expires_at: expiresAt,
      });
      if (error) throw new Error("Could not start secure authorization. Please try again.");
      const authorize = new URL("https://id.ctrader.com/my/settings/openapi/grantingaccess/");
      authorize.searchParams.set("client_id", secrets.clientId);
      authorize.searchParams.set("redirect_uri", REDIRECT_BASE());
      authorize.searchParams.set("scope", "accounts");
      authorize.searchParams.set("product", "web");
      authorize.searchParams.set("state", state);
      return json({ ok: true, authorizeUrl: authorize.toString(), scope: "accounts", environment: "demo" });
    }
    if (action === "status") {
      const { data, error } = await admin.from("ctrader_connections")
        .select("ctid_trader_account_id,account_label,broker,environment,created_at,updated_at")
        .eq("user_id", user.id).eq("environment", "demo").order("created_at", { ascending: true });
      if (error) throw new Error("Could not read the cTrader connection status.");
      return json({ ok: true, accounts: (data || []).map((row: Record<string, any>) => ({
        accountId: String(row.ctid_trader_account_id),
        label: row.account_label || (row.broker + " demo"),
        broker: row.broker,
        environment: "demo",
        connectedAt: row.created_at,
        updatedAt: row.updated_at,
      })) });
    }
    if (action === "disconnect") {
      const accountId = String(body.accountId || "");
      if (!/^\d{1,20}$/.test(accountId)) throw new Error("Choose a valid linked demo account.");
      const { error } = await admin.from("ctrader_connections").delete()
        .eq("user_id", user.id).eq("ctid_trader_account_id", accountId).eq("environment", "demo");
      if (error) throw new Error("Could not remove the stored demo authorization.");
      return json({ ok: true, disconnected: true });
    }
    if (action === "account-info" || action === "market-data") {
      const accountId = String(body.accountId || "");
      const secrets = requireSecrets();
      const row = await getConnectionRow(admin, user.id, accountId);
      const fresh = await ensureFreshTokens(admin, user.id, row, secrets.key);
      if (action === "account-info") {
        const info = await accountInfo(fresh.accessToken, accountId);
        return json({ ok: true, account: info });
      }
      const result = await readMarketData(
        fresh.accessToken,
        accountId,
        String(body.symbol || "EUR/USD"),
        String(body.timeframe || "M1").toUpperCase(),
        Number(body.count || 100),
      );
      return json({ ok: true, market: result });
    }
    return json({ ok: false, error: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected request error.";
    const status = /Sign in|session is invalid/i.test(message) ? 401 : /Use POST/i.test(message) ? 405 : /Missing Supabase Edge Function secret|configuration is incomplete|authentication is not configured|Base64-encoded/i.test(message) ? 503 : 400;
    return json({ ok: false, error: message }, status);
  }
});
