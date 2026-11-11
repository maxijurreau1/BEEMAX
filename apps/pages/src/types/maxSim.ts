export type ScenarioOutcome = "FAVORABLE" | "NEUTRAL" | "CRITICAL_RISK";

export interface ScenarioNode {
  id: string;
  condition: string;
  probability: number;
  impactVector: string;
  flowDelta: number;
  outcomeState: ScenarioOutcome;
  children?: ScenarioNode[];
}

export interface MaxSimRun {
  id: string;
  gameId: string;
  sport: string;
  baselineWinProb: number;
  createdAt: string;
}

export interface MaxSimResponse {
  run: MaxSimRun | null;
  rootNode: ScenarioNode | null;
}
