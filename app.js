const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
const TC0 = "#d7301f",
  TC1 = "#2f5fd0",
  newG = () => ({
    n: 1,
    names: {},
    colors: {},
    cg: {},
    tcol: { a: TC0, b: TC1, o: {} },
    appearance: {
      nameSize: 13,
      lineWidth: 1.1,
      ringSpacing: 80,
      hideTierNumbers: false,
    },
  }),
  RES = 1,
  DELAY = 1800,
  MAXT = 12,
  ROM = "h",
  BRK = "b",
  DEF = ["", "", "", "", ""],
  PAL = [
    "#0072B2",
    "#E69F00",
    "#009E73",
    "#CC79A7",
    "#D55E00",
    "#56B4E9",
    "#7b5ea7",
  ];
const HEART =
  '<svg class="ic" viewBox="-12 -12 24 24"><path d="M0 8.1C-14.4-.9-7.2-10.8 0-4.5C7.2-10.8 14.4-.9 0 8.1Z" fill="currentColor"/></svg>';
const BROKEN = HEART.replace(
  "</svg>",
  '<path d="M0-4.5L-3.2-.5L2.7 2.3L-.9 8.1" fill="none" stroke="var(--pn)" stroke-width="1.8"/></svg>',
);
let RAD = [];
const R = (tier) => {
  if (tier <= 0) return 0;
  const lowerTier = Math.floor(tier);
  const fraction = tier - lowerTier;
  const lowerRadius =
    lowerTier === 0
      ? 0
      : RAD[lowerTier] || 90 + G.appearance.ringSpacing * (lowerTier - 1);
  const upperRadius =
    RAD[lowerTier + 1] || lowerRadius + G.appearance.ringSpacing;
  return lowerRadius + fraction * (upperRadius - lowerRadius);
};
// Shared app state. S holds people and links; G holds group metadata and settings.
let S = { people: [], links: [] },
  G = newG(),
  tiers = DEF.slice(),
  prev = {},
  groups = {},
  gOf = {},
  nodes = [],
  byId = {},
  links = [];
let ctr = "you",
  userView = false,
  sel = null,
  selectedPeople = new Set(),
  lv = null,
  linkMode = false,
  linkFrom = null,
  moving = null,
  intro = false,
  dirty = false,
  tab = "People",
  T = d3.zoomIdentity,
  W = 0,
  H = 0,
  first = true,
  dg = null,
  skipClick = false,
  step = 0,
  revealedOnboardingTiers = 0,
  buf = [[], [], []],
  busy = false,
  onboardingRingFade = null;
const uid = () => "p" + Math.random().toString(36).slice(2, 8),
  nm = (id) =>
    id === "you"
      ? "You"
      : (S.people.find((p) => p.id === id) || {}).name || "?";
const getL = (a, b) =>
  S.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
const ensureTiers = (n) => {
  while (tiers.length < Math.ceil(n)) tiers.push("");
};

/* ---------- dialogs ---------- */
function ask(msg, btns = ["OK"]) {
  return new Promise((res) => {
    const d = $("#dl");
    d.innerHTML = `<div><p>${msg}</p><div class="br">${btns.map((b, i) => `<button data-i="${i}"${i === btns.length - 1 ? ' class="p"' : ""}>${esc(b)}</button>`).join("")}</div></div>`;
    d.style.display = "flex";
    d.onclick = (e) => {
      const i = e.target.dataset.i;
      if (i == null) return;
      d.style.display = "none";
      res(+i);
    };
  });
}

/* ---------- persistence ---------- */
function save() {
  try {
    localStorage.setItem(
      "todo-circles",
      JSON.stringify({
        v: 2,
        S,
        G,
        tiers,
        P: Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, [...v]]),
        ),
      }),
    );
  } catch (e) {}
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem("todo-circles"));
    if (!d || !d.S || !d.S.people.length) return false;
    S = d.S;
    G = Object.assign(newG(), d.G);
    delete G.groupOrder;
    tiers = d.tiers || DEF.slice();
    if (!d.v)
      S.links.forEach((l) => {
        if (l.t === 0) l.t = ROM;
        else if (l.t === 6) l.t = BRK;
      });
    prev = Object.fromEntries(
      Object.entries(d.P || {}).map(([k, v]) => [k, new Set(v)]),
    );
    return true;
  } catch (e) {
    return false;
  }
}

// Move people between communities, then aggregate the graph and repeat.
function louvain(personIds, edgeWeights) {
  const communityByPerson = {};
  personIds.forEach((personId) => (communityByPerson[personId] = personId));

  let graph = edgeWeights;
  let graphNodeIds = personIds.slice();

  for (let level = 0; level < 8; level++) {
    const degreeByNode = {};
    const totalWeightByCommunity = {};
    const communityByNode = {};
    let totalEdgeWeight = 0;
    let movedAnyNode = false;

    graphNodeIds.forEach((nodeId) => {
      communityByNode[nodeId] = nodeId;
      degreeByNode[nodeId] = Object.values(graph[nodeId]).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      totalEdgeWeight += degreeByNode[nodeId];
      totalWeightByCommunity[nodeId] = degreeByNode[nodeId];
    });
    if (!totalEdgeWeight) break;

    for (let iteration = 0; iteration < 10; iteration++) {
      let movedThisIteration = false;
      for (const nodeId of graphNodeIds) {
        const currentCommunity = communityByNode[nodeId];
        const neighboringWeightByCommunity = {};

        for (const neighborId in graph[nodeId]) {
          if (neighborId === nodeId) continue;
          const neighborCommunity = communityByNode[neighborId];
          neighboringWeightByCommunity[neighborCommunity] =
            (neighboringWeightByCommunity[neighborCommunity] || 0) +
            graph[nodeId][neighborId];
        }

        totalWeightByCommunity[currentCommunity] -= degreeByNode[nodeId];
        let bestCommunity = currentCommunity;
        let bestGain =
          (neighboringWeightByCommunity[currentCommunity] || 0) -
          (RES *
            totalWeightByCommunity[currentCommunity] *
            degreeByNode[nodeId]) /
            totalEdgeWeight;

        for (const candidateCommunity in neighboringWeightByCommunity) {
          const gain =
            neighboringWeightByCommunity[candidateCommunity] -
            (RES *
              totalWeightByCommunity[candidateCommunity] *
              degreeByNode[nodeId]) /
              totalEdgeWeight;
          if (gain > bestGain + 1e-9) {
            bestGain = gain;
            bestCommunity = candidateCommunity;
          }
        }

        totalWeightByCommunity[bestCommunity] += degreeByNode[nodeId];
        if (bestCommunity !== currentCommunity) {
          communityByNode[nodeId] = bestCommunity;
          movedThisIteration = true;
          movedAnyNode = true;
        }
      }
      if (!movedThisIteration) break;
    }

    if (!movedAnyNode) break;
    for (const personId of personIds) {
      communityByPerson[personId] =
        communityByNode[communityByPerson[personId]];
    }

    const aggregatedWeights = {};
    graphNodeIds = [...new Set(Object.values(communityByNode))];
    graphNodeIds.forEach(
      (communityId) => (aggregatedWeights[communityId] = {}),
    );
    for (const sourceId in graph) {
      for (const targetId in graph[sourceId]) {
        const sourceCommunity = communityByNode[sourceId];
        const targetCommunity = communityByNode[targetId];
        aggregatedWeights[sourceCommunity][targetCommunity] =
          (aggregatedWeights[sourceCommunity][targetCommunity] || 0) +
          graph[sourceId][targetId];
      }
    }
    graph = aggregatedWeights;
  }
  return communityByPerson;
}
/* ---------- grouping: Louvain local-moving on person-to-person ties (You excluded, broken-up ties ignored) ---------- */
// A real friend group is a cluster where most members know each other (not necessarily all).
// Louvain finds dense clusters (closer ties count much more); then anyone who knows too few of the rest is dropped.
const MIN_INTRA_GROUP_TIE_FRACTION = 0.3,
  MIN_CROSS_GROUP_DENSITY = 0.5;
// two clusters whose members mostly know each other across the divide (counting only reasonably close ties) are really one group
function mergeDense(clusters, neighbors) {
  clusters = clusters.map((cluster) => cluster.slice());
  for (;;) {
    let highestDensity = 0;
    let firstClusterIndex = -1;
    let secondClusterIndex = -1;
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) {
        const secondClusterMembers = new Set(clusters[j]);
        let sharedTies = 0;
        clusters[i].forEach((personId) =>
          neighbors[personId].forEach((neighborId) => {
            if (secondClusterMembers.has(neighborId)) sharedTies++;
          }),
        );
        const crossGroupDensity =
          sharedTies / (clusters[i].length * clusters[j].length);
        if (crossGroupDensity > highestDensity) {
          highestDensity = crossGroupDensity;
          firstClusterIndex = i;
          secondClusterIndex = j;
        }
      }
    if (highestDensity < MIN_CROSS_GROUP_DENSITY) return clusters;
    clusters[firstClusterIndex] = clusters[firstClusterIndex].concat(
      clusters[secondClusterIndex],
    );
    clusters.splice(secondClusterIndex, 1);
  }
}
function refine(clusters, neighbors) {
  return clusters.map((cluster) => {
    let members = cluster.slice();
    while (members.length >= 3) {
      const currentMembers = new Set(members);
      let weakestMember = null;
      let weakestTieFraction = 1;
      members.forEach((personId) => {
        const tieFraction =
          [...neighbors[personId]].filter((neighborId) =>
            currentMembers.has(neighborId),
          ).length /
          (members.length - 1);
        if (tieFraction < weakestTieFraction) {
          weakestTieFraction = tieFraction;
          weakestMember = personId;
        }
      });
      if (weakestTieFraction >= MIN_INTRA_GROUP_TIE_FRACTION) break;
      members = members.filter((personId) => personId !== weakestMember);
    }
    return members;
  });
}
// p.g is the primary group override; p.gs stores additional manual group memberships.
const override = (p) => (p.g && (p.g === "-" || G.cg[p.g]) ? p.g : null);
function detect() {
  const personIds = S.people.map((person) => person.id);
  const tierCount = tiers.length;
  const tieWeights = {};
  const neighbors = {};
  const closeNeighbors = {};
  const peopleById = Object.fromEntries(
    S.people.map((person) => [person.id, person]),
  );
  personIds.forEach((personId) => {
    tieWeights[personId] = {};
    neighbors[personId] = new Set();
    closeNeighbors[personId] = new Set();
  });
  S.links.forEach((link) => {
    if (
      typeof link.t !== "number" ||
      !tieWeights[link.a] ||
      !tieWeights[link.b]
    )
      return;
    const weight = Math.max(1, tierCount + 1 - link.t) ** 2;
    tieWeights[link.a][link.b] = weight;
    tieWeights[link.b][link.a] = weight;
    neighbors[link.a].add(link.b);
    neighbors[link.b].add(link.a);
    if (link.t <= Math.max(2, tierCount - 2)) {
      closeNeighbors[link.a].add(link.b);
      closeNeighbors[link.b].add(link.a);
    }
  });
  const automaticGroups = {};
  if (personIds.some((personId) => Object.keys(tieWeights[personId]).length)) {
    const communityByPerson = louvain(personIds, tieWeights);
    const communities = {};
    const previouslyMatchedGroups = new Set();
    personIds.forEach((personId) => {
      const communityId = communityByPerson[personId];
      (communities[communityId] = communities[communityId] || []).push(
        personId,
      );
    });
    refine(
      mergeDense(Object.values(communities), closeNeighbors).filter(
        (members) => members.length > 1,
      ),
      neighbors,
    )
      .filter((members) => members.length > 1)
      .sort((first, second) => second.length - first.length)
      .forEach((members) => {
        let bestPreviousGroupId = null;
        let bestOverlap = 0.3;
        for (const previousGroupId in prev) {
          if (previouslyMatchedGroups.has(previousGroupId)) continue;
          const previousMembers = prev[previousGroupId];
          const overlapCount = members.filter((id) =>
            previousMembers.has(id),
          ).length;
          const overlap =
            overlapCount /
            (members.length + previousMembers.size - overlapCount);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestPreviousGroupId = previousGroupId;
          }
        }
        if (!bestPreviousGroupId) {
          const groupNumber = G.n++;
          bestPreviousGroupId = "g" + groupNumber;
          G.names[bestPreviousGroupId] = "Group " + groupNumber;
        }
        previouslyMatchedGroups.add(bestPreviousGroupId);
        automaticGroups[bestPreviousGroupId] = new Set(members);
      });
  }
  prev = automaticGroups;
  groups = {};
  gOf = {};
  const addPersonToGroup = (personId, groupId, primary = true) => {
    (groups[groupId] = groups[groupId] || new Set()).add(personId);
    if (primary) gOf[personId] = groupId;
  };
  S.people.forEach((person) => {
    const groupOverride = override(person);
    if (groupOverride && groupOverride !== "-")
      addPersonToGroup(person.id, groupOverride);
  });
  for (const groupId in automaticGroups) {
    const members = [...automaticGroups[groupId]].filter(
      (personId) => !override(peopleById[personId]),
    );
    if (members.length > 1) {
      members.forEach((personId) => addPersonToGroup(personId, groupId));
    }
  }
  S.people.forEach((person) => {
    (person.gs || []).forEach((groupId) => {
      if (G.cg[groupId] && groupId !== gOf[person.id])
        addPersonToGroup(person.id, groupId, false);
    });
  });
}
// editing an automatic group turns it into a manual (locked) one so it stays as you set it
function lockGroup(g) {
  if (G.cg[g]) return g;
  const n = G.n++,
    c = "c" + n;
  G.cg[c] = 1;
  G.names[c] = G.names[g];
  G.colors[c] = gcol(g);
  (groups[g] || []).forEach((id) => {
    S.people.find((p) => p.id === id).g = c;
  });
  return c;
}
const gcol = (g) => G.colors[g] || PAL[(+g.slice(1) - 1) % PAL.length];
/* ---------- layout ---------- */
const sim = d3
  .forceSimulation()
  .force(
    "link",
    d3
      .forceLink()
      .distance(
        (l) =>
          (45 + l.t * 32) *
          (gOf[l.source.id] && gOf[l.source.id] === gOf[l.target.id]
            ? 0.85
            : 1),
      )
      .strength((l) => Math.max(0.08, 0.7 - 0.12 * l.t)),
  )
  .force("charge", d3.forceManyBody().strength(-160))
  .force("lbl", labelForce)
  .force("rad", d3.forceRadial(0, 0, 0))
  .force("grp", groupForce)
  .force(
    "x",
    d3.forceX().strength((n) => (n.tier ? 0 : 0.012)),
  )
  .force(
    "y",
    d3.forceY().strength((n) => (n.tier ? 0 : 0.012)),
  )
  .on("tick", draw)
  .on("end", autoFit);
// pulls members of a detected group toward their shared centre, so a group clusters even when not everyone is linked to everyone
function groupForce(a) {
  const c = {};
  for (const n of nodes) {
    const g = gOf[n.id];
    if (!g) continue;
    const o = c[g] || (c[g] = { x: 0, y: 0, k: 0 });
    o.x += n.x;
    o.y += n.y;
    o.k++;
  }
  for (const n of nodes) {
    const g = gOf[n.id];
    if (!g || n.fx != null) continue;
    const o = c[g];
    n.vx += (o.x / o.k - n.x) * 0.1 * a;
    n.vy += (o.y / o.k - n.y) * 0.1 * a;
  }
}
// ring radii grow with the number of people in a tier, so crowded tiers get more room
function radii(countByTier) {
  const firstRadius = Math.max(90, ((countByTier[1] || 0) * 85) / 6.283);
  let crowdingSpacing = 0;
  for (let tier = 2; tier <= tiers.length; tier++) {
    const crowdedRadius = ((countByTier[tier] || 0) * 85) / 6.283;
    crowdingSpacing = Math.max(
      crowdingSpacing,
      (crowdedRadius - firstRadius) / (tier - 1),
    );
  }
  const uniformSpacing = Math.max(G.appearance.ringSpacing, crowdingSpacing);
  const out = [0];
  for (let tier = 1; tier <= tiers.length; tier++) {
    out[tier] = firstRadius + uniformSpacing * (tier - 1);
  }
  return out;
}
// keep name labels from overlapping (rectangles, not circles)
function labelForce(a) {
  const k = Math.min(1, 0.25 + a);
  const labelHeight = G.appearance.nameSize * 2;
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const q = nodes[j],
        ox = (p.hw || 30) + (q.hw || 30) - Math.abs(p.x - q.x),
        oy = labelHeight - Math.abs(p.y - q.y);
      if (ox <= 0 || oy <= 0) continue;
      if (oy <= ox) {
        const d = (p.y <= q.y ? 1 : -1) * oy * 0.5 * k;
        p.vy -= d;
        q.vy += d;
      } else {
        const d = (p.x <= q.x ? 1 : -1) * ox * 0.5 * k;
        p.vx -= d;
        q.vx += d;
      }
    }
  }
}
function fit(ms = 500) {
  if (!nodes.length || !W) return;
  userView = false;
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  nodes.forEach((n) => {
    x0 = Math.min(x0, n.x - (n.hw || 30));
    x1 = Math.max(x1, n.x + (n.hw || 30));
    y0 = Math.min(y0, n.y - 20);
    y1 = Math.max(y1, n.y + 20);
  });
  const k = Math.max(
    0.2,
    Math.min(1.5, 0.9 * Math.min(W / (x1 - x0 || 1), H / (y1 - y0 || 1))),
  );
  view(W / 2 - (k * (x0 + x1)) / 2, H / 2 - (k * (y0 + y1)) / 2, k, ms);
}
function autoFit() {
  if (!userView && !document.body.classList.contains("onb")) fit(400);
}
const relOf = (a, b) => {
  if (a === "you" || b === "you") {
    const p = S.people.find((p) => p.id === (a === "you" ? b : a));
    return p && p.tier != null ? p.tier : null;
  }
  const l = getL(a, b);
  return l ? l.t : null;
};
// the map is drawn from the centre person's point of view; by default that is You
function rebuild() {
  if (ctr !== "you" && !S.people.some((p) => p.id === ctr)) ctr = "you";
  const E = [
      ...S.links.map((l) => ({ a: l.a, b: l.b, t: l.t })),
      ...S.people
        .filter((p) => p.tier != null)
        .map((p) => ({ a: "you", b: p.id, t: p.tier })),
    ],
    relC = {},
    cnt = {};
  E.forEach((e) => {
    if (e.a === ctr || e.b === ctr) {
      const o = e.a === ctr ? e.b : e.a;
      relC[o] = e.t;
      if (typeof e.t === "number") {
        const colorTier = Math.max(1, Math.floor(e.t));
        cnt[colorTier] = (cnt[colorTier] || 0) + 1;
      }
    }
  });
  RAD = radii(cnt);
  const old = new Map(nodes.map((n) => [n.id, n])),
    pm = Object.fromEntries(S.people.map((p) => [p.id, p]));
  nodes = ["you", ...S.people.map((p) => p.id)].map((id) => {
    let n = old.get(id);
    const t = relC[id],
      num = typeof t === "number";
    if (!n) {
      const r = num ? R(t) : 300,
        a = Math.random() * 6.28;
      n = { id, x: r * Math.cos(a), y: r * Math.sin(a) };
    }
    n.name = id === "you" ? "You" : pm[id].name;
    n.rel = t == null ? null : t;
    n.tier = num ? t : null;
    const gp = id !== ctr && pm[id] && getPos(pm[id]);
    if (id === ctr) {
      n.x = n.y = 0;
      n.fx = n.fy = 0;
    } else if (gp) {
      n.x = n.fx = gp[0];
      n.y = n.fy = gp[1];
    } else {
      n.fx = n.fy = null;
    }
    return n;
  });
  byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  links = E.filter(
    (e) => e.a !== ctr && e.b !== ctr && byId[e.a] && byId[e.b],
  ).map((e) => ({ source: byId[e.a], target: byId[e.b], t: e.t }));
  detect();
  sim.nodes(nodes);
  sim.force("link").links(links.filter((l) => typeof l.t === "number"));
  sim
    .force("rad")
    .radius((n) => (n.tier ? R(n.tier) : 0))
    .strength((n) => (n.tier ? 0.1 : 0));
  sim.alpha(0.7).restart();
}
function setCenter(id) {
  ctr = id;
  sel = null;
  selectedPeople.clear();
  lv = null;
  moving = null;
  linkFrom = null;
  rebuild();
  sim.alpha(1).restart();
  userView = false;
  view(W / 2, H / 2, T.k, 500);
  vbar();
  render();
  banner();
  draw();
}
function vbar() {
  const b = $("#vb");
  b.style.display = ctr === "you" ? "none" : "";
  b.textContent = "Centered on " + nm(ctr) + " · back to You";
}
function commit() {
  rebuild();
  save();
  dirty = true;
  render();
  banner();
  vbar();
}
// fixed positions are remembered per centre person ('you' uses p.px/p.py, which is what the CSV stores)
const getPos = (p) =>
  ctr === "you"
    ? p.px != null
      ? [p.px, p.py]
      : null
    : (p.pos && p.pos[ctr]) || null;
const setPos = (p, x, y) => {
  if (ctr === "you") {
    p.px = x;
    p.py = y;
  } else {
    (p.pos = p.pos || {})[ctr] = [x, y];
  }
};
const clearPos = (p) => {
  if (ctr === "you") {
    delete p.px;
    delete p.py;
  } else if (p.pos) delete p.pos[ctr];
};
function fixPerson(id, x, y) {
  const p = S.people.find((p) => p.id === id),
    n = byId[id];
  if (!p || !n) return;
  setPos(p, x, y);
  n.x = n.fx = x;
  n.y = n.fy = y;
  save();
  dirty = true;
  render();
  draw();
}
function relax(id) {
  const p = S.people.find((p) => p.id === id),
    n = byId[id];
  if (!p || !n) return;
  clearPos(p);
  n.fx = n.fy = null;
  save();
  dirty = true;
  render();
  sim.alpha(0.4).restart();
}
function shuffleSetup() {
  if (!S.people.length) return;
  S.people.forEach(clearPos);
  nodes.forEach((node) => {
    if (node.id === ctr) return;
    const angle = Math.random() * Math.PI * 2;
    const radius =
      typeof node.tier === "number" ? R(node.tier) : 220 + Math.random() * 120;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
    node.vx = 0;
    node.vy = 0;
    node.fx = null;
    node.fy = null;
  });
  userView = false;
  save();
  dirty = true;
  render();
  sim.alpha(1).restart();
  draw();
}
function setLink(a, b, t) {
  if (a === "you" || b === "you") {
    const p = S.people.find((p) => p.id === (a === "you" ? b : a));
    if (p) p.tier = t;
  } else {
    const l = getL(a, b);
    if (t == null) S.links = S.links.filter((x) => x !== l);
    else if (l) l.t = t;
    else S.links.push({ a, b, t });
  }
  commit();
}

/* ---------- drawing ---------- */
const cv = $("#c"),
  ctx = cv.getContext("2d");
function heart(x, y, s, col, br, bgc) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.6, -s * 0.1, -s * 0.8, -s * 1.2, 0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.8, -s * 1.2, s * 1.6, -s * 0.1, 0, s * 0.9);
  ctx.fillStyle = col;
  ctx.fill();
  if (br) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(-s * 0.35, -s * 0.05);
    ctx.lineTo(s * 0.3, s * 0.25);
    ctx.lineTo(-s * 0.1, s * 0.9);
    ctx.strokeStyle = bgc;
    ctx.lineWidth = Math.max(1, G.appearance.lineWidth * 1.45);
    ctx.stroke();
  }
  ctx.restore();
}
// every tier has a colour (default: red = closest … blue = furthest); all lines are thin and gently curved
const tierColor = (t) => {
  const colorTier = Math.max(1, Math.floor(t));
  const overrideColor = d3.color(G.tcol.o[colorTier] || "");
  if (overrideColor) return overrideColor.formatHex();
  const n = tiers.length,
    c = d3.color(
      d3.interpolateLab(
        G.tcol.a,
        G.tcol.b,
      )(n > 1 ? (colorTier - 1) / (n - 1) : 0),
    );
  return (c || d3.color(TC0)).formatHex();
};
function fadeInOnboardingRing(tier) {
  if (!document.body.classList.contains("onb")) return;
  revealedOnboardingTiers = tier;
  onboardingRingFade = {
    tier,
    startedAt: performance.now(),
    framePending: false,
  };
  draw();
}
function edge(a, b, t, tx, mu, hr, bg) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    L = Math.hypot(dx, dy) || 1,
    o = (a.id < b.id ? 0.1 : -0.1) * L,
    cx = (a.x + b.x) / 2 - (dy / L) * o,
    cy = (a.y + b.y) / 2 + (dx / L) * o;
  ctx.lineCap = "round";
  ctx.lineWidth = G.appearance.lineWidth;
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.85;
  if (t === ROM) ctx.strokeStyle = hr;
  else if (t === BRK) {
    ctx.strokeStyle = mu;
    ctx.setLineDash([3, 4]);
  } else ctx.strokeStyle = tierColor(t);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  const mx = (a.x + b.x) / 4 + cx / 2,
    my = (a.y + b.y) / 4 + cy / 2;
  if (t === ROM) heart(mx, my, 9, hr, 0, bg);
  else if (t === BRK) heart(mx, my, 9, tx, 1, bg);
}
function draw() {
  const css = getComputedStyle(document.documentElement),
    v = (n) => css.getPropertyValue(n).trim(),
    tx = v("--tx"),
    mu = v("--mu"),
    ln = v("--ln"),
    bg = v("--bg"),
    ac = v("--ac"),
    hr = v("--hr"),
    d = devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(d * T.k, 0, 0, d * T.k, d * T.x, d * T.y);
  const onboarding = document.body.classList.contains("onb");
  tiers.forEach((name, i) => {
    const t = i + 1;
    if (onboarding && t > revealedOnboardingTiers) return;
    const fadeProgress =
      onboardingRingFade && onboardingRingFade.tier === t
        ? Math.min(1, (performance.now() - onboardingRingFade.startedAt) / 900)
        : 1;
    ctx.beginPath();
    ctx.arc(0, 0, R(t), 0, 6.29);
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = tierColor(t);
    ctx.globalAlpha = 0.6 * fadeProgress;
    ctx.lineWidth = G.appearance.lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
    if (!G.appearance.hideTierNumbers || name) {
      ctx.fillStyle = mu;
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.globalAlpha = fadeProgress;
      ctx.fillText(
        G.appearance.hideTierNumbers ? name : t + (name ? " · " + name : ""),
        0,
        -R(t) - 4,
      );
    }
    ctx.globalAlpha = 1;
  });
  Object.keys(groups).forEach((g) => {
    const pts = [];
    let my = 1e9,
      sx = 0,
      c = 0;
    groups[g].forEach((id) => {
      const n = byId[id];
      if (!n) return;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        pts.push([n.x + 38 * Math.cos(a), n.y + 38 * Math.sin(a)]);
      }
      my = Math.min(my, n.y);
      sx += n.x;
      c++;
    });
    if (pts.length < 3) return;
    const h = d3.polygonHull(pts),
      col = gcol(g);
    if (!h) return;
    const midpoints = h.map((point, index) => {
      const next = h[(index + 1) % h.length];
      return [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
    });
    ctx.beginPath();
    ctx.moveTo(...midpoints[midpoints.length - 1]);
    h.forEach((point, index) =>
      ctx.quadraticCurveTo(
        point[0],
        point[1],
        midpoints[index][0],
        midpoints[index][1],
      ),
    );
    ctx.closePath();
    ctx.fillStyle = col + "24";
    ctx.shadowColor = col + "20";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = col;
    ctx.font = "600 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(G.names[g], sx / c, my - 46);
  });
  nodes.forEach((n) => {
    if (n.rel != null && n.id !== ctr)
      edge(byId[ctr], n, n.rel, tx, mu, hr, bg);
  });
  links.forEach((l) => edge(l.source, l.target, l.t, tx, mu, hr, bg));
  nodes.forEach((n) => {
    const you = n.id === ctr,
      p = S.people.find((p) => p.id === n.id),
      fixed = p && getPos(p),
      col = gOf[n.id] ? gcol(gOf[n.id]) : tx;
    const nameSize = G.appearance.nameSize + (you ? 2 : 0);
    ctx.font = (fixed ? "700 " : "") + nameSize + "px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(n.name).width / 2 + 8;
    n.hw = w;
    ctx.lineWidth = Math.max(6, nameSize * 0.75);
    ctx.lineJoin = "round";
    ctx.strokeStyle = bg;
    ctx.strokeText(n.name, n.x, n.y);
    if (
      selectedPeople.has(n.id) ||
      n.id === sel ||
      n.id === linkFrom ||
      n.id === moving
    ) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = ac;
      ctx.beginPath();
      if (ctx.roundRect)
        ctx.roundRect(n.x - w, n.y - nameSize, w * 2, nameSize * 2, nameSize);
      else ctx.rect(n.x - w, n.y - nameSize, w * 2, nameSize * 2);
      ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.fillText(n.name, n.x, n.y);
    if (you) {
      ctx.strokeStyle = col;
      ctx.lineWidth = G.appearance.lineWidth;
      ctx.beginPath();
      ctx.moveTo(n.x - w + 8, n.y + 11);
      ctx.lineTo(n.x + w - 8, n.y + 11);
      ctx.stroke();
    }
    ctx.textBaseline = "alphabetic";
  });
  if (onboardingRingFade) {
    if (performance.now() - onboardingRingFade.startedAt >= 900) {
      onboardingRingFade = null;
    } else if (!onboardingRingFade.framePending) {
      onboardingRingFade.framePending = true;
      requestAnimationFrame(() => {
        if (!onboardingRingFade) return;
        onboardingRingFade.framePending = false;
        draw();
      });
    }
  }
}
function size() {
  W = cv.parentNode.clientWidth;
  H = cv.parentNode.clientHeight;
  const d = devicePixelRatio || 1;
  cv.width = W * d;
  cv.height = H * d;
  cv.style.width = W + "px";
  cv.style.height = H + "px";
  if (first && W) {
    first = false;
    view(W / 2, H / 2, 1);
  }
  draw();
}
function view(x, y, k, ms) {
  const t = d3.zoomIdentity.translate(x, y).scale(k),
    s = d3.select(cv);
  (ms ? s.transition().duration(ms) : s).call(zoom.transform, t);
}

/* ---------- interaction ---------- */
function hit(e) {
  const p = T.invert(d3.pointer(e, cv));
  let best = null,
    bd = 1e9;
  for (const n of nodes) {
    const dx = Math.abs(p[0] - n.x),
      dy = Math.abs(p[1] - n.y);
    if (dx <= (n.hw || 30) && dy <= 14 && dx + dy < bd) {
      best = n;
      bd = dx + dy;
    }
  }
  return best;
}
const zoom = d3
  .zoom()
  .scaleExtent([0.2, 4])
  .filter((e) => {
    if (e.type === "wheel") return true;
    const n = hit(e);
    return !(n && n.id !== ctr && n.id !== "you");
  })
  .on("zoom", (e) => {
    T = e.transform;
    if (e.sourceEvent) userView = true;
    draw();
  });
d3.select(cv).call(zoom).on("dblclick.zoom", null);
cv.addEventListener("pointerdown", (e) => {
  if (moving || e.button || e.target.closest("#pk, #cm")) return;
  const n = hit(e);
  if (!n || n.id === ctr || n.id === "you") return;
  const selectedNodes = selectedPeople.has(n.id)
    ? [...selectedPeople]
        .filter((id) => id !== ctr && id !== "you")
        .map((id) => byId[id])
        .filter(Boolean)
    : [n];
  const nodesToMove = selectedNodes.length > 1 ? selectedNodes : [n];
  dg = {
    x: e.clientX,
    y: e.clientY,
    nodes: nodesToMove.map((node) => ({ node, x: node.x, y: node.y })),
    moved: false,
  };
  if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", (e) => {
  if (!dg) return;
  const dx = e.clientX - dg.x,
    dy = e.clientY - dg.y;
  if (!dg.moved) {
    if (Math.hypot(dx, dy) < 4) return;
    dg.moved = true;
    sim.alphaTarget(0.3).restart();
    $("#pk").style.display = "none";
    $("#cm").style.display = "none";
  }
  dg.nodes.forEach(({ node, x, y }) => {
    node.fx = x + dx / T.k;
    node.fy = y + dy / T.k;
  });
});
cv.addEventListener("pointerup", () => {
  if (!dg) return;
  const drag = dg;
  dg = null;
  if (!drag.moved) return;
  sim.alphaTarget(0);
  skipClick = true;
  setTimeout(() => (skipClick = false), 50);
  drag.nodes.forEach(({ node }) => {
    const person = S.people.find((candidate) => candidate.id === node.id);
    if (person && node.id !== ctr) {
      const x = node.fx != null ? node.fx : node.x;
      const y = node.fy != null ? node.fy : node.y;
      node.x = node.fx = x;
      node.y = node.fy = y;
      setPos(person, x, y);
    }
  });
  save();
  dirty = true;
  render();
  draw();
});
cv.addEventListener("click", (e) => {
  if (skipClick) return;
  if (e.target.closest("#pk, #cm")) return;
  $("#pk").style.display = "none";
  $("#cm").style.display = "none";
  if (moving) {
    const p = T.invert(d3.pointer(e, cv)),
      id = moving;
    moving = null;
    fixPerson(id, p[0], p[1]);
    sim.alpha(0.3).restart();
    banner();
    return;
  }
  const n = hit(e);
  if (!n) {
    if (e.shiftKey) return;
    linkFrom = null;
    sel = null;
    selectedPeople.clear();
    render();
    draw();
    return;
  }
  if (e.shiftKey) {
    toggleSelection(n.id, e);
    return;
  }
  if (linkMode) {
    if (!linkFrom) {
      linkFrom = n.id;
      draw();
      return;
    }
    if (linkFrom === n.id) {
      linkFrom = null;
      draw();
      return;
    }
    pick(linkFrom, n.id, e);
    return;
  }
  if (n.id === ctr) {
    sel = null;
    selectedPeople.clear();
    render();
    draw();
    return;
  }
  sel = n.id === "you" ? null : n.id;
  selectedPeople = new Set([n.id]);
  render();
  draw();
  nodeMenu(n, e);
});
function toggleSelection(personId, event) {
  $("#pk").style.display = "none";
  if (selectedPeople.has(personId)) selectedPeople.delete(personId);
  else selectedPeople.add(personId);
  sel = [...selectedPeople].filter((id) => id !== "you").pop() || null;

  if (selectedPeople.size === 2) {
    const [personA, personB] = [...selectedPeople];
    pick(personA, personB, event);
  }
  render();
  draw();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Shift" && $("#pk").dataset.kind === "node")
    $("#pk").style.display = "none";
  if (e.key === "Escape") {
    if (moving) {
      moving = null;
      banner();
    }
    $("#pk").style.display = "none";
    $("#cm").style.display = "none";
  }
});
function place(k, e, w, h) {
  k.style.display = "flex";
  k.style.left = Math.max(4, Math.min(e.offsetX + 8, W - w)) + "px";
  k.style.top = Math.max(4, Math.min(e.offsetY + 8, H - h)) + "px";
}
function nodeMenu(n, e) {
  const p = S.people.find((p) => p.id === n.id),
    k = $("#pk");
  k.dataset.kind = "node";
  k.innerHTML =
    `<div class="mu">${esc(n.name)}</div>` +
    (p ? '<button data-m="lv">Choose friendship levels</button>' : "") +
    '<button data-m="center">Center</button>' +
    (p ? '<button data-m="move">Move</button>' : "") +
    (p && getPos(p) ? '<button data-m="relax">Relax</button>' : "");
  place(k, e, 230, 150);
  k.onclick = (ev) => {
    const m = ev.target.dataset.m;
    if (!m) return;
    k.style.display = "none";
    if (m === "lv") {
      lv = n.id;
      tab = "People";
      showPanel();
      render();
    } else if (m === "center") setCenter(n.id);
    else if (m === "move") {
      moving = n.id;
      linkMode && setLinkMode(false);
      banner();
      draw();
    } else relax(n.id);
  };
}
function pick(a, b, e) {
  const cur = relOf(a, b),
    k = $("#pk");
  k.dataset.kind = "relationship";
  k.innerHTML =
    `<div class="mu relationship-help">Choose a number 1 to ${tiers.length}</div>` +
    `<div class="mu">${esc(nm(a))} – ${esc(nm(b))}</div>` +
    tc(cur, { a, b });
  place(k, e, 260, 130);
}
function showPanel() {
  $("#side").classList.remove("hid");
  $("#pb").style.display = "none";
}
function setLinkMode(on) {
  linkMode = on;
  linkFrom = null;
  selectedPeople.clear();
  sel = null;
  if (!on) intro = false;
  $("#lm").classList.toggle("on", on);
  banner();
  draw();
}
function banner() {
  const b = $("#bn"),
    n = S.links.length;
  let h = "";
  if (moving)
    h = `Click where to place <b>${esc(nm(moving))}</b>. <button id="bx">Cancel</button>`;
  else if (linkMode)
    h =
      (intro
        ? "Here’s your map… but it revolves around <b>you</b> — not that that’s a bad thing! "
        : "") +
      `Tap two people to link them <button class="p" id="dn">Done</button>`;
  b.style.display = h ? "block" : "none";
  b.innerHTML = h;
  if (moving)
    $("#bx").onclick = () => {
      moving = null;
      banner();
      draw();
    };
  else if (linkMode) $("#dn").onclick = () => setLinkMode(false);
}
$("#lm").onclick = () => {
  moving = null;
  setLinkMode(!linkMode);
};
$("#pb").onclick = () => {
  showPanel();
};
$("#fb").onclick = () => fit(500);
$("#sb").onclick = shuffleSetup;
$("#vb").onclick = () => setCenter("you");
