/* ---------- relationship controls ---------- */
function tc(v, o) {
  const shown =
    v === BRK ? "💔" : v === ROM ? "♥" : typeof v === "number" ? v : "";
  const prompt = `Choose a number 1 to ${tiers.length}`;
  return (
    `<span class="tc" data-a="${o.a}" data-b="${o.b}">` +
    `<input class="ti" type="text" inputmode="decimal" value="${shown}" placeholder="1–${tiers.length}" title="${prompt}; decimals are allowed">` +
    `<button type="button" data-k="h" title="Romantic relationship" aria-label="Romantic relationship">♥</button>` +
    `<button type="button" data-k="b" title="Heartbreak" aria-label="Heartbreak">💔</button>` +
    "</span>"
  );
}
function tcApply(w, raw) {
  const a = w.dataset.a,
    b = w.dataset.b;
  let t;
  const r = raw.toLowerCase();
  if (r === "h" || r === "heart" || r === "♥" || r === "♡") t = ROM;
  else if (r === "b" || r === "broken" || r === "0" || r === "💔") t = BRK;
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
document.addEventListener("keydown", (e) => {
  const input = e.target;
  if (
    e.key !== "Enter" ||
    !(input instanceof Element) ||
    !input.matches("#pk .ti")
  )
    return;
  e.preventDefault();
  if (input.value.trim() === input.defaultValue.trim()) {
    $("#pk").style.display = "none";
    linkFrom = null;
  } else tcApply(input.closest(".tc"), input.value.trim());
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
  const centeredPerson =
      ctr === "you" ? null : S.people.find((person) => person.id === ctr),
    people = centeredPerson
      ? [
          { id: "you", name: "You", person: centeredPerson },
          ...S.people
            .filter((person) => person.id !== ctr)
            .map((person) => ({ id: person.id, name: person.name, person })),
        ]
      : S.people.map((person) => ({
          id: person.id,
          name: person.name,
          person,
        }));
  return (
    `<div class="row"><input id="np" placeholder="Add a person…" style="flex:1"><button data-act="addp" class="p">Add</button></div>` +
    (centeredPerson
      ? `<p class="mu relationship-help">Relationships with ${esc(centeredPerson.name)}</p>`
      : "") +
    (people
      .map(({ id, name, person }) => {
        const relationship = centeredPerson
          ? id === "you"
            ? centeredPerson.tier
            : (getL(ctr, id) || {}).t
          : person.tier;
        const relationshipTo =
          centeredPerson && id !== "you"
            ? { a: ctr, b: id }
            : centeredPerson
              ? { a: ctr, b: "you" }
              : { a: id, b: "you" };
        return `<div class="row${person && (selectedPeople.has(id) || id === sel) ? " s" : ""}"><span class="n"${person ? ` data-lv="${id}" title="Choose friendship levels" style="${getPos(person) ? "font-weight:700" : ""}"` : ""}>${esc(name)}</span>${tc(relationship, relationshipTo)}${person ? `<button data-act="del" data-id="${id}">✕</button>` : ""}</div>`;
      })
      .join("") || '<p class="mu">No people yet.</p>')
  );
}
function levels() {
  const L = S.people.find((p) => p.id === lv),
    gids = [...new Set([...Object.keys(groups), ...Object.keys(G.cg)])],
    ov = override(L) || "",
    grow = `<div class="row"><span class="n">Group</span><select data-act="pgrp"><option value="">Automatic${gOf[L.id] && !ov ? " (" + esc(G.names[gOf[L.id]]) + ")" : ""}</option><option value="-"${ov === "-" ? " selected" : ""}>No group</option>${gids.map((g) => `<option value="${g}"${ov === g ? " selected" : ""}>${esc(G.names[g] || g)}</option>`).join("")}</select></div>`;
  return (
    `<div class="row"><button data-act="lvback">← Back</button><b style="flex:1">${esc(L.name)}</b></div><div class="mu relationship-help">Choose a number 1 to ${tiers.length}. Decimals are allowed; use the buttons for romantic relationships or heartbreak.</div><div class="row"><span class="n">You</span>${tc(L.tier, { a: L.id, b: "you" })}</div>` +
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
    `<p class="group-actions"><button data-act="gnew">+ New group</button><button data-act="gauto">Reset groups</button></p>` +
    (ids
      .map((g) => {
        const members = groups[g] || new Set();
        return `<div class="row group-row" style="flex-wrap:wrap"><input type="color" data-act="gcolor" data-g="${esc(g)}" value="${gcol(g)}" style="width:34px;padding:1px"><input data-act="gname" data-g="${esc(g)}" value="${esc(G.names[g] || "")}" style="flex:1"><button data-act="gdel" data-g="${esc(g)}" title="Delete group">✕</button><div style="width:100%">${[...members].map((id) => `<span class="chip" data-act="grem" data-g="${esc(g)}" data-id="${esc(id)}" title="Remove from group">${esc(nm(id))} ✕</span>`).join("")}<select data-act="gadd" data-g="${esc(g)}"><option value="">+ add person</option>${S.people
          .filter((person) => !members.has(person.id))
          .map(
            (person) =>
              `<option value="${esc(person.id)}">${esc(person.name)}</option>`,
          )
          .join("")}</select></div></div>`;
      })
      .join("") || '<p class="mu">No groups yet — make one with New group.</p>')
  );
}
function appearanceView() {
  const sw = (act, v, x = "") =>
    `<input type="color" data-act="${act}" ${x} value="${v}" style="width:34px;padding:1px">`;
  const { nameSize, lineWidth, ringSpacing } = G.appearance;
  const range = (label, action, value, min, max, step, unit) =>
    `<div class="row"><label class="n" for="${action}">${label}</label><input id="${action}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-act="${action}" style="flex:1;min-width:80px"><output>${value}${unit}</output></div>`;
  return (
    range("Name size", "nameSize", nameSize, 9, 24, 1, "px") +
    range("Line thickness", "lineWidth", lineWidth, 0.5, 4, 0.1, "px") +
    range("Ring spacing", "ringSpacing", ringSpacing, 40, 180, 5, "px") +
    `<label class="row"><span class="n">Hide tier numbers</span><input type="checkbox" data-act="hideTierNumbers"${G.appearance.hideTierNumbers ? " checked" : ""}></label>` +
    `<label class="row"><span class="n">Hide relationship lines</span><input type="checkbox" data-act="hideLines"${G.appearance.hideLines ? " checked" : ""}></label>` +
    `<label class="row"><span class="n">Anonymize names on map</span><input type="checkbox" data-act="anonymize"${G.appearance.anonymize ? " checked" : ""}></label>` +
    `<p class="mu">Tier 1 is closest to the center</p>` +
    `<div class="row"><span class="n">Gradient</span>${sw("tca", G.tcol.a)}<span style="flex:1;height:12px;border-radius:6px;background:linear-gradient(90deg,${tiers.map((_, i) => tierColor(i + 1)).join(",")})"></span>${sw("tcb", G.tcol.b)}</div>` +
    tiers
      .map(
        (n, i) =>
          `<div class="row">${sw("tcol", tierColor(i + 1), `data-t="${i + 1}" title="Line color for tier ${i + 1}"`)}<b style="width:24px">${i + 1}</b><input data-act="tname" data-i="${i}" value="${esc(n)}" placeholder="name" style="flex:1"></div>`,
      )
      .join("") +
    `<div class="appearance-actions"><button data-act="tadd"${tiers.length >= MAXT ? " disabled" : ""}>Add tier</button><button data-act="trem"${tiers.length <= 2 ? " disabled" : ""}>Remove last tier</button><button data-act="treset">Reset to 5</button><button data-act="tcreset">Reset colors</button><button data-act="areset">Reset appearance</button></div>`
  );
}
function dataView() {
  return `<div class="data-actions"><button class="p" data-act="exp">Export${dirty ? " (unexported changes)" : ""}</button><button data-act="imp">Import</button><button data-act="ex">Load example data</button><button data-act="relaxall">Relax everyone</button><button data-act="clr">Clear all data</button></div>`;
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
  S.people.forEach((person) => {
    delete person.g;
    delete person.gs;
  });
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
    const person = S.people.find((p) => p.id === d.id);
    const groupId = lockGroup(d.g);
    if (person.g === groupId) person.g = "-";
    person.gs = (person.gs || []).filter((id) => id !== groupId);
    commit();
  } else if (d.act === "gdel") {
    if (
      (await ask("Delete this group? Its members become ungrouped.", [
        "Cancel",
        "Delete",
      ])) === 1
    ) {
      const members = groups[d.g] || new Set();
      const manualGroup = !!G.cg[d.g];
      S.people.forEach((person) => {
        person.gs = (person.gs || []).filter((id) => id !== d.g);
        if (person.g === d.g || (!manualGroup && members.has(person.id)))
          person.g = "-";
      });
      delete G.cg[d.g];
      if (manualGroup) {
        delete G.names[d.g];
        delete G.colors[d.g];
      }
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
      const groupId = lockGroup(d.g);
      const person = S.people.find((p) => p.id === t.value);
      if (person.g === "-" || !gOf[person.id]) person.g = groupId;
      else person.gs = [...new Set([...(person.gs || []), groupId])];
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
  } else if (d.act === "hideTierNumbers") {
    G.appearance.hideTierNumbers = t.checked;
    save();
    dirty = true;
    draw();
  } else if (d.act === "hideLines" || d.act === "anonymize") {
    G.appearance[d.act] = t.checked;
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
    "Who are you calling in a crisis?",
    "Your closest friend(s). Add a name or two and press Enter.",
  ],
  [
    "Who else is in your closest ~5?",
    "Who do you see every day, or multiple times a week? P.S. The numbers are estimates, everyone's life is different.",
  ],
  ["Who else makes up your closest ~15?", "The people you see weekly."],
];
function introMarkup() {
  const canContinue = hasStoredMap(),
    exampleIndex = canContinue ? 2 : 1,
    skipIndex = exampleIndex + 1;
  return `<h1 class="splash-title">Sircles</h1><button class="splash-node" id="go" data-splash-index="0">Start</button>${canContinue ? '<button class="splash-node" id="continue" data-splash-index="1">Continue your map</button>' : ""}<button class="splash-node" id="exm" data-splash-index="${exampleIndex}">Try example data</button><button class="splash-node" id="newMap" data-splash-index="${skipIndex}">New map</button>`;
}
let splashPositions = null,
  splashDrag = null,
  splashReturnView = null,
  suppressSplashClick = false;
function hasStoredMap() {
  return (
    S.people.length > 0 &&
    !!(
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY)
    )
  );
}
function positionSplashNodes() {
  if (step !== 0 || !document.body.classList.contains("onb")) return;
  const rect = cv.getBoundingClientRect(),
    centerX = rect.left + T.x,
    centerY = rect.top + T.y,
    radius = R(2) * T.k;
  if (!splashPositions) {
    const sideOffset = (Math.sqrt(3) * radius) / 2;
    splashPositions =
      document.querySelectorAll(".splash-node").length === 4
        ? [
            { x: -sideOffset / T.k, y: radius / 2 / T.k },
            { x: -radius / 2 / T.k, y: sideOffset / T.k },
            { x: radius / 2 / T.k, y: sideOffset / T.k },
            { x: sideOffset / T.k, y: radius / 2 / T.k },
          ]
        : [
            { x: -sideOffset / T.k, y: radius / 2 / T.k },
            { x: 0, y: radius / T.k },
            { x: sideOffset / T.k, y: radius / 2 / T.k },
          ];
  }
  const title = $("#ob .splash-title");
  title.style.left = centerX + "px";
  title.style.top = centerY + "px";
  document.querySelectorAll(".splash-node").forEach((node) => {
    const position = splashPositions[+node.dataset.splashIndex];
    node.style.left = centerX + position.x * T.k + "px";
    node.style.top = centerY + position.y * T.k + "px";
  });
}
function configureSplashNode(node) {
  const index = +node.dataset.splashIndex;
  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    splashDrag = {
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    if (node.setPointerCapture) node.setPointerCapture(event.pointerId);
  });
  node.addEventListener("pointermove", (event) => {
    if (!splashDrag || splashDrag.pointerId !== event.pointerId) return;
    if (
      Math.hypot(
        event.clientX - splashDrag.startX,
        event.clientY - splashDrag.startY,
      ) > 3
    )
      splashDrag.moved = true;
    if (!splashDrag.moved) return;
    const rect = cv.getBoundingClientRect(),
      centerX = rect.left + T.x,
      centerY = rect.top + T.y;
    splashPositions[index] = {
      x: (event.clientX - centerX) / T.k,
      y: (event.clientY - centerY) / T.k,
    };
    positionSplashNodes();
  });
  const finishDrag = (event) => {
    if (!splashDrag || splashDrag.pointerId !== event.pointerId) return;
    if (
      node.releasePointerCapture &&
      node.hasPointerCapture &&
      node.hasPointerCapture(event.pointerId)
    )
      node.releasePointerCapture(event.pointerId);
    if (splashDrag.moved) {
      suppressSplashClick = true;
      setTimeout(() => (suppressSplashClick = false), 100);
    }
    splashDrag = null;
  };
  node.addEventListener("pointerup", finishDrag);
  node.addEventListener("pointercancel", finishDrag);
}
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
  splashPositions = null;
  revealedOnboardingTiers = 0;
  onboardingRingFade = null;
  buf = [[], [], []];
  busy = false;
  obRender();
}
function endOnboarding() {
  const returnView = splashReturnView;
  splashReturnView = null;
  document.body.classList.remove("onb");
  document.body.classList.remove("home");
  cv.classList.remove("h");
  $("#ob").className = "";
  busy = false;
  setTimeout(
    () =>
      returnView
        ? view(returnView.x, returnView.y, returnView.k, 600)
        : view(W / 2, H / 2, 1, 600),
    60,
  );
}
function skipOnboarding() {
  endOnboarding();
}
async function clearMapAfterConfirmation() {
  if (
    S.people.length &&
    (await ask("Are you sure? You’ll clear all previous data.", [
      "Cancel",
      "Clear and start over",
    ])) !== 1
  )
    return false;
  resetAll();
  commit();
  return true;
}
function showHome() {
  splashReturnView = { x: T.x, y: T.y, k: T.k };
  document.body.classList.add("home");
  startOnboarding();
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
    o.className = "splash";
    size();
    cv.classList.remove("h");
    o.innerHTML = introMarkup();
    view(W / 2, H / 2, 1);
    document.querySelectorAll(".splash-node").forEach(configureSplashNode);
    positionSplashNodes();
    $("#go").onclick = async () => {
      if (suppressSplashClick) return;
      if (S.people.length) {
        if (!(await clearMapAfterConfirmation())) return;
      } else {
        resetAll();
        commit();
      }
      document.body.classList.remove("home");
      cv.classList.add("h");
      step = 1;
      obRender();
    };
    const continueButton = $("#continue");
    if (continueButton)
      continueButton.onclick = () => {
        if (!suppressSplashClick) endOnboarding();
      };
    $("#exm").onclick = () => {
      if (suppressSplashClick) return;
      splashReturnView = null;
      example();
    };
    $("#newMap").onclick = async () => {
      if (suppressSplashClick) return;
      if (S.people.length) {
        if (!(await clearMapAfterConfirmation())) return;
      } else {
        resetAll();
        commit();
      }
      splashReturnView = null;
      document.body.classList.remove("home");
      skipOnboarding();
    };
    return;
  }
  const i = step - 1;
  o.className = "top";
  o.innerHTML = `<div class="onb-step"><h1>${PR[i][0]}</h1><p class="mu">${PR[i][1]} You can edit this later.</p><div class="onb-entry"><input id="oi" placeholder="Name, then Enter"><button class="p" id="nx" title="${step < 3 ? "Next" : "Show my map"}" aria-label="${step < 3 ? "Next" : "Show my map"}">→</button></div><div id="ch" style="margin:10px 0;min-height:36px"></div></div>`;
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
    fadeInOnboardingRing(i + 1);
    applyTier(i);
    cv.classList.remove("h");
    setTimeout(
      () => {
        const panel = $("#ob>div");
        if (panel) panel.classList.add("leaving");
      },
      Math.max(0, DELAY - 260),
    );
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
window.addEventListener("resize", positionSplashNodes);
$("#hb").onclick = showHome;
$("#rb").onclick = async () => {
  if (!(await clearMapAfterConfirmation())) return;
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
