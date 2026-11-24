/* ---------- tier controls: type a number (1–12), or pick ♥ / broken ♥ ---------- */
function tc(v, o) {
  const shown =
    v === BRK ? "0" : v === ROM ? "♥" : typeof v === "number" ? v : "";
  return (
    `<span class="tc" data-a="${o.a}" data-b="${o.b}">` +
    (o.btns
      ? tiers
          .map(
            (n, i) =>
              `<button data-k="${i + 1}" title="${esc(n)}"${v === i + 1 ? ' class="on"' : ""}>${i + 1}</button>`,
          )
          .join("")
      : "") +
    `<input class="ti" value="${shown}" placeholder="–" title="Type a positive tier up to ${MAXT}; decimals are allowed, 0 means broken up, h means romantic">` +
    `<button data-k="h" title="Romantic partner" class="${v === ROM ? "on" : ""}" style="color:var(--hr)">${HEART}</button><button data-k="b" title="Broken up (0)" class="${v === BRK ? "on" : ""}">${BROKEN}</button>` +
    (v == null ? "" : '<button data-k="del" title="Remove">✕</button>') +
    "</span>"
  );
}
function tcApply(w, raw) {
  const a = w.dataset.a,
    b = w.dataset.b;
  let t;
  const r = raw.toLowerCase();
  if (r === "h" || r === "♥" || r === "♡") t = ROM;
  else if (r === "b" || r === "0" || r === "💔") t = BRK;
  else if (r === "" || r === "del") t = null;
  else {
    t = Number(r);
    if (!Number.isFinite(t) || t <= 0 || t > MAXT) {
      render();
      return;
    }
    ensureTiers(t);
  }
  if (w.closest("#pk")) {
    $("#pk").style.display = "none";
    linkFrom = null;
  }
  setLink(a, b, t);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".tc button");
  if (b) tcApply(b.closest(".tc"), b.dataset.k);
});
document.addEventListener("change", (e) => {
  if (e.target.matches(".ti"))
    tcApply(e.target.closest(".tc"), e.target.value.trim());
});

/* ---------- side panel ---------- */
function render() {
  $("#tabs").innerHTML = ["People", "Groups", "Appearance", "Data"]
    .map(
      (t) =>
        `<button class="${t === tab ? "on" : ""}" data-tab="${t}">${t}${t === "Data" && dirty ? " •" : ""}</button>`,
    )
    .join("");
  $("#bd").innerHTML =
    tab === "People"
      ? lv && S.people.find((p) => p.id === lv)
        ? levels()
        : peopleView()
      : tab === "Groups"
        ? groupsView()
        : tab === "Appearance"
          ? appearanceView()
          : dataView();
}
function peopleView() {
  return (
    `<div class="row"><input id="np" placeholder="Add a person…" style="flex:1"><button data-act="addp" class="p">Add</button></div>` +
    (S.people
      .map(
        (p) =>
          `<div class="row${selectedPeople.has(p.id) || p.id === sel ? " s" : ""}"><span class="n" data-lv="${p.id}" title="Choose friendship levels" style="${getPos(p) ? "font-weight:700" : ""}">${esc(p.name)}</span>${tc(p.tier, { a: p.id, b: "you" })}<button data-act="del" data-id="${p.id}">✕</button></div>`,
      )
      .join("") || '<p class="mu">No people yet.</p>')
  );
}
function levels() {
  const L = S.people.find((p) => p.id === lv),
    gids = [...new Set([...Object.keys(groups), ...Object.keys(G.cg)])],
    ov = override(L) || "",
    grow = `<div class="row"><span class="n">Group</span><select data-act="pgrp"><option value="">Automatic${gOf[L.id] && !ov ? " (" + esc(G.names[gOf[L.id]]) + ")" : ""}</option><option value="-"${ov === "-" ? " selected" : ""}>No group</option>${gids.map((g) => `<option value="${g}"${ov === g ? " selected" : ""}>${esc(G.names[g] || g)}</option>`).join("")}</select></div>`;
  return (
    `<div class="row"><button data-act="lvback">← Back</button><b style="flex:1">${esc(L.name)}</b></div><div class="mu" style="padding:8px 0">Closeness between ${esc(L.name)} and everyone else. Type a number, 0 or the broken ♥ for broken up, or h or ♥ for romantic partner.</div><div class="row"><span class="n">You</span>${tc(L.tier, { a: L.id, b: "you" })}</div>` +
    grow +
    S.people
      .filter((p) => p.id !== L.id)
      .map((p) => {
        const l = getL(L.id, p.id);
        return `<div class="row"><span class="n">${esc(p.name)}</span>${tc(l ? l.t : null, { a: L.id, b: p.id })}</div>`;
      })
      .join("")
  );
}
function groupsView() {
  const ids = [...new Set([...Object.keys(groups), ...Object.keys(G.cg)])];
  return (
    `<p class="mu">Groups are found automatically: clusters where most people know each other (You is excluded; ♥ and broken ♥ links are ignored). Editing a group locks it so it stays as you set it.</p><p><button data-act="gnew">New group</button> <button data-act="gauto">Reset all to automatic</button></p>` +
    (ids
      .map(
        (g) =>
          `<div class="row" style="flex-wrap:wrap"><input type="color" data-act="gcolor" data-g="${g}" value="${gcol(g)}" style="width:34px;padding:1px"><input data-act="gname" data-g="${g}" value="${esc(G.names[g] || "")}" style="flex:1"><button data-act="gdel" data-g="${g}" title="Delete group">✕</button><div style="width:100%">${[...(groups[g] || [])].map((id) => `<span class="chip" data-act="grem" data-g="${g}" data-id="${id}" title="Remove from group">${esc(nm(id))} ✕</span>`).join("")}<select data-act="gadd" data-g="${g}"><option value="">+ add person</option>${S.people
            .filter((p) => gOf[p.id] !== g)
            .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
            .join("")}</select></div></div>`,
      )
      .join("") ||
      '<p class="mu">No groups yet — link some people together, or make one with New group.</p>')
  );
}
function appearanceView() {
  const sw = (act, v, x = "") =>
    `<input type="color" data-act="${act}" ${x} value="${v}" style="width:34px;padding:1px">`;
  const { nameSize, lineWidth, ringSpacing } = G.appearance;
  const range = (label, action, value, min, max, step, unit) =>
    `<div class="row"><label class="n" for="${action}">${label}</label><input id="${action}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-act="${action}" style="flex:1;min-width:80px"><output>${value}${unit}</output></div>`;
  return (
    `<p class="mu">Adjust the map's appearance. Fractional tiers sit between rings; each whole-number band uses its lower tier's color.</p>` +
    range("Name size", "nameSize", nameSize, 9, 24, 1, "px") +
    range("Line thickness", "lineWidth", lineWidth, 0.5, 4, 0.1, "px") +
    range("Ring spacing", "ringSpacing", ringSpacing, 40, 180, 5, "px") +
    `<p class="mu">Tier 1 is closest to the center. For example, 1.5 sits between rings 1 and 2 and uses tier 1's color. Names are optional.</p>` +
    `<div class="row"><span class="n">Gradient</span>${sw("tca", G.tcol.a)}<span style="flex:1;height:12px;border-radius:6px;background:linear-gradient(90deg,${tiers.map((_, i) => tierColor(i + 1)).join(",")})"></span>${sw("tcb", G.tcol.b)}</div>` +
    tiers
      .map(
        (n, i) =>
          `<div class="row">${sw("tcol", tierColor(i + 1), `data-t="${i + 1}" title="Line color for tier ${i + 1}"`)}<b style="width:24px">${i + 1}</b><input data-act="tname" data-i="${i}" value="${esc(n)}" placeholder="name (optional)" style="flex:1"></div>`,
      )
      .join("") +
    `<p><button data-act="tadd"${tiers.length >= MAXT ? " disabled" : ""}>Add tier</button> <button data-act="trem"${tiers.length <= 2 ? " disabled" : ""}>Remove last tier</button> <button data-act="treset">Reset to 5</button> <button data-act="tcreset">Reset colors</button> <button data-act="areset">Reset appearance</button></p>`
  );
}
function dataView() {
  return `<p><button class="p" data-act="exp">Export CSV${dirty ? " (unexported changes)" : ""}</button> <button data-act="imp">Import CSV…</button></p><p><button data-act="ex">Load example data</button> <button data-act="relaxall">Relax everyone</button> <button data-act="clr">Clear everything</button></p>
 <p class="mu">Everything stays in your browser. Autosaved locally; export CSV for a real backup.<br>Columns: kind (tier | person | link), id, name, tier, a, b, x, y. Tier rows: id = number, name = label, color = optional line color. Gradient rows: id a or b, color = gradient endpoint. Person rows: tier = tier to You (a positive number, including decimals, heart or broken; blank if none); x/y = fixed position (optional). Link rows: a, b = person ids or names; tier = a positive number, including decimals, heart, or broken (0).</p>`;
}
function usedTier(t) {
  return (
    S.people.some(
      (person) =>
        typeof person.tier === "number" && Math.ceil(person.tier) === t,
    ) ||
    S.links.some(
      (link) => typeof link.t === "number" && Math.ceil(link.t) === t,
    )
  );
}
function relaxEveryone() {
  S.people.forEach((person) => {
    delete person.px;
    delete person.py;
    delete person.pos;
  });
  commit();
}
async function resetGroupsToAutomatic() {
  if (
    (await ask(
      "Reset every group to automatic? Your manual groups and assignments will be removed.",
      ["Cancel", "Reset"],
    )) !== 1
  )
    return;
  S.people.forEach((person) => delete person.g);
  G.cg = {};
  G.colors = {};
  commit();
}
async function clearEverything() {
  if (
    (await ask(
      "Delete everything? This clears all people, links and settings.",
      ["Cancel", "Delete everything"],
    )) !== 1
  )
    return;
  resetAll();
  commit();
}
function showGraphMenu(event) {
  event.preventDefault();
  const menu = $("#cm");
  const [x, y] = d3.pointer(event, cv);
  menu.innerHTML =
    '<button data-context-action="fit">Fit map</button>' +
    '<button data-context-action="relax">Relax everyone</button>' +
    '<button data-context-action="groups">Reset groups to automatic</button>' +
    '<button data-context-action="appearance">Appearance settings</button>' +
    '<button data-context-action="add-person">Add a person</button>' +
    '<button data-context-action="clear">Clear everything</button>';
  menu.style.display = "flex";
  menu.style.left = Math.max(4, Math.min(x, W - 210)) + "px";
  menu.style.top = Math.max(4, Math.min(y, H - 210)) + "px";
}
cv.addEventListener("contextmenu", showGraphMenu);
$("#cm").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-context-action]");
  if (!action) return;
  $("#cm").style.display = "none";
  if (action.dataset.contextAction === "fit") fit(500);
  else if (action.dataset.contextAction === "relax") relaxEveryone();
  else if (action.dataset.contextAction === "groups")
    await resetGroupsToAutomatic();
  else if (action.dataset.contextAction === "appearance") {
    tab = "Appearance";
    showPanel();
    render();
  } else if (action.dataset.contextAction === "add-person") {
    tab = "People";
    showPanel();
    render();
    $("#np").focus();
  } else if (action.dataset.contextAction === "clear") await clearEverything();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#cm")) $("#cm").style.display = "none";
});
$("#side").addEventListener("click", async (e) => {
  const d = e.target.dataset;
  if (d.tab) {
    tab = d.tab;
    lv = null;
    render();
  } else if (d.lv) {
    lv = d.lv;
    render();
  } else if (d.act === "lvback") {
    lv = null;
    render();
  } else if (d.act === "full") {
    const expanded = $("#side").classList.toggle("full");
    e.target.title = expanded ? "Shrink" : "Expand";
  } else if (d.act === "hide") {
    $("#side").classList.add("hid");
    $("#side").classList.remove("full");
    $("#pb").style.display = "";
  } else if (d.act === "addp") {
    const v = $("#np").value.trim();
    if (v) {
      S.people.push({ id: uid(), name: v, tier: null });
      commit();
    }
  } else if (d.act === "del") {
    S.people = S.people.filter((p) => p.id !== d.id);
    S.links = S.links.filter((l) => l.a !== d.id && l.b !== d.id);
    selectedPeople.delete(d.id);
    if (sel === d.id) sel = null;
    if (lv === d.id) lv = null;
    commit();
  } else if (d.act === "tadd") {
    ensureTiers(tiers.length + 1);
    commit();
  } else if (d.act === "trem") {
    const n = tiers.length;
    if (usedTier(n))
      await ask(
        `Tier ${n} is still in use. Move those people to another tier first.`,
      );
    else {
      tiers.pop();
      commit();
    }
  } else if (d.act === "treset") {
    if (tiers.length > 5 && [6, 7, 8, 9, 10, 11, 12].some(usedTier))
      await ask("Some people are still in tiers above 5. Move them first.");
    else {
      tiers = DEF.slice();
      commit();
    }
  } else if (d.act === "tcreset") {
    G.tcol = { a: TC0, b: TC1, o: {} };
    save();
    dirty = true;
    render();
    draw();
  } else if (d.act === "areset") {
    G.appearance = newG().appearance;
    G.tcol = { a: TC0, b: TC1, o: {} };
    save();
    dirty = true;
    rebuild();
    render();
    draw();
  } else if (d.act === "gnew") {
    const n = G.n++,
      id = "c" + n;
    G.cg[id] = 1;
    G.names[id] = "Group " + n;
    commit();
  } else if (d.act === "grem") {
    lockGroup(d.g);
    S.people.find((p) => p.id === d.id).g = "-";
    commit();
  } else if (d.act === "gdel") {
    if (
      (await ask("Delete this group? Its members become ungrouped.", [
        "Cancel",
        "Delete",
      ])) === 1
    ) {
      [...(groups[d.g] || [])].forEach((id) => {
        S.people.find((p) => p.id === id).g = "-";
      });
      delete G.cg[d.g];
      commit();
    }
  } else if (d.act === "gauto") {
    await resetGroupsToAutomatic();
  } else if (d.act === "exp") exportCSV();
  else if (d.act === "imp") $("#fi").click();
  else if (d.act === "ex") example();
  else if (d.act === "relaxall") relaxEveryone();
  else if (d.act === "clr") await clearEverything();
});
const sideResizeHandle = $("#sr");
let resizingSide = false;
function setSideWidth(width) {
  const minWidth = 220;
  const maxWidth = Math.min(window.innerWidth * 0.75, 720);
  const clampedWidth = Math.max(minWidth, Math.min(width, maxWidth));
  $("#side").style.width = clampedWidth + "px";
  $("#side").style.flexBasis = clampedWidth + "px";
  sideResizeHandle.setAttribute("aria-valuenow", Math.round(clampedWidth));
}
sideResizeHandle.addEventListener("pointerdown", (event) => {
  if ($("#side").classList.contains("full")) return;
  event.preventDefault();
  resizingSide = true;
  if (sideResizeHandle.setPointerCapture)
    sideResizeHandle.setPointerCapture(event.pointerId);
});
sideResizeHandle.addEventListener("pointermove", (event) => {
  if (resizingSide) setSideWidth(event.clientX);
});
const stopSideResize = () => {
  resizingSide = false;
};
sideResizeHandle.addEventListener("pointerup", stopSideResize);
sideResizeHandle.addEventListener("pointercancel", stopSideResize);
sideResizeHandle.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const currentWidth =
    $("#side").getBoundingClientRect().width ||
    parseFloat($("#side").style.width) ||
    340;
  setSideWidth(currentWidth + (event.key === "ArrowRight" ? 20 : -20));
});
$("#side").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "np")
    document.querySelector("[data-act=addp]").click();
});
$("#side").addEventListener("change", (e) => {
  const t = e.target,
    d = t.dataset;
  if (d.act === "gname") {
    G.names[d.g] = t.value;
    save();
    draw();
  } else if (d.act === "gcolor") {
    G.colors[d.g] = t.value;
    save();
    dirty = true;
    draw();
  } else if (d.act === "gadd") {
    if (t.value) {
      const c = lockGroup(d.g);
      S.people.find((p) => p.id === t.value).g = c;
      commit();
    }
  } else if (d.act === "pgrp") {
    const p = S.people.find((p) => p.id === lv);
    if (t.value === "") delete p.g;
    else if (t.value === "-") p.g = "-";
    else p.g = lockGroup(t.value);
    commit();
  } else if (d.act === "tca" || d.act === "tcb") {
    G.tcol[d.act === "tca" ? "a" : "b"] = t.value;
    save();
    dirty = true;
    render();
    draw();
  } else if (d.act === "tcol") {
    G.tcol.o[d.t] = t.value;
    save();
    dirty = true;
    render();
    draw();
  } else if (d.act === "tname") {
    tiers[+d.i] = t.value;
    save();
    dirty = true;
    draw();
  } else if (
    d.act === "nameSize" ||
    d.act === "lineWidth" ||
    d.act === "ringSpacing"
  ) {
    G.appearance[d.act] = Number(t.value);
    save();
    dirty = true;
    if (d.act === "ringSpacing") rebuild();
    else sim.alpha(0.3).restart();
    render();
    draw();
  }
});
function resetAll() {
  S = { people: [], links: [] };
  G = newG();
  ctr = "you";
  prev = {};
  tiers = DEF.slice();
  sel = lv = null;
  selectedPeople.clear();
  linkFrom = moving = null;
}

/* ---------- onboarding ---------- */
const PR = [
  [
    "Who are your 1–2 closest friends?",
    "Your innermost circle. Add a name and press Enter.",
  ],
  ["Who else is in your closest ~5?", "About 3–4 more people."],
  ["Who else makes up your closest ~15?", "About 10 more people."],
];
const INTRO = `<div><h1>How your social life is structured</h1><p>Research on human social networks finds that our relationships fall into circles that grow by roughly a factor of three: about <b>1–2</b> people in the innermost circle, around <b>5</b> close ones, about <b>15</b> in the next layer, then roughly 50 and 150. Closer circles get more of our time and emotional investment.</p><div class="cite">Based on Dunbar’s work, e.g. MacCarron, Kaski &amp; Dunbar (2016), “Calling Dunbar’s Numbers,” <i>Social Networks</i>; Zhou et al. (2005). These are averages, so use them as prompts, not rules. Everything stays in your browser.</div><button class="p" id="go">Start</button> <button id="exm">Try example data</button></div>`;
function startOnboarding() {
  document.body.classList.add("onb");
  cv.classList.add("h");
  linkMode = false;
  moving = null;
  sel = lv = null;
  selectedPeople.clear();
  $("#pk").style.display = "none";
  $("#cm").style.display = "none";
  step = 0;
  buf = [[], [], []];
  busy = false;
  obRender();
}
function endOnboarding() {
  document.body.classList.remove("onb");
  cv.classList.remove("h");
  $("#ob").className = "";
  busy = false;
  setTimeout(() => view(W / 2, H / 2, 1, 600), 60);
}
function fitOnboarding() {
  const c = document.querySelector("#ob>div");
  if (!c) return;
  const top = c.getBoundingClientRect().bottom + 8,
    h = H - top;
  view(W / 2, top + h / 2, Math.max(0.35, Math.min(1, (h / 2 - 28) / 270)));
}
function applyTier(i) {
  const names = buf[i],
    eq = (a, b) => a.toLowerCase() === b.toLowerCase();
  S.people.forEach((p) => {
    if (p.tier === i + 1 && !names.some((n) => eq(n, p.name))) p.tier = null;
  });
  names.forEach((n) => {
    const p = S.people.find((p) => eq(p.name, n));
    if (p) p.tier = i + 1;
    else S.people.push({ id: uid(), name: n, tier: i + 1 });
  });
  commit();
}
function obRender() {
  const o = $("#ob");
  if (step === 0) {
    o.className = "full";
    o.innerHTML = INTRO;
    $("#go").onclick = () => {
      step = 1;
      obRender();
    };
    $("#exm").onclick = () => example();
    return;
  }
  const i = step - 1;
  o.className = "top";
  o.innerHTML = `<div><h1>${PR[i][0]}</h1><p class="mu">${PR[i][1]} You can edit this later.</p><input id="oi" placeholder="Name, then Enter" style="width:100%;box-sizing:border-box"><div id="ch" style="margin:10px 0;min-height:36px"></div><button class="p" id="nx">${step < 3 ? "Next" : "Show my map"}</button></div>`;
  const chips = () => {
      $("#ch").innerHTML = buf[i]
        .map((n, j) => `<span class="chip" data-j="${j}">${esc(n)} ✕</span>`)
        .join("");
    },
    add = () => {
      const v = $("#oi");
      v.value
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => buf[i].push(s));
      v.value = "";
      chips();
    };
  chips();
  fitOnboarding();
  $("#oi").focus();
  $("#oi").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };
  $("#ch").onclick = (e) => {
    if (!busy && e.target.dataset.j != null) {
      buf[i].splice(+e.target.dataset.j, 1);
      chips();
    }
  };
  $("#nx").onclick = () => {
    if (busy) return;
    add();
    busy = true;
    $("#oi").disabled = true;
    $("#nx").disabled = true;
    applyTier(i);
    cv.classList.remove("h");
    setTimeout(() => {
      busy = false;
      if (step < 3) {
        step++;
        obRender();
      } else {
        endOnboarding();
        intro = true;
        setLinkMode(true);
      }
    }, DELAY);
  };
}
$("#rb").onclick = async () => {
  if (
    S.people.length &&
    (await ask("Are you sure? You’ll clear all previous data.", [
      "Cancel",
      "Clear and start over",
    ])) !== 1
  )
    return;
  resetAll();
  commit();
  startOnboarding();
};

/* ---------- init ---------- */
new ResizeObserver(size).observe(cv.parentNode);
size();
if (load()) {
  rebuild();
  render();
  banner();
} else {
  render();
  startOnboarding();
}
