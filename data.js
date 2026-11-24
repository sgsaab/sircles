/* ---------- CSV ---------- */
const quoteCsvField = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
const serializeTier = (tier) =>
  tier === ROM ? "heart" : tier === BRK ? "broken" : (tier ?? "");
const serializeAdditionalGroups = (person) =>
  [...new Set(person.gs || [])].join("|");
function csvText() {
  const rows = [
    [
      "kind",
      "id",
      "name",
      "tier",
      "a",
      "b",
      "x",
      "y",
      "group",
      "color",
      "groups",
    ],
  ];
  tiers.forEach((name, index) =>
    rows.push([
      "tier",
      index + 1,
      name,
      "",
      "",
      "",
      "",
      "",
      "",
      G.tcol.o[index + 1] || "",
    ]),
  );
  rows.push(
    ["gradient", "a", "", "", "", "", "", "", "", G.tcol.a],
    ["gradient", "b", "", "", "", "", "", "", "", G.tcol.b],
  );
  Object.keys(G.cg).forEach((groupId) =>
    rows.push([
      "group",
      groupId,
      G.names[groupId] || "",
      "",
      "",
      "",
      "",
      "",
      "",
      G.colors[groupId] || "",
    ]),
  );
  S.people.forEach((person) =>
    rows.push([
      "person",
      person.id,
      person.name,
      serializeTier(person.tier),
      "",
      "",
      person.px ?? "",
      person.py ?? "",
      person.g ?? "",
      "",
      serializeAdditionalGroups(person),
      "",
    ]),
  );
  S.links.forEach((link) =>
    rows.push([
      "link",
      "",
      "",
      serializeTier(link.t),
      link.a,
      link.b,
      "",
      "",
      "",
      "",
    ]),
  );
  return rows.map((row) => row.map(quoteCsvField).join(",")).join("\n");
}
function exportCSV() {
  const u = URL.createObjectURL(new Blob([csvText()], { type: "text/csv" })),
    a = document.createElement("a");
  a.href = u;
  a.download = "sircles.csv";
  a.click();
  dirty = false;
  render();
}
function parseCSV(text) {
  const rows = [];
  let currentRow = [],
    currentField = "",
    insideQuotes = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (insideQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          currentField += '"';
          index++;
        } else insideQuotes = false;
      } else currentField += character;
    } else if (character === '"') insideQuotes = true;
    else if (character === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else currentField += character;
  }
  if (currentField || currentRow.length) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows.filter((row) => row.some((field) => field.trim()));
}
function parseLT(value, isLegacyFormat) {
  value = value.toLowerCase();
  if (value === "heart" || value === "h") return ROM;
  if (value === "broken" || value === "b") return BRK;
  if (value === "") return;
  const tier = +value;
  if (!Number.isFinite(tier)) return;
  if (isLegacyFormat) {
    if (tier === 0) return ROM;
    if (tier === 6) return BRK;
  }
  if (tier === 0) return BRK;
  return tier > 0 && tier <= MAXT ? tier : undefined;
}
async function importCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) return ask("That file is empty.");
  const headers = rows.shift().map((field) => field.trim().toLowerCase()),
    columnIndex = (name) => headers.indexOf(name),
    getCell = (row, name) =>
      columnIndex(name) < 0 ? "" : (row[columnIndex(name)] || "").trim();
  if (
    ["kind", "id", "name", "tier", "a", "b"].some(
      (name) => columnIndex(name) < 0,
    )
  )
    return ask(
      "Import failed: the header must start with kind,id,name,tier,a,b.",
    );
  const choice = await ask(
    "Import this file: replace everything, or merge it into your current map?",
    ["Cancel", "Merge", "Replace"],
  );
  if (choice === 0) return;

  const replaceExisting = choice === 2;
  const errors = [];
  const isLegacyFormat = !rows.some((row) => getCell(row, "kind") === "tier");
  const people = replaceExisting
    ? []
    : S.people.map((person) => ({ ...person }));
  const links = replaceExisting ? [] : S.links.map((link) => ({ ...link }));
  const tierNames = replaceExisting
    ? isLegacyFormat
      ? DEF.slice()
      : []
    : tiers.slice();
  const manualGroups = replaceExisting ? {} : { ...G.cg };
  const groupNames = replaceExisting ? {} : { ...G.names };
  const groupColors = replaceExisting ? {} : { ...G.colors };
  const tierColors = replaceExisting ? {} : { ...G.tcol.o };
  let gradientStart = replaceExisting ? TC0 : G.tcol.a;
  let gradientEnd = replaceExisting ? TC1 : G.tcol.b;

  rows.forEach((row) => {
    if (getCell(row, "kind") === "gradient" && getCell(row, "color")) {
      if (getCell(row, "id") === "b") gradientEnd = getCell(row, "color");
      else gradientStart = getCell(row, "color");
    }
  });
  rows.forEach((row) => {
    if (getCell(row, "kind") === "group" && getCell(row, "id")) {
      const groupId = getCell(row, "id");
      manualGroups[groupId] = 1;
      groupNames[groupId] = getCell(row, "name") || groupId;
      if (getCell(row, "color")) groupColors[groupId] = getCell(row, "color");
    }
  });
  rows.forEach((row, index) => {
    if (getCell(row, "kind") !== "tier") return;
    const tierNumber = parseInt(getCell(row, "id"), 10);
    if (!(tierNumber >= 1 && tierNumber <= MAXT)) {
      errors.push("Row " + (index + 2) + ": tier number must be 1–" + MAXT);
      return;
    }
    while (tierNames.length < tierNumber) tierNames.push("");
    tierNames[tierNumber - 1] = getCell(row, "name");
    if (getCell(row, "color")) tierColors[tierNumber] = getCell(row, "color");
  });
  rows.forEach((row, index) => {
    if (getCell(row, "kind") !== "person") return;
    const lineNumber = index + 2;
    const name = getCell(row, "name");
    const id = getCell(row, "id") || uid();
    const tierValue = getCell(row, "tier");
    const x = getCell(row, "x");
    const y = getCell(row, "y");
    const groupId = getCell(row, "group");
    const additionalGroups = [
      ...new Set(
        getCell(row, "groups")
          .split("|")
          .filter((additionalGroupId) => manualGroups[additionalGroupId]),
      ),
    ];
    if (!name) {
      errors.push("Row " + lineNumber + ": person needs a name");
      return;
    }
    const tier = tierValue === "" ? null : parseLT(tierValue, false);
    if (tierValue !== "" && tier === undefined) {
      errors.push(
        "Row " +
          lineNumber +
          ": tier to You must be 1–" +
          MAXT +
          ", heart or broken",
      );
      return;
    }
    if (people.find((person) => person.id === id)) return;
    people.push({
      id,
      name,
      tier,
      ...(x !== "" && y !== "" ? { px: +x, py: +y } : {}),
      ...(groupId === "-" || manualGroups[groupId] ? { g: groupId } : {}),
      ...(additionalGroups.length ? { gs: additionalGroups } : {}),
    });
  });
  const findPersonId = (value) =>
    (
      people.find((person) => person.id === value) ||
      people.find((person) => person.name === value) ||
      {}
    ).id;
  rows.forEach((row, index) => {
    if (getCell(row, "kind") !== "link") return;
    const lineNumber = index + 2;
    const personA = findPersonId(getCell(row, "a"));
    const personB = findPersonId(getCell(row, "b"));
    const tier = parseLT(getCell(row, "tier"), isLegacyFormat);
    if (!personA || !personB || personA === personB) {
      errors.push("Row " + lineNumber + ": unknown or identical people");
      return;
    }
    if (tier === undefined) {
      errors.push("Row " + lineNumber + ": unrecognised link tier");
      return;
    }
    const existingLink = links.find(
      (link) =>
        (link.a === personA && link.b === personB) ||
        (link.a === personB && link.b === personA),
    );
    if (existingLink) existingLink.t = tier;
    else links.push({ a: personA, b: personB, t: tier });
  });
  let maxTier = 2;
  people.forEach((person) => {
    if (typeof person.tier === "number" && person.tier > maxTier)
      maxTier = person.tier;
  });
  links.forEach((link) => {
    if (typeof link.t === "number" && link.t > maxTier) maxTier = link.t;
  });
  while (tierNames.length < maxTier) tierNames.push("");
  tiers = tierNames;
  S = { people, links };
  G = {
    n: G.n,
    names: groupNames,
    colors: groupColors,
    cg: manualGroups,
    tcol: { a: gradientStart, b: gradientEnd, o: tierColors },
    appearance: G.appearance,
  };
  if (replaceExisting) {
    G.n = 1;
    prev = {};
  }
  G.n = Math.max(
    G.n,
    ...Object.keys(manualGroups).map((groupId) => +groupId.slice(1) + 1 || 1),
  );
  sel = lv = null;
  selectedPeople.clear();
  commit();
  if (errors.length)
    await ask(
      esc(
        errors.length + " row(s) skipped:\n" + errors.slice(0, 15).join("\n"),
      ),
    );
}
$("#fi").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) importCSV(await file.text());
};
async function example() {
  if (
    S.people.length &&
    (await ask("Replace your current map with the example?", [
      "Cancel",
      "Replace",
    ])) !== 1
  )
    return;
  const people = [
      ["Maya", 1],
      ["Jon", 2],
      ["Priya", 2],
      ["Leo", 2],
      ["Sam", 3],
      ["Ava", 3],
      ["Noah", 3],
      ["Zoe", 3],
      ["Eli", 3],
      ["Kai", 4],
      ["Rin", 4],
      ["Omar", 4],
      ["Tess", 5],
    ],
    relationships = [
      ["Jon", "Priya", 2],
      ["Jon", "Leo", 2],
      ["Priya", "Leo", 3],
      ["Sam", "Jon", 3],
      ["Sam", "Leo", 2],
      ["Priya", "Sam", ROM],
      ["Ava", "Noah", 2],
      ["Ava", "Zoe", 3],
      ["Noah", "Zoe", 2],
      ["Eli", "Ava", 3],
      ["Eli", "Noah", 3],
      ["Kai", "Zoe", 3],
      ["Kai", "Eli", 3],
      ["Zoe", "Eli", BRK],
      ["Rin", "Omar", 2],
      ["Rin", "Tess", 3],
      ["Omar", "Tess", 3],
      ["Maya", "Jon", 1],
      ["Maya", "Ava", 4],
      ["Leo", "Ava", 5],
    ];
  resetAll();
  S.people = people.map(([name, tier]) => ({ id: uid(), name, tier }));
  relationships.forEach(([personA, personB, tier]) =>
    S.links.push({
      a: S.people.find((person) => person.name === personA).id,
      b: S.people.find((person) => person.name === personB).id,
      t: tier,
    }),
  );
  endOnboarding();
  commit();
}
