
(() => {
  const cfg = window.SCALPINGBOT_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabasePublishableKey &&
    !cfg.supabaseUrl.includes("PASTE_") && !cfg.supabasePublishableKey.includes("PASTE_");
  const status = document.getElementById("authStatus");
  const gate = document.getElementById("signedOutPanel");
  const dashboard = document.getElementById("privateDashboard");
  const msg = document.getElementById("authMessage");
  const dialog = document.getElementById("authDialog");
  let mode = "signin", client = null;

  // This status element exists only on the dedicated security page.
  // Do not let its absence on the home page interrupt login initialization.
  const configStatus = document.getElementById("configStatus");
  if (configStatus) {
    configStatus.textContent = configured ? "Configured" : "Setup needed";
  }

  if (configured && window.supabase?.createClient) {
    client = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }
  window.SCALPINGBOT_SUPABASE = client;

  function openAuth(nextMode) {
    mode = nextMode;
    document.getElementById("authTitle").textContent =
      mode === "signin" ? "Sign in" : "Create account";
    document.getElementById("authDescription").textContent =
      mode === "signin"
        ? "Sign in to your ScalpingBot account."
        : "Create an account to access the private dashboard.";
    document.getElementById("authSubmit").textContent =
      mode === "signin" ? "Sign in" : "Create account";
    document.getElementById("authToggle").textContent =
      mode === "signin"
        ? "Need an account? Create one"
        : "Already registered? Sign in";
    document.getElementById("authPassword").autocomplete =
      mode === "signin" ? "current-password" : "new-password";
    msg.textContent = "";

    if (dialog.showModal) {
      dialog.showModal();
    } else {
      alert("Please use a modern browser to sign in.");
    }
  }

  document.getElementById("signInOpen").onclick = () => openAuth("signin");
  document.getElementById("signUpOpen").onclick = () => openAuth("signup");
  document.getElementById("gateSignIn").onclick = () => openAuth("signin");
  document.getElementById("gateSignUp").onclick = () => openAuth("signup");
  document.getElementById("authClose").onclick = () => dialog.close();
  document.getElementById("authToggle").onclick = () =>
    openAuth(mode === "signin" ? "signup" : "signin");

  async function refreshSession() {
    if (!client) {
      status.textContent =
        "Secure account service is unavailable; dashboard locked.";
      gate.classList.remove("hidden");
      dashboard.classList.add("hidden");
      return;
    }

    const { data, error } = await client.auth.getSession();
    const user = !error && data.session?.user;

    if (user) {
      status.textContent =
        "Signed in as " + user.email + ". MT5 terminal not connected.";
      gate.classList.add("hidden");
      dashboard.classList.remove("hidden");
      document.getElementById("signInOpen").classList.add("hidden");
      document.getElementById("signUpOpen").classList.add("hidden");
      document.getElementById("signOut").classList.remove("hidden");
    } else {
      status.textContent = "Sign in required. No terminal connected.";
      gate.classList.remove("hidden");
      dashboard.classList.add("hidden");
      document.getElementById("signInOpen").classList.remove("hidden");
      document.getElementById("signUpOpen").classList.remove("hidden");
      document.getElementById("signOut").classList.add("hidden");
    }
  }

  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!client) {
      msg.textContent =
        "Account service setup is incomplete. Please try again later or contact support.";
      return;
    }

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const button = document.getElementById("authSubmit");

    button.disabled = true;
    msg.textContent =
      mode === "signin" ? "Signing in…" : "Creating account…";

    try {
      const result = mode === "signin"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo:
                "https://ssakaemmanuel.github.io/ScalpingBot/"
            }
          });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        msg.textContent =
          "Account created. Check your email for confirmation, then return and sign in.";
      } else {
        msg.textContent = "Success. Loading dashboard…";
        dialog.close();
        await refreshSession();
      }
    } catch (error) {
      msg.textContent =
        error.message || "Authentication failed. Check your details and try again.";
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("signOut").onclick = async () => {
    if (client) await client.auth.signOut();
    await refreshSession();
  };

  if (client) {
    client.auth.onAuthStateChange(() => refreshSession());
  }

  refreshSession();
})();
