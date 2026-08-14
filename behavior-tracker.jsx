import { useState, useEffect, useMemo } from "react";

const DEFAULT_CLASSES = ["World History", "Algebra 2"];

const DEFAULT_CARD_TYPES = [
  { id: "tardy", label: "Tardy", color: "red" },
  { id: "early", label: "Work in early (sports/trip)", color: "blue" },
  { id: "above", label: "Above & beyond", color: "emerald" },
  { id: "missing", label: "Missing/incomplete work", color: "amber" },
  { id: "participation", label: "Strong participation", color: "violet" },
  { id: "pass", label: "Used a pass", color: "orange" },
  { id: "late", label: "Late work accepted", color: "stone" },
  { id: "redirect", label: "Redirect needed", color: "zinc" },
];

const COLOR_CHOICES = [
  "red", "orange", "amber", "yellow", "lime", "emerald", "teal",
  "cyan", "blue", "indigo", "violet", "fuchsia", "pink", "stone", "zinc", "black",
];

const COLOR_BG = {
  red: "bg-red-600", orange: "bg-orange-600", amber: "bg-amber-600",
  yellow: "bg-yellow-500", lime: "bg-lime-600", emerald: "bg-emerald-600",
  teal: "bg-teal-600", cyan: "bg-cyan-600", blue: "bg-blue-600",
  indigo: "bg-indigo-600", violet: "bg-violet-600", fuchsia: "bg-fuchsia-600",
  pink: "bg-pink-600", stone: "bg-stone-600", zinc: "bg-zinc-600", black: "bg-black",
};
const COLOR_BG_SOFT = {
  red: "bg-red-50 border-red-200", orange: "bg-orange-50 border-orange-200",
  amber: "bg-amber-50 border-amber-200", yellow: "bg-yellow-50 border-yellow-200",
  lime: "bg-lime-50 border-lime-200", emerald: "bg-emerald-50 border-emerald-200",
  teal: "bg-teal-50 border-teal-200", cyan: "bg-cyan-50 border-cyan-200",
  blue: "bg-blue-50 border-blue-200", indigo: "bg-indigo-50 border-indigo-200",
  violet: "bg-violet-50 border-violet-200", fuchsia: "bg-fuchsia-50 border-fuchsia-200",
  pink: "bg-pink-50 border-pink-200", stone: "bg-stone-50 border-stone-200",
  zinc: "bg-zinc-50 border-zinc-200", black: "bg-zinc-100 border-zinc-300",
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    if (res && res.value) return JSON.parse(res.value);
    return fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch {
    // ignore transient storage failures; state still holds in memory
  }
}

export default function BehaviorTracker() {
  const [ready, setReady] = useState(false);
  const [classes, setClasses] = useState(DEFAULT_CLASSES);
  const [activeClass, setActiveClass] = useState(DEFAULT_CLASSES[0]);
  const [tab, setTab] = useState("log");
  const [roster, setRoster] = useState({});
  const [cardTypes, setCardTypes] = useState(DEFAULT_CARD_TYPES);
  const [entries, setEntries] = useState([]);
  const [flashId, setFlashId] = useState(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState("");
  const [newCardColor, setNewCardColor] = useState("blue");
  const [newClassName, setNewClassName] = useState("");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    (async () => {
      const config = await loadKey("config", null);
      const savedEntries = await loadKey("entries", []);
      if (config) {
        const loadedClasses = config.classes && config.classes.length ? config.classes : DEFAULT_CLASSES;
        setClasses(loadedClasses);
        setActiveClass(loadedClasses[0]);
        setRoster(config.roster || {});
        setCardTypes(config.cardTypes || DEFAULT_CARD_TYPES);
      }
      setEntries(savedEntries);
      setReady(true);
    })();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function persistConfig(nextRoster, nextCardTypes, nextClasses) {
    const finalClasses = nextClasses || classes;
    setRoster(nextRoster);
    setCardTypes(nextCardTypes);
    setClasses(finalClasses);
    await saveKey("config", { roster: nextRoster, cardTypes: nextCardTypes, classes: finalClasses });
  }

  function addClass() {
    const name = newClassName.trim();
    if (!name || classes.includes(name)) return;
    const nextClasses = [...classes, name];
    persistConfig(roster, cardTypes, nextClasses);
    setActiveClass(name);
    setNewClassName("");
  }

  function removeClass(name) {
    if (classes.length <= 1) {
      showToast("Keep at least one class");
      return;
    }
    const nextClasses = classes.filter((c) => c !== name);
    const nextRoster = { ...roster };
    delete nextRoster[name];
    persistConfig(nextRoster, cardTypes, nextClasses);
    if (activeClass === name) setActiveClass(nextClasses[0]);
  }

  function moveClass(index, dir) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= classes.length) return;
    const nextClasses = [...classes];
    [nextClasses[index], nextClasses[newIndex]] = [nextClasses[newIndex], nextClasses[index]];
    persistConfig(roster, cardTypes, nextClasses);
  }

  function renameClass(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || classes.includes(trimmed)) return;
    const nextClasses = classes.map((c) => (c === oldName ? trimmed : c));
    const nextRoster = { ...roster };
    nextRoster[trimmed] = nextRoster[oldName] || [];
    delete nextRoster[oldName];
    persistConfig(nextRoster, cardTypes, nextClasses);
    if (activeClass === oldName) setActiveClass(trimmed);
  }

  async function persistEntries(nextEntries) {
    setEntries(nextEntries);
    await saveKey("entries", nextEntries);
  }

  function logCard(studentId, cardTypeId) {
    const entry = {
      id: uid(),
      classId: activeClass,
      studentId,
      cardTypeId,
      ts: Date.now(),
    };
    const next = [...entries, entry];
    persistEntries(next);
    setFlashId(studentId + cardTypeId);
    setTimeout(() => setFlashId(null), 400);
    const student = roster[activeClass].find((s) => s.id === studentId);
    const card = cardTypes.find((c) => c.id === cardTypeId);
    showToast(`${card.label} logged for ${student.name}`);
  }

  function undoLast() {
    if (entries.length === 0) return;
    const last = entries[entries.length - 1];
    persistEntries(entries.slice(0, -1));
    showToast("Last entry undone");
  }

  function removeEntry(entryId) {
    persistEntries(entries.filter((e) => e.id !== entryId));
    showToast("Entry removed");
  }

  function formatTs(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function addStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    const next = {
      ...roster,
      [activeClass]: [...(roster[activeClass] || []), { id: uid(), name }],
    };
    persistConfig(next, cardTypes);
    setNewStudentName("");
  }

  function parseNamesFromText(text) {
    // Splits on newlines and commas, strips a leading CSV "name" header if present,
    // and ignores anything after a comma on each line (e.g. "Last, First, Grade" -> takes first field per row,
    // but also handles simple one-name-per-line or comma-separated lists).
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const names = [];
    for (const line of lines) {
      // If the line itself has commas, treat each comma-separated piece as a possible name
      // unless it looks like "Last, First" (two short fields) in which case join them.
      const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length === 2 && !line.toLowerCase().startsWith("name")) {
        names.push(`${parts[1]} ${parts[0]}`);
      } else {
        for (const p of parts) {
          if (p && p.toLowerCase() !== "name" && p.toLowerCase() !== "student" && p.toLowerCase() !== "students") {
            names.push(p);
          }
        }
      }
    }
    return names;
  }

  function addBulkStudents(text) {
    const names = parseNamesFromText(text);
    if (names.length === 0) return;
    const existing = new Set((roster[activeClass] || []).map((s) => s.name.toLowerCase()));
    const additions = [];
    for (const name of names) {
      if (!existing.has(name.toLowerCase())) {
        existing.add(name.toLowerCase());
        additions.push({ id: uid(), name });
      }
    }
    const next = {
      ...roster,
      [activeClass]: [...(roster[activeClass] || []), ...additions],
    };
    persistConfig(next, cardTypes);
    setBulkText("");
    setBulkOpen(false);
    showToast(`Added ${additions.length} student${additions.length === 1 ? "" : "s"}`);
  }

  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => addBulkStudents(String(ev.target.result || ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  function removeStudent(studentId) {
    const next = {
      ...roster,
      [activeClass]: roster[activeClass].filter((s) => s.id !== studentId),
    };
    persistConfig(next, cardTypes);
  }

  function clearStudentEntries(studentId, studentName) {
    if (!window.confirm(`Clear all logged cards for ${studentName} in ${activeClass}? This cannot be undone.`)) return;
    persistEntries(entries.filter((e) => !(e.classId === activeClass && e.studentId === studentId)));
    showToast(`Cleared cards for ${studentName}`);
  }

  function clearClassEntries() {
    if (!window.confirm(`Clear ALL logged cards for every student in ${activeClass}? This is meant for starting a new quarter and cannot be undone.`)) return;
    persistEntries(entries.filter((e) => e.classId !== activeClass));
    showToast(`Cleared all cards for ${activeClass}`);
  }

  function addCardType() {
    const label = newCardLabel.trim();
    if (!label) return;
    const next = [...cardTypes, { id: uid(), label, color: newCardColor }];
    persistConfig(roster, next);
    setNewCardLabel("");
  }

  function removeCardType(cardTypeId) {
    const next = cardTypes.filter((c) => c.id !== cardTypeId);
    persistConfig(roster, next);
  }

  function moveCardType(index, dir) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= cardTypes.length) return;
    const next = [...cardTypes];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    persistConfig(roster, next);
  }

  const rangeMs = { all: Infinity, "7": 7 * 864e5, "30": 30 * 864e5, "90": 90 * 864e5 };

  const filteredEntries = useMemo(() => {
    const cutoff = rangeMs[rangeFilter];
    const now = Date.now();
    return entries.filter(
      (e) => e.classId === activeClass && (cutoff === Infinity || now - e.ts <= cutoff)
    );
  }, [entries, activeClass, rangeFilter]);

  const tally = useMemo(() => {
    const map = {};
    for (const s of roster[activeClass] || []) {
      map[s.id] = { name: s.name, counts: {}, total: 0 };
      for (const c of cardTypes) map[s.id].counts[c.id] = 0;
    }
    for (const e of filteredEntries) {
      if (!map[e.studentId]) continue;
      map[e.studentId].counts[e.cardTypeId] = (map[e.studentId].counts[e.cardTypeId] || 0) + 1;
      map[e.studentId].total += 1;
    }
    return map;
  }, [filteredEntries, roster, activeClass, cardTypes]);

  function exportCSV() {
    const header = ["Student", ...cardTypes.map((c) => c.label), "Total"];
    const rows = Object.values(tally).map((row) => [
      row.name,
      ...cardTypes.map((c) => row.counts[c.id] || 0),
      row.total,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeClass.replace(/\s+/g, "_")}_tally.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportEntryLogCSV() {
    const header = ["Date", "Time", "Student", "Card"];
    const rows = [...filteredEntries]
      .sort((a, b) => a.ts - b.ts)
      .map((e) => {
        const student = roster[activeClass]?.find((s) => s.id === e.studentId);
        const card = cardTypes.find((c) => c.id === e.cardTypeId);
        const d = new Date(e.ts);
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          student ? student.name : "(removed student)",
          card ? card.label : "(removed card type)",
        ];
      });
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeClass.replace(/\s+/g, "_")}_entry_log.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return <div className="p-8 text-slate-500 font-mono text-sm">Loading ledger…</div>;
  }

  const students = roster[activeClass] || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-5 pb-4">
        <h1 className="font-serif text-2xl tracking-tight">Behavior Ledger</h1>
        <p className="text-slate-400 text-sm mt-0.5 font-mono">tap a card to log it</p>
        <div className="flex gap-2 mt-4 flex-wrap">
          {classes.map((c) => (
            <button
              key={c}
              onClick={() => setActiveClass(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                activeClass === c
                  ? "bg-white text-slate-900"
                  : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
        {[
          ["log", "Log"],
          ["tally", "Tally"],
          ["manage", "Manage"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
              tab === key
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl">
        {tab === "log" && (
          <>
            {students.length === 0 && (
              <p className="text-sm text-slate-500 mt-6 text-center">
                No students in {activeClass} yet. Add your roster in the Manage tab.
              </p>
            )}
            <div className="space-y-3 mt-3">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                >
                  <div className="font-medium text-slate-800 mb-2">{s.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {cardTypes.map((c) => (
                      <button
                        key={c.id}
                        title={c.label}
                        onClick={() => logCard(s.id, c.id)}
                        className={`${COLOR_BG[c.color]} text-white text-xs px-2.5 py-1.5 rounded-md font-medium transition transform ${
                          flashId === s.id + c.id ? "scale-110 ring-2 ring-offset-1 ring-slate-400" : "hover:opacity-90"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {entries.length > 0 && (
              <button
                onClick={undoLast}
                className="mt-4 text-sm text-slate-500 underline underline-offset-2"
              >
                Undo last entry
              </button>
            )}
          </>
        )}

        {tab === "tally" && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex gap-1.5">
                {[
                  ["all", "All time"],
                  ["7", "7 days"],
                  ["30", "30 days"],
                  ["90", "90 days"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRangeFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      rangeFilter === key
                        ? "bg-slate-900 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={exportCSV}
                className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white"
              >
                Export CSV
              </button>
            </div>

            {students.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-6">
                Add students to {activeClass} to see tallies.
              </p>
            ) : (
              {cardTypes.length > 5 && (
                <p className="text-xs text-slate-400 mb-1">
                  ↔ Swipe/scroll sideways in the table to see all {cardTypes.length} categories — the Student column stays put.
                </p>
              )}
              <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
                <table className="text-sm font-mono" style={{ minWidth: "640px", width: "100%" }}>
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="p-2 font-sans font-medium text-slate-700 sticky left-0 bg-white z-10">Student</th>
                      {cardTypes.map((c) => (
                        <th key={c.id} className="p-2 text-center whitespace-nowrap">
                          <span className={`inline-block w-2 h-2 rounded-full ${COLOR_BG[c.color]} mr-1`} />
                          {c.label}
                        </th>
                      ))}
                      <th className="p-2 text-center font-sans font-medium text-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(tally).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="p-2 font-sans sticky left-0 bg-white">{row.name}</td>
                        {cardTypes.map((c) => (
                          <td key={c.id} className="p-2 text-center">
                            {row.counts[c.id] || 0}
                          </td>
                        ))}
                        <td className="p-2 text-center font-semibold">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={() => setShowHistory((v) => !v)}
              className="mt-3 text-sm text-slate-500 underline underline-offset-2"
            >
              {showHistory ? "Hide entry log" : "Show entry log (with timestamps)"}
            </button>

            {showHistory && (
              <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
                {filteredEntries.length === 0 ? (
                  <p className="text-sm text-slate-400 p-3 text-center">
                    No entries logged for this range yet.
                  </p>
                ) : (
                  <>
                  <div className="flex justify-end px-3 pt-2">
                    <button
                      onClick={exportEntryLogCSV}
                      className="text-xs text-emerald-700 underline underline-offset-2"
                    >
                      Export this log as CSV
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {[...filteredEntries]
                      .sort((a, b) => b.ts - a.ts)
                      .map((e) => {
                        const student = roster[activeClass]?.find((s) => s.id === e.studentId);
                        const card = cardTypes.find((c) => c.id === e.cardTypeId);
                        if (!student || !card) return null;
                        return (
                          <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${COLOR_BG[card.color]}`} />
                              <span className="font-medium truncate">{student.name}</span>
                              <span className="text-slate-400 truncate">{card.label}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                {formatTs(e.ts)}
                              </span>
                              <button
                                onClick={() => removeEntry(e.id)}
                                className="text-red-500 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "manage" && (
          <div className="mt-3 space-y-6">
            <section>
              <h2 className="font-serif text-lg mb-2">Classes / sections</h2>
              <div className="flex gap-2 mb-2">
                <input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addClass()}
                  placeholder='e.g. "World History (Period 2)"'
                  className="flex-1 border border-slate-300 rounded-md px-2.5 py-1.5 text-sm"
                />
                <button
                  onClick={addClass}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm"
                >
                  Add class
                </button>
              </div>
              <div className="space-y-1">
                {classes.map((c, i) => (
                  <div
                    key={c}
                    className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm gap-2"
                  >
                    <span className="flex flex-col shrink-0">
                      <button
                        onClick={() => moveClass(i, -1)}
                        disabled={i === 0}
                        className="text-slate-500 disabled:opacity-25 leading-none text-[10px] h-3.5"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveClass(i, 1)}
                        disabled={i === classes.length - 1}
                        className="text-slate-500 disabled:opacity-25 leading-none text-[10px] h-3.5"
                      >
                        ▼
                      </button>
                    </span>
                    <input
                      defaultValue={c}
                      onBlur={(e) => renameClass(c, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      className="flex-1 bg-transparent outline-none focus:underline"
                    />
                    <button
                      onClick={() => removeClass(c)}
                      className="text-red-500 text-xs ml-2 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Click a class name to rename it. Each class keeps its own roster and tallies.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-lg mb-2">Roster — {activeClass}</h2>
              <div className="flex gap-2 mb-2">
                <input
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStudent()}
                  placeholder="Student name"
                  className="flex-1 border border-slate-300 rounded-md px-2.5 py-1.5 text-sm"
                />
                <button
                  onClick={addStudent}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm"
                >
                  Add
                </button>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setBulkOpen((v) => !v)}
                    className="text-xs text-slate-500 underline underline-offset-2"
                  >
                    {bulkOpen ? "Hide bulk import" : "Bulk import roster"}
                  </button>
                  <label className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md cursor-pointer">
                    Upload CSV / TXT
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {bulkOpen && (
                  <div className="mt-2">
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={"Paste names, one per line:\nJane Smith\nJohn Doe\n\n(also handles \"Last, First\" per line)"}
                      rows={5}
                      className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm font-mono"
                    />
                    <button
                      onClick={() => addBulkStudents(bulkText)}
                      className="mt-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm"
                    >
                      Import list
                    </button>
                    <p className="text-xs text-slate-400 mt-1">
                      Duplicate names already in this class's roster are skipped.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    <span>{s.name}</span>
                    <span className="flex items-center gap-3">
                      <button
                        onClick={() => clearStudentEntries(s.id, s.name)}
                        className="text-amber-600 text-xs"
                      >
                        Clear cards
                      </button>
                      <button
                        onClick={() => removeStudent(s.id)}
                        className="text-red-500 text-xs"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-serif text-lg mb-2">Card types</h2>
              <div className="flex gap-2 mb-2 flex-wrap">
                <input
                  value={newCardLabel}
                  onChange={(e) => setNewCardLabel(e.target.value)}
                  placeholder="New card label"
                  className="flex-1 min-w-[140px] border border-slate-300 rounded-md px-2.5 py-1.5 text-sm"
                />
                <select
                  value={newCardColor}
                  onChange={(e) => setNewCardColor(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                >
                  {COLOR_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addCardType}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm"
                >
                  Add
                </button>
              </div>
              <div className="space-y-1">
                {cardTypes.map((c, i) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between border rounded-md px-2.5 py-1.5 text-sm gap-2 ${COLOR_BG_SOFT[c.color]}`}
                  >
                    <span className="flex flex-col shrink-0">
                      <button
                        onClick={() => moveCardType(i, -1)}
                        disabled={i === 0}
                        className="text-slate-500 disabled:opacity-25 leading-none text-[10px] h-3.5"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveCardType(i, 1)}
                        disabled={i === cardTypes.length - 1}
                        className="text-slate-500 disabled:opacity-25 leading-none text-[10px] h-3.5"
                      >
                        ▼
                      </button>
                    </span>
                    <span className="flex items-center gap-2 flex-1">
                      <span className={`w-3 h-3 rounded-full ${COLOR_BG[c.color]}`} />
                      {c.label}
                    </span>
                    <button
                      onClick={() => removeCardType(c.id)}
                      className="text-red-500 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-serif text-lg mb-2 text-red-700">Danger zone — new quarter reset</h2>
              <button
                onClick={clearClassEntries}
                className="px-3 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm font-medium"
              >
                Clear all cards for {activeClass}
              </button>
              <p className="text-xs text-slate-400 mt-1.5">
                Removes every logged card for every student in this class only — rosters, other
                classes, and card types are untouched. Consider exporting a backup first if you
                want a record of the quarter.
              </p>
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
