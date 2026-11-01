import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  CalendarDays,
  Download,
  Flower2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
  Heart,
  Leaf,
  Sun,
  LoaderCircle,
} from "lucide-react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  briefSchema,
  eventSchema,
  type Brief,
  type EventData,
  type Plan,
} from "../shared/schema";
import { demoEvent, initialBrief } from "./demo";
import { generateWithOwnKey, validKey, validModel } from "./gemini";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
const date = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const nav = [
  ["Overview", LayoutDashboard],
  ["Budget", Wallet],
  ["Timeline", CalendarDays],
  ["Vendors", Store],
  ["Ideas", Sparkles],
] as const;
function readLocal() {
  try {
    const raw = localStorage.getItem("gather-demo");
    return raw ? eventSchema.parse(JSON.parse(raw)) : demoEvent();
  } catch {
    return demoEvent();
  }
}
function errorText(e: unknown) {
  const code = (e as { code?: string })?.code;
  if (code?.includes("popup-closed"))
    return "Sign-in was cancelled. You can try again.";
  if (code?.includes("permission-denied"))
    return "Access was denied. Check your sign-in and Firebase rules.";
  if (code?.includes("resource-exhausted"))
    return "Generation limit reached. Wait a moment, or try again tomorrow.";
  return e instanceof Error
    ? e.message
    : "Something went wrong. Please try again.";
}
export default function App() {
  const apiKey = useRef("");
  const [keyConnected, setKeyConnected] = useState(false);
  const [keyPanel, setKeyPanel] = useState(false);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [event, setEvent] = useState<EventData>(readLocal);
  const [tab, setTab] = useState("Overview");
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<{ id: string; data: EventData }[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [ready, setReady] = useState(!auth);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const loadVersion = useRef(0);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      loadVersion.current++;
      setUser(u);
      setEvents([]);
      setEventId(null);
      setLastSaved(null);
      setSaved(false);
      setEvent(readLocal());
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!user || !db) return;
    let active = true;
    getDocs(collection(db, "users", user.uid, "events"))
      .then((s) => {
        if (!active) return;
        const all = s.docs
          .flatMap((d) => {
            const parsed = eventSchema.safeParse(d.data());
            return parsed.success ? [{ id: d.id, data: parsed.data }] : [];
          })
          .sort((a, b) => b.data.updatedAt - a.data.updatedAt);
        setEvents(all);
        if (all[0]) {
          setEvent(all[0].data);
          setEventId(all[0].id);
          setLastSaved(JSON.stringify(all[0].data));
          setSaved(true);
        }
      })
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem("gather-demo", JSON.stringify(event));
      } catch {
        setError(
          "Local storage is full or unavailable. Export your plan to keep a copy.",
        );
      }
    }
  }, [event, user]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [modal]);
  const { plan } = event;
  const allocated = plan.budget.reduce((s, b) => s + b.amount, 0);
  const spent = plan.budget.reduce((s, b) => s + b.spent, 0);
  const done = plan.tasks.filter((t) => t.done).length;
  const pending = plan.tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.due.localeCompare(b.due));
  const days = Math.max(
    0,
    Math.ceil(
      (new Date(event.brief.date + "T23:59:59").getTime() - Date.now()) /
        86400000,
    ),
  );
  function changePlan(p: Plan) {
    setEvent((e) => ({ ...e, plan: p, updatedAt: Date.now() }));
    setSaved(false);
  }
  function openNew() {
    setBrief({
      ...initialBrief,
      name: "",
      type: "Wedding",
      preferences: "",
      date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    });
    setError("");
    setModal(true);
  }
  function closeModal() {
    if (busy) return;
    setModal(false);
    setError("");
    trigger.current?.focus();
  }
  async function generate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = briefSchema.safeParse(brief);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(". "));
      return;
    }
    if (brief.date < new Date().toISOString().slice(0, 10)) {
      setError("Choose today or a future date.");
      return;
    }
    setBusy(true);
    const version = loadVersion.current;
    try {
      let next: EventData;
      if (keyConnected) {
        const plan = await generateWithOwnKey(
          apiKey.current,
          model,
          parsed.data,
        );
        next = {
          brief: parsed.data,
          plan,
          source: "gemini",
          updatedAt: Date.now(),
        };
      } else {
        next = demoEvent(parsed.data);
      }
      if (version !== loadVersion.current) return;
      setEvent(next);
      setEventId(null);
      setSaved(false);
      setLastSaved(null);
      setTab("Overview");
      setModal(false);
      setNotice(
        next.source === "gemini"
          ? "Your personalized Gemini plan is ready. Changes are kept in this browser; export a copy or save to your account."
          : "Sample plan created locally. Add your own Gemini key in AI settings for a personalized plan.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function login() {
    if (!auth) {
      setNotice(
        "You’re in local demo mode. Follow README setup to connect Firebase and enable Google sign-in.",
      );
      return;
    }
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setNotice("Signed in. Your plans can now be saved securely.");
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function save() {
    if (!user || !db) {
      setNotice(
        "Demo changes are saved on this browser. Export a copy, or connect Firebase to save to an account.",
      );
      return;
    }
    const uid = user.uid;
    const version = loadVersion.current;
    setBusy(true);
    setError("");
    try {
      const data = eventSchema.parse(event);
      const ref = eventId
        ? doc(db, "users", uid, "events", eventId)
        : doc(collection(db, "users", uid, "events"));
      await setDoc(ref, data);
      if (version !== loadVersion.current) return;
      setEventId(ref.id);
      setLastSaved(JSON.stringify(data));
      setSaved(true);
      setEvents((all) => [
        { id: ref.id, data },
        ...all.filter((x) => x.id !== ref.id),
      ]);
      setNotice("Plan saved to your account.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function selectEvent(id: string) {
    const item = events.find((e) => e.id === id);
    if (item) {
      if (
        lastSaved !== JSON.stringify(event) &&
        !window.confirm(
          "Switch plans? Export or save your current edits first.",
        )
      )
        return;
      setEvent(item.data);
      setEventId(id);
      setLastSaved(JSON.stringify(item.data));
      setSaved(true);
      setTab("Overview");
    }
  }
  async function remove() {
    if (
      !user ||
      !db ||
      !eventId ||
      !window.confirm("Permanently delete this saved event?")
    )
      return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "events", eventId));
      setEvents((all) => all.filter((x) => x.id !== eventId));
      setEventId(null);
      setLastSaved(null);
      setEvent(demoEvent());
      setSaved(false);
      setNotice("Saved event deleted.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function exportPlan() {
    const blob = new Blob([JSON.stringify(event, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gather-plan.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function amount(id: string, key: "amount" | "spent", value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100000000) return;
    changePlan({
      ...plan,
      budget: plan.budget.map((b) => (b.id === id ? { ...b, [key]: n } : b)),
    });
  }
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a href="#main" className="brand">
          <Flower2 size={31} strokeWidth={1.5} />
          gather<span>®</span>
        </a>
        <div className="workspace">YOUR PLANNING SPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={tab === label ? "nav active" : "nav"}
              onClick={() => {
                setTab(label);
                setMobile(false);
              }}
            >
              <Icon size={19} />
              {label}
              {label === "Ideas" && <span className="tiny">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-card">
          <div className="mini-flower">✳</div>
          <h3>
            Big moments.
            <br />
            Little details.
          </h3>
          <p>
            We’ll help you make
            <br />
            room for both.
          </p>
          <button className="text-link" onClick={openNew}>
            Plan something new <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="account">
          <div className="avatar">{user?.displayName?.slice(0, 1) || "Y"}</div>
          <div>
            <strong>{user?.displayName || "Your creative space"}</strong>
            <small>
              {user ? "Personal account" : "Local plans · no sign-in"}
            </small>
          </div>
          {user && (
            <button
              aria-label="Sign out"
              className="icon"
              onClick={() => {
                void signOut(auth!).catch((e) => setError(errorText(e)));
              }}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
      <div className="body">
        <header className="topbar">
          <button
            className="icon mobile-menu"
            aria-label="Toggle menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="crumb">
            My workspace <span>/</span> <strong>{tab}</strong>
          </div>
          <div className="top-actions">
            <button
              className="button small"
              disabled={busy}
              aria-expanded={keyPanel}
              aria-controls="ai-settings"
              onClick={() => setKeyPanel(!keyPanel)}
            >
              <Sparkles size={14} />
              {keyConnected ? "AI connected" : "Add Gemini key"}
            </button>
            <span className="mode">
              <span />
              {keyConnected ? "Gemini connected" : "Sample workspace"}
            </span>
            <button
              className="button small"
              disabled={!ready || busy}
              onClick={user ? save : auth ? login : exportPlan}
            >
              {user
                ? saved
                  ? "Saved ✓"
                  : "Save plan"
                : auth
                  ? "Sign in"
                  : "Export"}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                A LITTLE LESS PLANNING. A LOT MORE LIVING.
              </div>
              <h1>
                {tab === "Overview"
                  ? "Good things come together."
                  : tab === "Budget"
                    ? "Make every detail count."
                    : tab === "Timeline"
                      ? "A little closer, every day."
                      : tab === "Vendors"
                        ? "Find your kind of people."
                        : "Make it unmistakably yours."}
              </h1>
              <p>
                {tab === "Overview"
                  ? "Your next beautiful moment starts with a thoughtful plan."
                  : "Thoughtful details for a celebration that feels like you."}
              </p>
            </div>
            <button
              ref={trigger}
              className="button primary"
              onClick={openNew}
              disabled={busy}
            >
              <Plus size={18} />
              New event
            </button>
          </div>
          {(notice || error) && !modal && (
            <div
              className={error ? "message error" : "message"}
              role={error ? "alert" : "status"}
            >
              {error || notice}
              <button
                className="icon"
                aria-label="Dismiss message"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {keyPanel && (
            <section
              className="card key-settings"
              id="ai-settings"
              aria-label="AI settings"
            >
              <div className="card-heading">
                <div>
                  <span className="eyebrow">
                    YOUR KEY. YOUR CREATIVE SPACE.
                  </span>
                  <h3>Bring your own Gemini</h3>
                </div>
                <button
                  className="icon"
                  aria-label="Close AI settings"
                  onClick={() => setKeyPanel(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <p>
                Use your own key from{" "}
                <a
                  href="https://aistudio.google.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google AI Studio
                </a>
                . It is held only in memory until you remove it or reload this
                page, and sent directly to Google with your event details. It is
                never saved in browser storage, exported plans, or Firebase.
              </p>
              <p>
                Browser keys are visible to the person using this browser. Use
                your own key on a trusted device; usage counts toward your
                Google API quota and any charges.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  const key = String(data.get("geminiKey") || "").trim();
                  const chosenModel = String(
                    data.get("geminiModel") || "",
                  ).trim();
                  if (!validModel(chosenModel)) {
                    setError(
                      "Enter a Gemini model name, such as gemini-2.5-flash.",
                    );
                    return;
                  }
                  if (!keyConnected && !validKey(key)) {
                    setError("Enter a valid Gemini API key.");
                    return;
                  }
                  if (key && !validKey(key)) {
                    setError("Enter a valid Gemini API key.");
                    return;
                  }
                  if (key) apiKey.current = key;
                  setKeyConnected(true);
                  setModel(chosenModel);
                  form.reset();
                  setKeyPanel(false);
                  setError("");
                  setNotice(
                    "Gemini key added for this tab only. Create a new event to generate your personalized plan.",
                  );
                }}
              >
                <div className="form-grid">
                  <label>
                    {keyConnected
                      ? "Replace API key (optional)"
                      : "Gemini API key"}
                    <input
                      type="password"
                      name="geminiKey"
                      autoComplete="off"
                      spellCheck={false}
                      required={!keyConnected}
                      minLength={20}
                      maxLength={200}
                      placeholder={
                        keyConnected
                          ? "Leave blank to keep current key"
                          : "Paste your own API key"
                      }
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Gemini model
                    <input
                      name="geminiModel"
                      defaultValue={model}
                      required
                      maxLength={88}
                      disabled={busy}
                    />
                  </label>
                </div>
                <div className="key-actions">
                  <button className="button primary" disabled={busy}>
                    Use my key
                  </button>
                  {keyConnected && (
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        apiKey.current = "";
                        setKeyConnected(false);
                        setKeyPanel(false);
                        setNotice("Gemini key removed from this tab.");
                      }}
                    >
                      Remove key
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
          <div className="event-toolbar">
            <div className="section-label">
              YOUR EVENT{" "}
              <span className="pill">
                {event.source === "demo" ? "SAMPLE PLAN" : "GEMINI PLAN"}
              </span>
            </div>
            <div className="event-controls">
              {events.length > 0 && (
                <label className="saved-select">
                  Saved events{" "}
                  <select
                    aria-label="Open saved event"
                    value={eventId || ""}
                    onChange={(e) => selectEvent(e.target.value)}
                  >
                    <option value="" disabled>
                      Unsaved event
                    </option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.data.brief.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="text-link" onClick={exportPlan}>
                <Download size={15} />
                Export plan
              </button>
            </div>
          </div>
          {tab === "Overview" && (
            <>
              <section className="event-hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <Heart size={13} />
                    {event.brief.type.toUpperCase()} · THE NEXT CHAPTER
                  </span>
                  <h2>{event.brief.name}</h2>
                  <p>
                    {event.brief.type === "Wedding"
                      ? "A day for your favorite people. A lifetime of memories."
                      : plan.summary}
                  </p>
                  <div className="hero-meta">
                    <span>
                      <CalendarDays size={16} />
                      {date(event.brief.date)}
                    </span>
                    <span>
                      <MapPin size={16} />
                      {event.brief.location}
                    </span>
                    <span>
                      <Users size={16} />
                      {event.brief.guests} guests
                    </span>
                  </div>
                  <button
                    className="hero-button"
                    onClick={() => setTab("Timeline")}
                  >
                    Let’s bring it to life <ArrowRight size={16} />
                  </button>
                </div>
                <div
                  className="hero-art"
                  role="img"
                  aria-label="Illustrated garden celebration under a glowing sun"
                >
                  <div className="sun" />
                  <div className="arch arch-back" />
                  <div className="arch arch-front">
                    <div className="hanging-flower">✳</div>
                    <div className="vase" />
                    <div className="stem stem1" />
                    <div className="stem stem2" />
                    <div className="stem stem3" />
                  </div>
                  <div className="art-note">
                    made for
                    <br />
                    <em>memories.</em>
                    <span>✦</span>
                  </div>
                  <div className="leaf-shape l1" />
                  <div className="leaf-shape l2" />
                  <div className="ground" />
                </div>
                <div className="countdown">
                  <span>{days}</span> DAYS TO GO <Sun size={17} />
                </div>
              </section>
              <div className="stats">
                <article>
                  <div className="stat-label">
                    Total budget <Wallet size={17} />
                  </div>
                  <strong>{money(event.brief.budget)}</strong>
                  <small>
                    {money(Math.max(0, event.brief.budget - spent))} left to
                    make magic
                  </small>
                  <div className="progress">
                    <span
                      style={{
                        width:
                          Math.min(100, (spent / event.brief.budget) * 100) +
                          "%",
                      }}
                    />
                  </div>
                </article>
                <article>
                  <div className="stat-label">
                    Planning progress <CheckCheck size={18} />
                  </div>
                  <strong>
                    {Math.round((done / plan.tasks.length) * 100)}
                    <i>%</i>
                  </strong>
                  <small>
                    {done} of {plan.tasks.length} tasks checked off
                  </small>
                  <div className="progress">
                    <span
                      style={{ width: (done / plan.tasks.length) * 100 + "%" }}
                    />
                  </div>
                </article>
                <article>
                  <div className="stat-label">
                    Your people <Users size={18} />
                  </div>
                  <strong>
                    {event.brief.guests}
                    <i> guests</i>
                  </strong>
                  <small>A room full of your favorite faces</small>
                  <div className="people">
                    <span>A</span>
                    <span>R</span>
                    <span>M</span>
                    <span>+{Math.max(0, event.brief.guests - 3)}</span>
                    <em>All are welcome.</em>
                  </div>
                </article>
              </div>
              <div className="overview-grid">
                <section className="card next">
                  <div className="card-heading">
                    <div>
                      <span className="eyebrow">ONE STEP AT A TIME</span>
                      <h3>Coming up next</h3>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setTab("Timeline")}
                    >
                      View timeline <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {pending.length ? (
                    pending.slice(0, 3).map((t) => (
                      <div className="task-row" key={t.id}>
                        <input
                          type="checkbox"
                          aria-label={"Complete " + t.title}
                          checked={t.done}
                          onChange={() =>
                            changePlan({
                              ...plan,
                              tasks: plan.tasks.map((x) =>
                                x.id === t.id ? { ...x, done: true } : x,
                              ),
                            })
                          }
                        />
                        <div>
                          <strong>{t.title}</strong>
                          <small>{t.category}</small>
                        </div>
                        <span className="due">
                          {date(t.due).replace(/ \d{4}$/, "")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="complete">
                      <Check />
                      Everything is checked off. Enjoy your moment!
                    </p>
                  )}
                </section>
                <section className="inspiration">
                  <span className="ai-label">
                    <Sparkles size={15} /> A LITTLE INSPIRATION
                  </span>
                  <h3>
                    The kind of details
                    <br />
                    people remember.
                  </h3>
                  <p>{plan.ideas[0].description}</p>
                  <button className="text-link" onClick={() => setTab("Ideas")}>
                    Explore your ideas <ArrowRight size={16} />
                  </button>
                  <Flower2
                    className="idea-flower"
                    size={94}
                    strokeWidth={0.8}
                  />
                </section>
              </div>
            </>
          )}
          {tab === "Budget" && (
            <section className="card full">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">ROOM FOR WHAT MATTERS</span>
                  <h2>Your budget, beautifully balanced.</h2>
                  <p>
                    Estimates in INR. Update allocations and actual spending as
                    quotes arrive.
                  </p>
                </div>
                <Wallet size={30} />
              </div>
              <div className="budget-summary">
                <div>
                  <small>Total budget</small>
                  <strong>{money(event.brief.budget)}</strong>
                </div>
                <div>
                  <small>Allocated</small>
                  <strong>{money(allocated)}</strong>
                </div>
                <div>
                  <small>Actual spending</small>
                  <strong>{money(spent)}</strong>
                </div>
                <div>
                  <small>Unallocated</small>
                  <strong>{money(event.brief.budget - allocated)}</strong>
                </div>
              </div>
              {(allocated > event.brief.budget ||
                spent > event.brief.budget) && (
                <p role="alert" className="message error">
                  Your{" "}
                  {allocated > event.brief.budget ? "allocations" : "spending"}{" "}
                  exceed your total budget. Adjust the amounts below.
                </p>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Allocation (₹)</th>
                      <th>Spent (₹)</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.budget.map((b) => (
                      <tr key={b.id}>
                        <th scope="row">{b.category}</th>
                        <td>
                          <input
                            aria-label={b.category + " allocation"}
                            type="number"
                            min="0"
                            max="100000000"
                            value={b.amount}
                            onChange={(e) =>
                              amount(b.id, "amount", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={b.category + " spent"}
                            type="number"
                            min="0"
                            max="100000000"
                            value={b.spent}
                            onChange={(e) =>
                              amount(b.id, "spent", e.target.value)
                            }
                          />
                        </td>
                        <td className={b.spent > b.amount ? "over" : ""}>
                          {money(b.amount - b.spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="footnote">
                Planning estimates only. Confirm prices and terms directly with
                vendors.
              </p>
            </section>
          )}
          {tab === "Timeline" && (
            <section className="card full">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">
                    FROM FIRST IDEA TO FINAL TOAST
                  </span>
                  <h2>Your path to the big day.</h2>
                  <p>
                    {done} of {plan.tasks.length} tasks complete. Make this
                    timeline your own.
                  </p>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    changePlan({
                      ...plan,
                      tasks: [
                        ...plan.tasks,
                        {
                          id: crypto.randomUUID(),
                          title: "New planning task",
                          category: "Planning",
                          due: event.brief.date,
                          done: false,
                        },
                      ],
                    })
                  }
                  disabled={plan.tasks.length >= 40}
                >
                  <Plus size={16} />
                  Add task
                </button>
              </div>
              <div className="timeline">
                {[...plan.tasks]
                  .sort((a, b) => a.due.localeCompare(b.due))
                  .map((t) => (
                    <div
                      className={"editable-task " + (t.done ? "done" : "")}
                      key={t.id}
                    >
                      <input
                        type="checkbox"
                        aria-label={"Complete " + t.title}
                        checked={t.done}
                        onChange={(e) =>
                          changePlan({
                            ...plan,
                            tasks: plan.tasks.map((x) =>
                              x.id === t.id
                                ? { ...x, done: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />
                      <div>
                        <input
                          className="task-title"
                          aria-label="Task title"
                          maxLength={160}
                          required
                          value={t.title}
                          onChange={(e) =>
                            changePlan({
                              ...plan,
                              tasks: plan.tasks.map((x) =>
                                x.id === t.id
                                  ? { ...x, title: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                        <span className="category">{t.category}</span>
                      </div>
                      <input
                        aria-label={"Due date for " + t.title}
                        type="date"
                        max={event.brief.date}
                        value={t.due}
                        onChange={(e) => {
                          if (e.target.value)
                            changePlan({
                              ...plan,
                              tasks: plan.tasks.map((x) =>
                                x.id === t.id
                                  ? { ...x, due: e.target.value }
                                  : x,
                              ),
                            });
                        }}
                      />
                      <button
                        className="icon"
                        disabled={plan.tasks.length <= 1}
                        aria-label={"Delete " + t.title}
                        onClick={() =>
                          changePlan({
                            ...plan,
                            tasks: plan.tasks.filter((x) => x.id !== t.id),
                          })
                        }
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}
          {tab === "Vendors" && (
            <section>
              <div className="subheading">
                <div>
                  <h2>Your celebration crew.</h2>
                  <p>A practical checklist, ready for your shortlist.</p>
                </div>
                <span className="pill">
                  {plan.vendors.filter((v) => v.status === "Booked").length} /{" "}
                  {plan.vendors.length} BOOKED
                </span>
              </div>
              <div className="vendor-grid">
                {plan.vendors.map((v, i) => (
                  <article className="card vendor" key={v.id}>
                    <div className="vendor-icon">
                      {i % 2 ? <Leaf /> : <Store />}
                    </div>
                    <h3>{v.category}</h3>
                    <label>
                      Booking status
                      <select
                        value={v.status}
                        onChange={(e) =>
                          changePlan({
                            ...plan,
                            vendors: plan.vendors.map((x) =>
                              x.id === v.id
                                ? {
                                    ...x,
                                    status: e.target.value as typeof v.status,
                                  }
                                : x,
                            ),
                          })
                        }
                      >
                        <option>To research</option>
                        <option>Shortlisted</option>
                        <option>Booked</option>
                      </select>
                    </label>
                    <label>
                      Your notes
                      <textarea
                        rows={4}
                        maxLength={500}
                        value={v.notes}
                        onChange={(e) =>
                          changePlan({
                            ...plan,
                            vendors: plan.vendors.map((x) =>
                              x.id === v.id
                                ? { ...x, notes: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                  </article>
                ))}
              </div>
              <p className="footnote">
                Vendor categories are suggestions. No bookings or supplier
                endorsements are made by Gather.
              </p>
            </section>
          )}
          {tab === "Ideas" && (
            <section>
              <div className="subheading">
                <div>
                  <h2>A celebration with your signature.</h2>
                  <p>
                    {event.source === "gemini"
                      ? "Personalized with Gemini, inspired by your brief."
                      : "Curated sample ideas. Add your own Gemini key and generate a new event for personalization."}
                  </p>
                </div>
                <Sparkles size={27} />
              </div>
              <div className="idea-grid">
                {plan.ideas.map((idea, i) => (
                  <article
                    className={"idea-card idea-" + (i % 3)}
                    key={idea.title}
                  >
                    <div className="idea-illustration">
                      {i % 3 === 0 ? (
                        <Flower2 size={95} strokeWidth={0.8} />
                      ) : i % 3 === 1 ? (
                        <Leaf size={95} strokeWidth={0.8} />
                      ) : (
                        <Sun size={95} strokeWidth={0.8} />
                      )}
                      <span>0{i + 1}</span>
                    </div>
                    <span className="eyebrow">THOUGHTFULLY YOURS</span>
                    <h3>{idea.title}</h3>
                    <p>{idea.description}</p>
                  </article>
                ))}
              </div>
              <section className="card brief-note">
                <Sparkles />
                <div>
                  <h3>Your creative direction</h3>
                  <p>
                    {event.brief.preferences ||
                      "Create a new event and share your favorite colors, traditions, access needs, and food preferences."}
                  </p>
                </div>
              </section>
            </section>
          )}
          <footer>
            <span>
              <Flower2 size={15} /> Made for moments that matter.
            </span>
            <span>
              {event.source === "demo"
                ? "Local sample · Gemini not connected to this plan"
                : "AI-assisted · Review details before booking"}
              {user && eventId && (
                <button
                  className="text-link danger"
                  disabled={busy}
                  onClick={remove}
                >
                  Delete event
                </button>
              )}
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          closeModal();
        }}
        className="event-dialog"
        aria-labelledby="event-dialog-title"
      >
        <form onSubmit={generate}>
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">LET’S MAKE SOMETHING MEMORABLE</span>
              <h2 id="event-dialog-title">What are we celebrating?</h2>
            </div>
            <button
              type="button"
              aria-label="Close new event"
              className="icon"
              disabled={busy}
              onClick={closeModal}
            >
              <X />
            </button>
          </div>
          <p>Share a few details. We’ll help with the rest.</p>
          <div className="type-picker">
            {(["Wedding", "Birthday", "Community"] as const).map((t) => (
              <button
                type="button"
                className={brief.type === t ? "selected" : ""}
                aria-pressed={brief.type === t}
                key={t}
                onClick={() => setBrief({ ...brief, type: t })}
              >
                {t === "Wedding" ? (
                  <Heart size={17} />
                ) : t === "Birthday" ? (
                  <Sparkles size={17} />
                ) : (
                  <Users size={17} />
                )}{" "}
                {t}
              </button>
            ))}
          </div>
          <label>
            Event name
            <input
              autoFocus
              required
              minLength={3}
              maxLength={90}
              placeholder="e.g. Maya’s milestone birthday"
              value={brief.name}
              onChange={(e) => setBrief({ ...brief, name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Event date
              <input
                required
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={brief.date}
                onChange={(e) => setBrief({ ...brief, date: e.target.value })}
              />
            </label>
            <label>
              Location
              <input
                required
                minLength={2}
                maxLength={100}
                value={brief.location}
                onChange={(e) =>
                  setBrief({ ...brief, location: e.target.value })
                }
              />
            </label>
            <label>
              Guest count
              <input
                required
                type="number"
                min={1}
                max={10000}
                value={brief.guests}
                onChange={(e) =>
                  setBrief({ ...brief, guests: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Total budget (INR)
              <input
                required
                type="number"
                min={1000}
                max={100000000}
                value={brief.budget}
                onChange={(e) =>
                  setBrief({ ...brief, budget: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            The little things that matter
            <textarea
              rows={3}
              maxLength={1500}
              placeholder="Your style, traditions, favorite food, accessibility needs…"
              value={brief.preferences}
              onChange={(e) =>
                setBrief({ ...brief, preferences: e.target.value })
              }
            />
          </label>
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          <p className="footnote">
            {keyConnected
              ? "Your key and these event details will be sent directly to Google Gemini. Usage applies to your own API quota. Avoid sensitive personal information."
              : "No Gemini key is connected. This creates a local sample. Add your own key in AI settings for a personalized Gemini plan; no sign-in is required."}{" "}
            Creating a plan replaces the current view; save or export edits
            first.
          </p>
          <button className="button primary generate" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}{" "}
            {busy
              ? "Bringing your plan together…"
              : keyConnected
                ? "Create my plan with Gemini"
                : "Create a sample plan"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
