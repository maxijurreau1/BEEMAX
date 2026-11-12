/**
 * PORTAL-OS1 Governors Dashboard & Conversational HUD UI Bridge
 * Mirrors real-time chat interaction with sys:*, gov:*, agent:*, ont:* command chips
 */
export function renderGovernorsDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PORTAL-OS1 // Governors Hypervisor HUD</title>
  <style>
    :root {
      --bg: #0b0d10;
      --surface: #13171d;
      --border: #232a35;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent: #38bdf8;
      --emerald: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 { font-size: 15px; letter-spacing: 0.08em; }
    nav a {
      color: var(--accent);
      text-decoration: none;
      margin-left: 16px;
      font-size: 13px;
    }
    #stream {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      max-width: 880px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .msg {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.5;
    }
    .msg.user { border-left: 3px solid var(--accent); }
    .msg.sys { border-left: 3px solid var(--emerald); }
    pre {
      margin-top: 8px;
      background: #080a0c;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 12px;
      color: #a5d6ff;
    }
    .chips {
      max-width: 880px;
      width: 100%;
      margin: 0 auto;
      padding: 8px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .chip:hover { border-color: var(--accent); color: var(--accent); }
    form {
      max-width: 880px;
      width: 100%;
      margin: 0 auto;
      padding: 12px 20px 20px;
      display: flex;
      gap: 10px;
    }
    input {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 12px 14px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 13px;
    }
    button[type="submit"] {
      background: var(--accent);
      color: #05080b;
      border: none;
      padding: 0 18px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <header>
    <h1>PORTAL-OS1 // BEEMAX GOVERNORS HUD</h1>
    <nav>
      <a href="/">HUD Terminal</a>
      <a href="/storefront">Art Gallery & DAT Marketplace</a>
      <a href="/showroom">Games & App Showroom</a>
    </nav>
  </header>

  <div id="stream">
    <div class="msg sys">
      <strong>BEEMAX MICROKERNEL ONLINE</strong> — Index <code>IDX-PRETIER-001</code> · Protocol <code>DAT-JURREAUISM-v1</code>.<br/>
      Select a command chip below or enter <code>sys:*</code>, <code>gov:*</code>, <code>agent:*</code>, or <code>ont:*</code>.
    </div>
  </div>

  <div class="chips">
    <button class="chip" onclick="runCmd('sys:status')">sys:status</button>
    <button class="chip" onclick="runCmd('gov:sync')">gov:sync</button>
    <button class="chip" onclick="runCmd('agent:mesh')">agent:mesh</button>
    <button class="chip" onclick="runCmd('ont:doctrine')">ont:doctrine</button>
  </div>

  <form onsubmit="event.preventDefault(); runCmd(document.getElementById('cmd').value); document.getElementById('cmd').value='';">
    <input id="cmd" placeholder="Invoke command (e.g. sys:status, agent:mesh, gov:sync)..." autocomplete="off" />
    <button type="submit">Execute</button>
  </form>

  <script>
    const stream = document.getElementById('stream');
    function appendMsg(role, title, payload) {
      const div = document.createElement('div');
      div.className = 'msg ' + role;
      div.innerHTML = '<strong>' + title + '</strong>' + (payload ? '<pre>' + JSON.stringify(payload, null, 2) + '</pre>' : '');
      stream.appendChild(div);
      stream.scrollTop = stream.scrollHeight;
    }
    async function runCmd(cmd) {
      if (!cmd) return;
      appendMsg('user', '> ' + cmd);
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      appendMsg('sys', '[' + data.namespace.toUpperCase() + '] ' + data.command, data.output);
    }
  </script>
</body>
</html>`;
}
