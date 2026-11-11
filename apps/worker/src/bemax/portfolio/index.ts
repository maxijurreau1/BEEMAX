export interface PortfolioSnapshot {
  totalProducts: number;
  averageScore: number;
  totalRevenue: number;
  activeProducts: number;
  livingDivisions: number;
  riskCount: number;
  pendingApprovals: number;
  createdAt: string;
}

export class PortfolioService {
  constructor(private readonly env: any) {}

  async getSnapshot(): Promise<PortfolioSnapshot> {
    const { readUniverse } = await import("../../universe-api.js");
    const universe = await readUniverse(this.env);
    const products = universe.products ?? [];

    const approvals = (await this.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM approvals WHERE status = 'pending'`,
    ).first()) as { count: number } | null;

    return {
      totalProducts: products.length,
      averageScore: products.length
        ? Math.round(products.reduce((sum: number, product: any) => sum + (product.score ?? 0), 0) / products.length)
        : 0,
      totalRevenue: products.reduce((sum: number, product: any) => sum + (product.revenue ?? 0), 0),
      activeProducts: products.filter((product: any) => ["Live", "Published", "Ready"].includes(product.stage)).length,
      livingDivisions: universe.divisions?.length ?? 0,
      riskCount: products.filter((product: any) => (product.risk ?? 0) > 0).length,
      pendingApprovals: approvals?.count ?? 0,
      createdAt: new Date().toISOString(),
    };
  }
}
