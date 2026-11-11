import { useState } from "react";
import type { ScenarioNode } from "../../types/maxSim";

const stateLabels: Record<ScenarioNode["outcomeState"], string> = {
  FAVORABLE: "Favourable",
  NEUTRAL: "Neutral",
  CRITICAL_RISK: "Critical risk",
};

function TreeNode({ node }: { node: ScenarioNode }) {
  const [expanded, setExpanded] = useState(true);
  const children = node.children ?? [];
  return (
    <li className="max-sim-tree__item">
      <article className={`max-sim-node max-sim-node--${node.outcomeState.toLowerCase()}`}>
        <div className="max-sim-node__heading">
          <div className="max-sim-node__condition">
            {children.length > 0 && <button type="button" className="max-sim-node__toggle" aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} branches for ${node.condition}`} onClick={() => setExpanded((value) => !value)}>{expanded ? "−" : "+"}</button>}
            <strong>{node.condition}</strong>
          </div>
          <span className="max-sim-node__probability">Probability <strong>{node.probability}%</strong></span>
        </div>
        <dl className="max-sim-node__metrics">
          <div><dt>Impact vector</dt><dd>{node.impactVector}</dd></div>
          <div><dt>Flow delta</dt><dd className={node.flowDelta >= 0 ? "is-positive" : "is-negative"}>{node.flowDelta > 0 ? "+" : ""}{node.flowDelta}%</dd></div>
          <div><dt>Outcome state</dt><dd>{stateLabels[node.outcomeState]}</dd></div>
        </dl>
      </article>
      {expanded && children.length > 0 && <ul className="max-sim-tree">{children.map((child) => <TreeNode key={child.id} node={child} />)}</ul>}
    </li>
  );
}

export function MaxSimTree({ rootNode }: { rootNode: ScenarioNode }) {
  return (
    <section className="panel max-sim-panel">
      <header className="max-sim-panel__header">
        <div><div className="eyebrow">STORED SCENARIO DATA</div><h2>MAX SIM · Scenario branch tree</h2></div>
        <span className="max-sim-badge">COMPLETED RUN</span>
      </header>
      <ul className="max-sim-tree"><TreeNode node={rootNode} /></ul>
      <p className="max-sim-disclaimer">Probabilities and impact vectors are stored simulation outputs, not independently verified forecasts or live game telemetry.</p>
    </section>
  );
}
