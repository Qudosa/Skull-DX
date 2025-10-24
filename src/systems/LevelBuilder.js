// src/systems/LevelBuilder.js
// Procedural LevelBuilder with seeded RNG and multiple algorithms.
// Generates a grid (size x size) where 0 = path, 1 = wall, 2 = start, 3 = goal.

class RNG {
  // mulberry32 seeded RNG
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(max) {
    return Math.floor(this.next() * max);
  }
  pick(arr) {
    return arr[this.int(arr.length)];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// sizes list for totalLevels 1..100 based on your table
const SIZES = [
  25,25,25,27,27,27,29,29,29,31,
  31,31,33,33,33,35,35,35,37,37,
  37,39,39,39,41,41,41,43,43,43,
  45,45,45,47,47,47,49,49,49,51,
  51,51,53,53,53,55,55,55,57,57,
  57,59,59,59,61,61,61,63,63,63,
  65,65,65,67,67,67,69,69,69,71,
  71,71,73,73,73,75,75,75,77,77,
  77,79,79,79,81,81,81,83,83,83,
  85,85,85,87,87,87,89,89,89,91
];

// helper: convert realm+level to total index 1..100
function totalLevelFromRealmLevel(realm, level) {
  // realm and level are 1-based; total = (realm-1)*10 + level
  const total = (realm - 1) * 10 + level;
  return Math.max(1, Math.min(100, total));
}

export class LevelBuilder {
  constructor() {
    // map realm -> algorithm mode (0..9)
    // We'll rotate through 10 modes as requested
    this.modeByRealm = [
      'backtracker', // realm1
      'prim',
      'kruskal',
      'huntandkill',
      'aldousbroder',
      'wilson',
      'growingtree_longrooms',
      'growingtree_short',
      'recursive_division',
      'backtracker_sparse' // realm10
    ];
  }

  // main entry
  // options: { seed: number|string, realm: int, level: int }
  generate({ realm = 1, level = 1, seed = Date.now() } = {}) {
    const total = totalLevelFromRealmLevel(realm, level);
    const size = SIZES[total - 1];

    // ensure odd dimensions: convert even to odd
    const N = size % 2 === 1 ? size : size + 1;

    // deterministic numeric seed
    let numericSeed = 0;
    if (typeof seed === 'number') numericSeed = seed | 0;
    else {
      // string seed to number
      for (let i = 0; i < seed.length; i++) {
        numericSeed = (numericSeed * 31 + seed.charCodeAt(i)) | 0;
      }
    }

    // pick algorithm by realm rotation
    const mode = this.modeByRealm[(realm - 1) % this.modeByRealm.length];

    // create RNG instance
    const rng = new RNG(numericSeed ^ (realm * 15485863) ^ (level * 32452843));

    // grid representation: initialize all walls (1)
    // We'll use grid[y][x]
    const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => 1));

    // Start cell coordinates (top-left inner)
    const start = { x: 1, y: 1 };
    const goal = { x: N - 2, y: N - 2 };

    // helper to carve paths
    const carve = (x, y) => (grid[y][x] = 0);

    // carve start cell
    carve(start.x, start.y);

    // implement algorithms (guarantee perfect mazes)
    const algorithms = {
      // Depth-first recursive backtracker
      backtracker: () => {
        const stack = [];
        stack.push(start);
        const dirs = [
          { x: 0, y: -2 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: -2, y: 0 }
        ];
        while (stack.length) {
          const cell = stack[stack.length - 1];
          const neighbors = [];
          for (const d of rng.shuffle(dirs.slice())) {
            const nx = cell.x + d.x;
            const ny = cell.y + d.y;
            if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 1) {
              neighbors.push({ x: nx, y: ny, between: { x: cell.x + d.x / 2, y: cell.y + d.y / 2 } });
            }
          }
          if (neighbors.length === 0) {
            stack.pop();
          } else {
            const n = rng.pick(neighbors);
            carve(n.between.x, n.between.y);
            carve(n.x, n.y);
            stack.push({ x: n.x, y: n.y });
          }
        }
      },

      // Randomized Prim's (growing tree variant)
      prim: () => {
        const frontier = [];
        const addFrontier = (cx, cy) => {
          const dirs = [
            { x: 0, y: -2 },
            { x: 2, y: 0 },
            { x: 0, y: 2 },
            { x: -2, y: 0 }
          ];
          for (const d of dirs) {
            const nx = cx + d.x;
            const ny = cy + d.y;
            if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 1) {
              frontier.push({ x: nx, y: ny, px: cx, py: cy, between: { x: cx + d.x / 2, y: cy + d.y / 2 } });
            }
          }
        };

        addFrontier(start.x, start.y);

        while (frontier.length) {
          const idx = rng.int(frontier.length);
          const f = frontier.splice(idx, 1)[0];
          const { x, y, px, py, between } = f;
          if (grid[y][x] === 1) {
            carve(between.x, between.y);
            carve(x, y);
            addFrontier(x, y);
          }
        }
      },

      // Kruskal (edges between cells)
      kruskal: () => {
        // create disjoint sets for each cell (odd coordinates)
        const cells = [];
        const indexMap = new Map();
        let idx = 0;
        for (let y = 1; y < N; y += 2) {
          for (let x = 1; x < N; x += 2) {
            cells.push({ x, y });
            indexMap.set(`${x},${y}`, idx++);
            carve(x, y);
          }
        }

        // edges between adjacent cells
        const edges = [];
        for (const c of cells) {
          const { x, y } = c;
          if (x + 2 < N) edges.push({ a: `${x},${y}`, b: `${x + 2},${y}`, between: { x: x + 1, y } });
          if (y + 2 < N) edges.push({ a: `${x},${y}`, b: `${x},${y + 2}`, between: { x, y: y + 1 } });
        }

        // disjoint set union
        const parent = new Array(cells.length);
        for (let i = 0; i < parent.length; i++) parent[i] = i;
        function find(i) {
          if (parent[i] === i) return i;
          parent[i] = find(parent[i]);
          return parent[i];
        }
        function union(a, b) {
          const ra = find(a);
          const rb = find(b);
          if (ra === rb) return false;
          parent[rb] = ra;
          return true;
        }

        // shuffle edges
        rng.shuffle(edges);
        for (const e of edges) {
          const ia = indexMap.get(e.a);
          const ib = indexMap.get(e.b);
          if (union(ia, ib)) {
            carve(e.between.x, e.between.y);
          }
        }
      },

      // Hunt-and-Kill
      huntandkill: () => {
        const dirs = [
          { x: 0, y: -2 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: -2, y: 0 }
        ];
        let cx = start.x;
        let cy = start.y;
        carve(cx, cy);
        while (true) {
          // random walk until stuck
          const possible = [];
          for (const d of dirs) {
            const nx = cx + d.x;
            const ny = cy + d.y;
            if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 1) possible.push({ x: nx, y: ny, between: { x: cx + d.x / 2, y: cy + d.y / 2 } });
          }
          if (possible.length) {
            const n = rng.pick(possible);
            carve(n.between.x, n.between.y);
            carve(n.x, n.y);
            cx = n.x;
            cy = n.y;
          } else {
            // hunt for a cell with a visited neighbor
            let found = false;
            for (let y = 1; y < N - 1; y += 2) {
              for (let x = 1; x < N - 1; x += 2) {
                if (grid[y][x] === 1) continue;
                // check neighbors unvisited
                for (const d of dirs) {
                  const nx = x + d.x;
                  const ny = y + d.y;
                  if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 1) {
                    // skip, we look for visited cell adjacent to unvisited
                  }
                }
              }
            }
            // simpler fallback: find any unvisited cell and seed anew
            let seeded = false;
            for (let ry = 1; ry < N - 1 && !seeded; ry += 2) {
              for (let rx = 1; rx < N - 1; rx += 2) {
                if (grid[ry][rx] === 1) {
                  // check visited neighbors
                  const neigh = [];
                  for (const d of dirs) {
                    const nx = rx + d.x;
                    const ny = ry + d.y;
                    if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 0) {
                      neigh.push({ x: nx, y: ny, between: { x: rx + d.x / 2, y: ry + d.y / 2 } });
                    }
                  }
                  if (neigh.length) {
                    const n = rng.pick(neigh);
                    carve(n.between.x, n.between.y);
                    carve(rx, ry);
                    cx = rx;
                    cy = ry;
                    seeded = true;
                    break;
                  }
                }
              }
            }
            if (!seeded) break;
          }
        }
      },

      // Aldous-Broder (random walk)
      aldousbroder: () => {
        let cx = start.x;
        let cy = start.y;
        const dirs = [
          { x: 0, y: -2 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: -2, y: 0 }
        ];
        carve(cx, cy);
        let visited = 1;
        const totalCells = Math.ceil(N / 2) ** 2;
        while (visited < totalCells) {
          const d = rng.pick(dirs);
          const nx = cx + d.x;
          const ny = cy + d.y;
          if (nx <= 0 || nx >= N - 1 || ny <= 0 || ny >= N - 1) continue;
          if (grid[ny][nx] === 1) {
            carve(cx + d.x / 2, cy + d.y / 2);
            carve(nx, ny);
            visited++;
          }
          cx = nx;
          cy = ny;
        }
      },

      // Wilson's algorithm
      wilson: () => {
        // maintain list of unvisited (odd cells)
        const cells = [];
        for (let y = 1; y < N; y += 2) {
          for (let x = 1; x < N; x += 2) {
            const key = `${x},${y}`;
            cells.push({ x, y });
          }
        }
        // mark the start as in the tree
        const inTree = new Set([`${start.x},${start.y}`]);
        // helper
        const dirs = [
          { x: 0, y: -2 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: -2, y: 0 }
        ];

        const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
        cellSet.delete(`${start.x},${start.y}`);

        while (cellSet.size) {
          // pick random cell not in tree
          const arr = Array.from(cellSet);
          const pickKey = arr[rng.int(arr.length)];
          const [sx, sy] = pickKey.split(',').map(Number);
          // random walk with loop erasure
          const walk = [{ x: sx, y: sy }];
          const seen = new Map();
          seen.set(`${sx},${sy}`, 0);
          while (!inTree.has(`${walk[walk.length - 1].x},${walk[walk.length - 1].y}`)) {
            const cur = walk[walk.length - 1];
            const d = rng.pick(dirs);
            let nx = cur.x + d.x;
            let ny = cur.y + d.y;
            if (nx <= 0 || nx >= N - 1 || ny <= 0 || ny >= N - 1) continue;
            const key = `${nx},${ny}`;
            if (seen.has(key)) {
              // erase loop
              walk.splice(seen.get(key) + 1);
            } else {
              seen.set(key, walk.length);
              walk.push({ x: nx, y: ny });
            }
          }
          // add walk to tree
          for (let i = 0; i < walk.length - 1; i++) {
            const a = walk[i];
            const b = walk[i + 1];
            carve((a.x + b.x) / 2, (a.y + b.y) / 2);
            carve(b.x, b.y);
            inTree.add(`${b.x},${b.y}`);
            cellSet.delete(`${b.x},${b.y}`);
          }
        }
      },

      // Growing Tree variants - different biases to emulate variety
      growingtree_longrooms: () => {
        // favor newest cell (stack) sometimes, but occasionally random (makes long corridors)
        const stack = [];
        stack.push(start);
        const dirs = [
          { x: 0, y: -2 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: -2, y: 0 }
        ];
        while (stack.length) {
          const idx = rng.next() < 0.85 ? stack.length - 1 : rng.int(stack.length);
          const cell = stack[idx];
          const neighbors = [];
          for (const d of rng.shuffle(dirs.slice())) {
            const nx = cell.x + d.x;
            const ny = cell.y + d.y;
            if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 1) {
              neighbors.push({ x: nx, y: ny, between: { x: cell.x + d.x / 2, y: cell.y + d.y / 2 } });
            }
          }
          if (neighbors.length === 0) {
            stack.splice(idx, 1);
          } else {
            const n = rng.pick(neighbors);
            carve(n.between.x, n.between.y);
            carve(n.x, n.y);
            stack.push({ x: n.x, y: n.y });
          }
        }
      },

      growingtree_short: () => {
        // favor random cell (creates short dead ends)
        const list = [];
        list.push(start);
        const dirs = [
          { x: 0, y: -2 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: -2, y: 0 }
        ];
        while (list.length) {
          const idx = rng.int(list.length);
          const cell = list[idx];
          const neighbors = [];
          for (const d of rng.shuffle(dirs.slice())) {
            const nx = cell.x + d.x;
            const ny = cell.y + d.y;
            if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && grid[ny][nx] === 1) {
              neighbors.push({ x: nx, y: ny, between: { x: cell.x + d.x / 2, y: cell.y + d.y / 2 } });
            }
          }
          if (neighbors.length === 0) {
            list.splice(idx, 1);
          } else {
            const n = rng.pick(neighbors);
            carve(n.between.x, n.between.y);
            carve(n.x, n.y);
            list.push({ x: n.x, y: n.y });
          }
        }
      },

      // Recursive division - creates roomy mazes (not strictly perfect corridors but we'll adapt)
      recursive_division: () => {
        // start with empty area and recursively add walls with a single passage
        for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) grid[y][x] = 0;

        function divide(x1, y1, x2, y2) {
          const w = x2 - x1;
          const h = y2 - y1;
          if (w < 2 || h < 2) return;
          const vertical = w > h ? true : w < h ? false : rng.next() > 0.5;
          if (vertical) {
            // choose a wall column at even x
            let wx = x1 + 1 + Math.floor(rng.next() * ((w - 1) / 2)) * 2;
            for (let y = y1; y <= y2; y++) grid[y][wx] = 1;
            // make a single hole at odd y
            const holeY = y1 + Math.floor(rng.next() * ((h + 1) / 2)) * 2 + 1;
            grid[holeY][wx] = 0;
            divide(x1, y1, wx - 1, y2);
            divide(wx + 1, y1, x2, y2);
          } else {
            let wy = y1 + 1 + Math.floor(rng.next() * ((h - 1) / 2)) * 2;
            for (let x = x1; x <= x2; x++) grid[wy][x] = 1;
            const holeX = x1 + Math.floor(rng.next() * ((w + 1) / 2)) * 2 + 1;
            grid[wy][holeX] = 0;
            divide(x1, y1, x2, wy - 1);
            divide(x1, wy + 1, x2, y2);
          }
        }

        divide(1, 1, N - 2, N - 2);
        // ensure start and goal are open
        carve(start.x, start.y);
        carve(goal.x, goal.y);
      },

      // fallback
      fallback: () => {
        algorithms.backtracker();
      }
    };

    // pick algorithm function
    let fn = algorithms[mode] || algorithms.fallback;
    // run chosen algorithm
    try {
      fn();
    } catch (e) {
      // fallback gracefully
      console.warn('LevelBuilder algorithm error, falling back to backtracker', e);
      algorithms.backtracker();
    }

    // ensure borders are walls
    for (let x = 0; x < N; x++) {
      grid[0][x] = 1;
      grid[N - 1][x] = 1;
    }
    for (let y = 0; y < N; y++) {
      grid[y][0] = 1;
      grid[y][N - 1] = 1;
    }

    // mark start and goal explicitly
    grid[start.y][start.x] = 2;
    grid[goal.y][goal.x] = 3;

    return {
      grid,
      width: N,
      height: N,
      start,
      goal,
      totalLevel: total,
      realm,
      level,
      seed: numericSeed,
      mode
    };
  }
}
