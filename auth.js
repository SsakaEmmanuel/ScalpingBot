(() => {
  const c = window.SCALPINGBOT_CONFIG || {};
  const ok = c.supabaseUrl && c.supabasePublishableKey &&
    !c.supabaseUrl.includes("PASTE_") && !c.supabasePublishableKey.includes("PASTE_");
  const status = document.getElementById("authStatus");
  const gate = document.getElementById("signedOutPanel");
  const dash = document.getElementById("privateDashboard");
  const msg = document.getElementById("authMessage");
  const dlg = document.getElementById("authDialog");
  let mode = "signin", sb = null;
  if (ok && window.supabase) sb = window.supabase.createClient(c.supabaseUrl, c.supabasePublishableKey);

  function open(m) {
    mode = m;
    document.getElementById("authTitle").textContent = m === "signin" ? "Sign in" : "Create account";
    document.getElementById("authSubmit").textContent = m === "signin" ? "Sign in" : "Create account";
    msg.textContent = "";
    dlg.showModal();
  }
  document.getElementById("signInOpen").onclick = () => open("signin");
  document.getElementById("signUpOpen").onclick = () => open("signup");
  document.getElementById("gateSignIn").onclick = () => open("signin");
  document.getElementById("gateSignUp").onclick = () => open("signup");
  document.getElementById("authClose").onclick = () => dlg.close();
  document.getElementById("authToggle").onclick = () => open(mode === "signin" ? "signup" : "signin");

  async function refresh() {
    if (!sb) {
      status.textContent = "Supabase configuration required; private dashboard locked.";
      gate.classList.remove("hidden"); dash.classList.add("hidden"); return;
    }
    const {data} = await sb.auth.getSession();
    const user = data.session?.user;
    if (user) {
      status.textContent = "Signed in as " + user.email + ". MT5 is not connected.";
      gate.classList.add("hidden"); dash.classList.remove("hidden");
      document.getElementById("signInOpen").classList.add("hidden");
      document.getElementById("signUpOpen").classList.add("hidden");
      document.getElementById("signOut").classList.remove("hidden");
    } else {
      status.textContent = "Sign in required. No terminal connected.";
      gate.classList.remove("hidden"); dash.classList.add("hidden");
      document.getElementById("signInOpen").classList.remove("hidden");
      document.getElementById("signUpOpen").classList.remove("hidden");
      document.getElementById("signOut").classList.add("hidden");
    }
  }
  document.getElementById("authForm").onsubmit = async e => {
    e.preventDefault();
    if (!sb) { msg.textContent = "Edit config.js with your Supabase Project URL and publishable key, then publish again."; return; }
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const button = document.getElementById("authSubmit"); button.disabled = true;
    try {
      const r = mode === "signin"
        ? await sb.auth.signInWithPassword({email, password})
        : await sb.auth.signUp({email, password, options:{emailRedirectTo:location.origin}});
      if (r.error) throw r.error;
      msg.textContent = mode === "signup" && !r.data.session
        ? "Account created. Check your email to confirm, then sign in."
        : "Success. Loading your dashboard…";
      if (r.data.session) { dlg.close(); await refresh(); }
    } catch(err) { msg.textContent = err.message || "Authentication failed."; }
    finally { button.disabled = false; }
  };
  document.getElementById("signOut").onclick = async () => { if (sb) await sb.auth.signOut(); await refresh(); };
  document.getElementById("requestConnect").onclick = () => alert("MT5 bridge not configured. Trading remains disabled.");
  if (sb) sb.auth.onAuthStateChange(() => refresh());
  refresh();
})();
