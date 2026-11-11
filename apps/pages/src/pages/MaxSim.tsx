import { useState } from "react";
import { api } from "../api/client";
import { AsyncState } from "../components/AsyncState";
import { MaxSimTree } from "../components/max-sim/MaxSimTree";
import type { MaxSimResponse } from "../types/maxSim";
import "../components/max-sim/max-sim.css";

export default function MaxSim() {
  const [gameId, setGameId] = useState("");
  const [submittedGameId, setSubmittedGameId] = useState("");
  const [state, setState] = useState<{ data?: MaxSimResponse; loading: boolean; error?: string }>({ loading: false });

  async function load(id: string) {
    const normalized = id.trim();
    if (!normalized || normalized.length > 120) {
      setState({ loading: false, error: "Enter a game ID of 1–120 characters." });
      return;
    }
    setSubmittedGameId(normalized);
    setState({ loading: true });
    try {
      const data = await api<MaxSimResponse>(`/api/max-sim/games/${encodeURIComponent(normalized)}/latest`, { cache: "no-store" });
      setState({ data, loading: false });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Unable to load simulation data." });
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAX SIM · RECORDED EVIDENCE</div>
          <h1>Scenario branches<span className="title-dot">.</span></h1>
          <p>View the latest completed scenario tree stored for a game. No live feed or prediction is implied.</p>
        </div>
      </div>
      <section className="panel max-sim-search">
        <form onSubmit={(event) => { event.preventDefault(); void load(gameId); }}>
          <label htmlFor="max-sim-game">Game ID</label>
          <input id="max-sim-game" value={gameId} maxLength={120} onChange={(event) => setGameId(event.target.value)} placeholder="Enter a game ID" />
          <button className="primary" disabled={state.loading || !gameId.trim()}>{state.loading ? "Loading…" : "Load latest completed run"}</button>
        </form>
      </section>
      <AsyncState {...state} retry={() => { if (submittedGameId) void load(submittedGameId); }} />
      {state.data?.run && (
        <div className="max-sim-run-meta" aria-label="Simulation run metadata">
          <span>Run {state.data.run.id}</span><span>{state.data.run.sport}</span>
          <span>Baseline win probability {state.data.run.baselineWinProb}%</span>
          <span>Recorded {new Date(state.data.run.createdAt).toLocaleString()}</span>
        </div>
      )}
      {state.data && !state.data.run && <p className="notice">No completed simulation run is recorded for this game ID.</p>}
      {state.data?.run && !state.data.rootNode && <p className="notice">The latest completed run has no scenario nodes to display.</p>}
      {state.data?.rootNode && <MaxSimTree rootNode={state.data.rootNode} />}
    </>
  );
}
