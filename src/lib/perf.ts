/**
 * Performance monitoring and budget enforcement utilities.
 *
 * Provides deterministic timing measurements, structured logging,
 * and graph quality metrics for layout and formula evaluation.
 */

export interface PerfEvent {
  type: 'perf:layout' | 'perf:reorg' | 'perf:formula' | 'perf:graph-quality';
  timestamp: number;
  duration?: number;
  data: Record<string, unknown>;
}

export interface LayoutMetrics {
  nodeCount: number;
  edgeCount: number;
  layoutMode: string;
  direction: string;
  seed?: number;
  duration: number;
  timestamp: number;
}

export interface GraphQualityMetrics {
  nodeOverlaps: number;
  edgeCrossings: number;
  avgEdgeLength: number;
  edgeLengthVariance: number;
  pinnedNodesPreserved: boolean;
  seed?: number;
}

export interface FormulaCacheMetrics {
  evaluations: number;
  duration: number;
  cacheHits?: number;
  cacheMisses?: number;
  cacheHitRate?: number;
}

/**
 * Simple performance logger that emits structured events.
 * Can be disabled via DEBUG environment variable or localStorage.
 */
export class PerfLogger {
  private enabled: boolean;
  private events: PerfEvent[] = [];

  constructor() {
    // Enable in development or when DEBUG is set
    this.enabled =
      (typeof import.meta.env !== 'undefined' && import.meta.env.DEV) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('TANGLE_DEBUG_PERF') === 'true');
  }

  start(type: PerfEvent['type'], data: Record<string, unknown> = {}): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();
    const startEvent: PerfEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    return () => {
      const duration = performance.now() - startTime;
      const endEvent: PerfEvent = {
        ...startEvent,
        duration,
      };
      this.events.push(endEvent);

      if (this.enabled) {
        console.log(`[${type}]`, { duration: `${duration.toFixed(2)}ms`, ...data });
      }
    };
  }

  log(type: PerfEvent['type'], data: Record<string, unknown>): void {
    if (!this.enabled) return;

    const event: PerfEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.events.push(event);
    console.log(`[${type}]`, data);
  }

  getEvents(): PerfEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  export(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      events: this.events,
    }, null, 2);
  }
}

// Global instance
export const perfLogger = new PerfLogger();

/**
 * Calculate graph quality metrics from node positions and edges.
 */
export function calculateGraphQuality(
  nodes: Array<{ id: string; position: { x: number; y: number }; data?: { width?: number; height?: number } }>,
  edges: Array<{ source: string; target: string }>,
  seed?: number,
): GraphQualityMetrics {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeW = 190;
  const nodeH = 88;

  // Check for node overlaps
  let overlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];
      const dx = Math.abs(n1.position.x - n2.position.x);
      const dy = Math.abs(n1.position.y - n2.position.y);

      if (dx < nodeW && dy < nodeH) {
        overlaps++;
      }
    }
  }

  // Calculate edge crossings (simple O(n²) check)
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i];
      const e2 = edges[j];

      const n1a = nodeMap.get(e1.source);
      const n1b = nodeMap.get(e1.target);
      const n2a = nodeMap.get(e2.source);
      const n2b = nodeMap.get(e2.target);

      if (!n1a || !n1b || !n2a || !n2b) continue;

      // Check if edges intersect
      if (edgesIntersect(
        n1a.position.x, n1a.position.y,
        n1b.position.x, n1b.position.y,
        n2a.position.x, n2a.position.y,
        n2b.position.x, n2b.position.y,
      )) {
        crossings++;
      }
    }
  }

  // Calculate edge lengths
  const edgeLengths: number[] = [];
  for (const edge of edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const dx = src.position.x - tgt.position.x;
    const dy = src.position.y - tgt.position.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    edgeLengths.push(length);
  }

  const avgEdgeLength = edgeLengths.length > 0
    ? edgeLengths.reduce((a, b) => a + b, 0) / edgeLengths.length
    : 0;

  const edgeLengthVariance = edgeLengths.length > 0
    ? edgeLengths.reduce((sum, len) => sum + Math.pow(len - avgEdgeLength, 2), 0) / edgeLengths.length
    : 0;

  return {
    nodeOverlaps: overlaps,
    edgeCrossings: crossings,
    avgEdgeLength,
    edgeLengthVariance,
    pinnedNodesPreserved: true, // Placeholder - would need pinned node tracking
    seed,
  };
}

/**
 * Check if two line segments intersect.
 */
function edgesIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): boolean {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return false; // Parallel or coincident

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Hash a graph structure for deterministic seed generation.
 * Combines node count, edge count, and a sample of node/edge IDs.
 */
export function hashGraph(
  nodes: Array<{ id: string }>,
  edges: Array<{ id: string }>,
): number {
  let hash = 0;

  // Mix in counts
  hash = (hash * 31 + nodes.length) | 0;
  hash = (hash * 31 + edges.length) | 0;

  // Mix in a sample of IDs (first 10 nodes and edges)
  const sampleNodes = nodes.slice(0, 10);
  const sampleEdges = edges.slice(0, 10);

  for (const node of sampleNodes) {
    for (let i = 0; i < node.id.length; i++) {
      hash = (hash * 31 + node.id.charCodeAt(i)) | 0;
    }
  }

  for (const edge of sampleEdges) {
    for (let i = 0; i < edge.id.length; i++) {
      hash = (hash * 31 + edge.id.charCodeAt(i)) | 0;
    }
  }

  // Ensure positive
  return Math.abs(hash);
}
