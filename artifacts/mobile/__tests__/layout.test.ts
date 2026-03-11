import { describe, it, expect } from "vitest";

function computeAutoLayout(
  nodeCount: number,
  cx = 250,
  cy = 300
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  if (nodeCount <= 0) return positions;

  if (nodeCount <= 1) {
    positions.push({ x: cx, y: cy });
    return positions;
  }

  const innerCount = Math.min(nodeCount - 1, 7);
  const outerCount = Math.max(0, nodeCount - 1 - innerCount);
  positions.push({ x: cx, y: cy });

  for (let i = 0; i < innerCount; i++) {
    const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2;
    positions.push({
      x: cx + 160 * Math.cos(angle),
      y: cy + 160 * Math.sin(angle),
    });
  }

  for (let i = 0; i < outerCount; i++) {
    const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2;
    positions.push({
      x: cx + 290 * Math.cos(angle),
      y: cy + 290 * Math.sin(angle),
    });
  }

  return positions;
}

function fitToViewCalc(
  nodePositions: Array<{ x: number; y: number }>,
  viewW = 400,
  viewH = 600,
  pad = 60
): { scale: number; panX: number; panY: number } | null {
  if (nodePositions.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of nodePositions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const cw = maxX - minX;
  const ch = maxY - minY;
  const scale = Math.min(viewW / cw, viewH / ch, 2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    scale,
    panX: viewW / 2 - cx * scale,
    panY: viewH / 2 - cy * scale,
  };
}

function centerOnNode(
  pos: { x: number; y: number },
  currentScale: number,
  viewW = 400,
  viewH = 600
): { scale: number; panX: number; panY: number } {
  const sc = Math.max(currentScale, 1);
  return {
    scale: sc,
    panX: viewW / 2 - pos.x * sc,
    panY: viewH / 2 - pos.y * sc,
  };
}

function edgeCurveGeometry(
  x1: number, y1: number,
  x2: number, y2: number,
  scale: number,
  panX: number, panY: number,
  nodeRadius = 34
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const ux = dx / len, uy = dy / len;
  const r = nodeRadius * scale;
  const ex1 = x1 * scale + panX + r * ux;
  const ey1 = y1 * scale + panY + r * uy;
  const ex2 = x2 * scale + panX - r * ux;
  const ey2 = y2 * scale + panY - r * uy;
  const screenLen = Math.sqrt((ex2 - ex1) ** 2 + (ey2 - ey1) ** 2);
  const curvature = Math.min(55, screenLen * 0.2);
  const mx = (ex1 + ex2) / 2;
  const my = (ey1 + ey2) / 2;
  const cpx = mx - uy * curvature;
  const cpy = my + ux * curvature;

  return { ex1, ey1, ex2, ey2, cpx, cpy, mx, my, curvature };
}

describe("Auto-layout", () => {
  it("returns empty for 0 nodes", () => {
    expect(computeAutoLayout(0)).toEqual([]);
  });

  it("places single node at center", () => {
    const pos = computeAutoLayout(1);
    expect(pos).toHaveLength(1);
    expect(pos[0]).toEqual({ x: 250, y: 300 });
  });

  it("places 2 nodes: center + 1 on inner ring", () => {
    const pos = computeAutoLayout(2);
    expect(pos).toHaveLength(2);
    expect(pos[0]).toEqual({ x: 250, y: 300 });
    expect(pos[1].x).toBeCloseTo(250, 0);
    expect(pos[1].y).toBeCloseTo(140, 0);
  });

  it("places 8 nodes: center + 7 inner ring", () => {
    const pos = computeAutoLayout(8);
    expect(pos).toHaveLength(8);
    const innerRing = pos.slice(1);
    for (const p of innerRing) {
      const dist = Math.sqrt((p.x - 250) ** 2 + (p.y - 300) ** 2);
      expect(dist).toBeCloseTo(160, 0);
    }
  });

  it("places 9+ nodes: center + 7 inner + outer ring", () => {
    const pos = computeAutoLayout(9);
    expect(pos).toHaveLength(9);
    const outerNode = pos[8];
    const dist = Math.sqrt((outerNode.x - 250) ** 2 + (outerNode.y - 300) ** 2);
    expect(dist).toBeCloseTo(290, 0);
  });

  it("all positions are unique for 20 nodes", () => {
    const pos = computeAutoLayout(20);
    const unique = new Set(pos.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`));
    expect(unique.size).toBe(20);
  });
});

describe("Fit-to-view", () => {
  it("returns null for empty nodes", () => {
    expect(fitToViewCalc([])).toBeNull();
  });

  it("handles single node", () => {
    const result = fitToViewCalc([{ x: 100, y: 100 }]);
    expect(result).not.toBeNull();
    expect(result!.scale).toBeLessThanOrEqual(2);
    expect(result!.scale).toBeGreaterThan(0);
  });

  it("scales down for very large spread", () => {
    const result = fitToViewCalc([
      { x: -5000, y: -5000 },
      { x: 5000, y: 5000 },
    ], 400, 600);
    expect(result!.scale).toBeLessThan(1);
  });

  it("caps scale at 2 for very small spread", () => {
    const result = fitToViewCalc([
      { x: 100, y: 100 },
      { x: 101, y: 101 },
    ], 400, 600);
    expect(result!.scale).toBe(2);
  });

  it("centers content in viewport", () => {
    const result = fitToViewCalc([
      { x: 0, y: 0 },
      { x: 200, y: 200 },
    ], 400, 600);
    const cx = 100;
    const cy = 100;
    const expectedPanX = 200 - cx * result!.scale;
    const expectedPanY = 300 - cy * result!.scale;
    expect(result!.panX).toBeCloseTo(expectedPanX, 1);
    expect(result!.panY).toBeCloseTo(expectedPanY, 1);
  });
});

describe("Center-on-node", () => {
  it("centers node in viewport", () => {
    const result = centerOnNode({ x: 200, y: 300 }, 1, 400, 600);
    expect(result.panX).toBe(0);
    expect(result.panY).toBe(0);
  });

  it("ensures minimum scale of 1", () => {
    const result = centerOnNode({ x: 100, y: 100 }, 0.3, 400, 600);
    expect(result.scale).toBe(1);
  });

  it("preserves scale when > 1", () => {
    const result = centerOnNode({ x: 100, y: 100 }, 1.5, 400, 600);
    expect(result.scale).toBe(1.5);
  });
});

describe("Edge curve geometry", () => {
  it("returns null for zero-length edge", () => {
    expect(edgeCurveGeometry(100, 100, 100, 100, 1, 0, 0)).toBeNull();
  });

  it("computes valid control points for horizontal edge", () => {
    const result = edgeCurveGeometry(0, 0, 200, 0, 1, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.ex1).toBeLessThan(result!.ex2);
    expect(result!.curvature).toBeGreaterThan(0);
    expect(result!.curvature).toBeLessThanOrEqual(55);
  });

  it("computes valid control points for vertical edge", () => {
    const result = edgeCurveGeometry(0, 0, 0, 200, 1, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.ey1).toBeLessThan(result!.ey2);
  });

  it("accounts for scale", () => {
    const result1 = edgeCurveGeometry(0, 0, 100, 0, 1, 0, 0);
    const result2 = edgeCurveGeometry(0, 0, 100, 0, 2, 0, 0);
    expect(result2!.ex2).toBeGreaterThan(result1!.ex2);
  });

  it("accounts for pan offset", () => {
    const result = edgeCurveGeometry(0, 0, 100, 0, 1, 50, 50);
    expect(result!.ex1).toBeGreaterThan(0);
    expect(result!.ey1).toBeGreaterThan(0);
  });

  it("handles overlapping nodes (very short edge)", () => {
    const result = edgeCurveGeometry(100, 100, 101, 100, 1, 0, 0, 34);
    expect(result).not.toBeNull();
  });

  it("handles huge coordinate spread", () => {
    const result = edgeCurveGeometry(-10000, -10000, 10000, 10000, 0.1, 500, 500);
    expect(result).not.toBeNull();
    expect(isFinite(result!.cpx)).toBe(true);
    expect(isFinite(result!.cpy)).toBe(true);
  });
});
