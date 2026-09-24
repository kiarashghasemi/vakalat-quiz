const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const LETTERS = ["A","B","C","D"];
const LAWS_KEY = "vakalat_my_laws_v1";
const IMP_KEY = "vakalat_important_v1";
const SET_KEY = "vakalat_settings_v1";

const state = {
  lessons: [],
  lesson: null,
  article: null,
  queue: [],
  idx: 0,
  timer: null,
  remain: 60,
  locked: false,
  score: {ok:0, no:0, skip:0},
  shuffled: [],
  correctLetter: "A",
  lastView: "home",
  originalCount: 0,
  retryNote: false,
  lessonMeta: null,
  pack: null,
  packId: null,
  mode: "practice",
  examAnswers: [],
  examRemain: 0,
};

const views = {
  home: $("#view-home"),
  packs: $("#view-packs"),
  articles: $("#view-articles"),
  quiz: $("#view-quiz"),
  laws: $("#view-laws"),
  important: $("#view-important"),
  "exam-setup": $("#view-exam-setup"),
  "exam-result": $("#view-exam-result"),
};
const PROG_KEY = "vakalat_pack_progress_v1";

function loadProg() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY) || "{}"); }
  catch { return {}; }
}
function saveProg(all) { localStorage.setItem(PROG_KEY, JSON.stringify(all)); }
function packProg() {
  const all = loadProg();
  const id = state.packId || "default";
  if (!all[id]) all[id] = { articleStats: {}, qStats: {}, examUsed: [], repeats: 8 };
  if (!all[id].articleStats) all[id].articleStats = {};
  if (!all[id].qStats) all[id].qStats = {};
  if (!all[id].examUsed) all[id].examUsed = [];
  if (!all[id].repeats) all[id].repeats = 8;
  return { all, p: all[id], id };
}
function recordAnswer(qid, artKey, ok) {
  if (!state.packId) return;
  const { all, p } = packProg();
  const a = p.articleStats[artKey] || { correct: 0, total: 0 };
  a.total += 1;
  if (ok) a.correct += 1;
  p.articleStats[artKey] = a;
  const q = p.qStats[qid] || { streak: 0, times: 0 };
  q.times += 1;
  q.streak = ok ? (q.streak || 0) + 1 : 0;
  p.qStats[qid] = q;
  all[state.packId] = p;
  saveProg(all);
}

function show(name) {
  Object.values(views).forEach(v => v && v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  const wrap = document.querySelector("main.wrap");
  if (wrap) wrap.classList.toggle("wide", name === "quiz");
  window.scrollTo({top:0, behavior:"smooth"});
}

function loadMine() {
  try { return JSON.parse(localStorage.getItem(LAWS_KEY) || "[]"); }
  catch { return []; }
}
function saveMine(list) {
  localStorage.setItem(LAWS_KEY, JSON.stringify(list));
  updateLawsCount();
}
function updateLawsCount() {
  const n = loadMine().length;
  const el = $("#laws-count");
  if (el) el.textContent = n;
}

function loadImportant() {
  try { return JSON.parse(localStorage.getItem(IMP_KEY) || "[]"); }
  catch { return []; }
}
function saveImportant(list) {
  localStorage.setItem(IMP_KEY, JSON.stringify(list));
  updateImpCount();
}
function updateImpCount() {
  const el = $("#imp-count");
  if (el) el.textContent = loadImportant().length;
}
function isImportant(id) {
  return loadImportant().some(x => String(x.id) === String(id));
}
function toggleImportant(q) {
  if (!q) return;
  let list = loadImportant();
  const i = list.findIndex(x => String(x.id) === String(q.id));
  if (i >= 0) list.splice(i, 1);
  else list.unshift({
    id: q.id,
    question: q.question,
    options: q.options,
    answer: q.answer,
    answer_text: q.answer_text,
    explain: q.explain,
    laws: q.laws,
    article: q.article,
    article_title: q.article_title,
    difficulty: q.difficulty,
    is_similar: q.is_similar,
    similar_count: q.similar_count,
    lesson: state.lesson ? state.lesson.name : "",
  });
  saveImportant(list);
  syncStarBtn();
}
function syncStarBtn() {
  const btn = $("#btn-star");
  if (!btn || !state.queue[state.idx]) return;
  const on = isImportant(state.queue[state.idx].id);
  btn.textContent = on ? "★ سوال مهم" : "☆ سوال مهم";
  btn.classList.toggle("on", on);
}

function loadSettings() {
  try { return Object.assign({fs:"17", theme:"paper"}, JSON.parse(localStorage.getItem(SET_KEY)||"{}")); }
  catch { return {fs:"17", theme:"paper"}; }
}
function applySettings() {
  const s = loadSettings();
  document.documentElement.style.setProperty("--fs", s.fs + "px");
  document.documentElement.style.setProperty("--qfs", (Number(s.fs) + 3) + "px");
  document.documentElement.setAttribute("data-theme", s.theme === "paper" ? "" : s.theme);
  if (s.theme === "paper") document.documentElement.removeAttribute("data-theme");
}

const LAW_NAMES = [
  "آئین دادرسی دادگاه های عمومی و انقلاب (در امور مدنی)",
  "آیین دادرسی دادگاه های عمومی و انقلاب (در امور مدنی)",
  "تشکیلات وآئین دادرسی دیوان عدالت اداری",
  "تشکیلات و آیین دادرسی دیوان عدالت اداری",
  "افراز و فروش املاک مشاع",
  "آئین دادرسی مدنی",
  "آیین دادرسی مدنی",
  "آئین دادرسی کیفری",
  "آیین دادرسی کیفری",
  "دیوان عدالت اداری",
  "شوراهای حل اختلاف",
  "مجازات اسلامی",
  "حمایت خانواده",
  "امور حسبی",
  "ثبت احوال",
  "قانون اساسی",
  "تجارت",
  "مدنی",
  "اساسی",
];

function lawTitleFromText(p) {
  const t = String(p).trim();
  let m = t.match(/^(اصل\s*\d+\s*قانون\s*اساسی)/);
  if (m) return m[1];
  m = t.match(/^(اصل\s*\d+)/);
  if (m) return m[1];
  for (const name of LAW_NAMES) {
    const re = new RegExp("^ماده\\s*\\d+\\s*قانون\\s+" + name.replace(/[()*+?]/g, "\\$&"), "i");
    const hit = t.match(re);
    if (hit) return hit[0];
  }
  m = t.match(/^(ماده\s*\d+\s*قانون\s+[^\d]{2,40}?)(?=\s+(?:دعاوی|دعوا|دعوای|هرگاه|هر |امور راجع|رسیدگی|اجاره|صلاحیت|حدود|ادعای|خوانده|خواهان|افراز|در صورتی|چنانچه|نسبت|اگر|کلیه|در کلیه))/);
  if (m) return m[1].trim();
  m = t.match(/^(ماده\s*\d+\s*قانون\s+\S+(?:\s+\S+){0,4})/);
  if (m) return m[1].trim();
  return "قانون مرتبط";
}

function parseLaws(raw="") {
  const text = String(raw || "").trim();
  if (!text || text === "قانون مرتبطی یافت نشد.") return [];
  const parts = text.split(/ارسال به قوانین من/g).map(s => s.trim()).filter(Boolean);
  return parts.map(p => ({ title: lawTitleFromText(p), body: p }));
}

function lawId(item) {
  return (item.title + "|" + item.body.slice(0,80)).slice(0,120);
}

function isSaved(item) {
  const id = lawId(item);
  return loadMine().some(x => x.id === id);
}

function toggleSaveLaw(item, btn) {
  const id = lawId(item);
  let list = loadMine();
  const i = list.findIndex(x => x.id === id);
  if (i >= 0) {
    list.splice(i, 1);
    if (btn) { btn.textContent = "ارسال به قوانین من"; btn.classList.remove("saved"); }
  } else {
    list.unshift({
      id,
      title: item.title,
      body: item.body,
      lesson: state.lesson ? state.lesson.name : "",
      qid: state.queue[state.idx] ? state.queue[state.idx].id : "",
      at: Date.now(),
    });
    if (btn) { btn.textContent = "ذخیره شد"; btn.classList.add("saved"); }
  }
  saveMine(list);
}

function shuffleOptions(q) {
  const orig = LETTERS.map(k => ({ orig: k, text: q.options[k] }));
  for (let i = orig.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orig[i], orig[j]] = [orig[j], orig[i]];
  }
  const mapped = orig.map((o, i) => ({ letter: LETTERS[i], text: o.text, orig: o.orig }));
  const correctOrig = (q.answer || "A").toUpperCase();
  const correctLetter = mapped.find(x => x.orig === correctOrig).letter;
  return { mapped, correctLetter };
}

async function boot() {
  applySettings();
  updateLawsCount();
  updateImpCount();
  try {
    const res = await fetch("data/lessons.json");
    const data = await res.json();
    state.lessons = data.lessons;
    renderLessons();
  } catch (e) {
    $("#lessons").innerHTML = `<p>فایل data/lessons.json پیدا نشد. روی گیت‌هاب باید پوشه data هم پوش شود.</p>`;
  }
}

function renderLessons() {
  const box = $("#lessons");
  box.innerHTML = "";
  state.lessons.forEach(ls => {
    const el = document.createElement("div");
    el.className = "card" + (ls.ready ? "" : " disabled");
    const packs = (ls.packs || []).length;
    el.innerHTML = `
      <h3>${ls.name}</h3>
      <div class="meta">
        <span class="pill">${ls.ready ? ls.count + " سوال" : "فایل اکسل را اضافه کنید"}</span>
        ${packs ? `<span class="pill">${packs} بسته</span>` : ""}
      </div>`;
    if (ls.ready) el.onclick = () => openLesson(ls);
    box.appendChild(el);
  });
}

function openLesson(ls) {
  state.lessonMeta = ls;
  $("#lesson-packs-title").textContent = ls.name;
  const box = $("#packs");
  box.innerHTML = "";
  (ls.packs || []).forEach(pk => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<h3>${pk.name}</h3><div class="meta"><span class="pill">${pk.count} سوال</span></div>`;
    el.onclick = () => openPack(pk);
    box.appendChild(el);
  });
  show("packs");
}

async function openPack(pk) {
  const res = await fetch(pk.file);
  state.lesson = await res.json();
  state.pack = pk;
  state.packId = pk.id;
  $("#lesson-title").textContent = `${state.lessonMeta ? state.lessonMeta.name + " / " : ""}${pk.name}`;
  const hardN = state.lesson.articles.reduce((s,a) => s + (a.hard||0), 0);
  $("#lesson-sub").textContent = `${state.lesson.count} سوال در ${state.lesson.articles.length} ماده · ${hardN} سخت`;
  const { p } = packProg();
  const sel = $("#pack-repeats");
  if (sel) sel.value = String(p.repeats || 8);
  renderArticles();
  show("articles");
}

function renderArticles() {
  const box = $("#articles");
  box.innerHTML = "";
  const sort = $("#sort-mode").value;
  let arts = [...state.lesson.articles];
  if (sort === "hard") arts.sort((a,b) => (b.hard-a.hard) || (b.medium-a.medium));
  if (sort === "count") arts.sort((a,b) => b.count - a.count);
  if (sort === "name") arts.sort((a,b) => a.key.localeCompare(b.key, "fa"));
  const { p } = packProg();
  const repeats = p.repeats || 8;

  arts.forEach(art => {
    const st = p.articleStats[art.key] || { correct: 0, total: 0 };
    const mastered = art.questions.filter(q => (p.qStats[q.id] || {}).streak >= repeats).length;
    const el = document.createElement("div");
    el.className = "card";
    const done = st.total > 0
      ? `<span class="pill easy">زده شده ${st.correct}/${st.total} · لایتنر ${mastered}/${art.count}</span>`
      : `<span class="pill">هنوز نزده‌ای</span>`;
    el.innerHTML = `
      <h3>${art.key}</h3>
      <div class="meta" style="margin-bottom:8px">${art.title}</div>
      <div class="meta">
        <span class="pill">${art.count} سوال</span>
        ${art.hard ? `<span class="pill hard">سخت ${art.hard}</span>` : ""}
        ${art.medium ? `<span class="pill mid">متوسط ${art.medium}</span>` : ""}
        ${art.easy ? `<span class="pill easy">آسان ${art.easy}</span>` : ""}
        ${done}
      </div>`;
    el.onclick = () => startQuiz(art);
    box.appendChild(el);
  });
}

function startQuiz(art, filter="all") {
  state.article = art;
  let qs = [...art.questions];
  const diffOrder = { "سخت":0, "متوسط":1, "آسان":2 };
  qs.sort((a,b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);
  if (filter === "hard") qs = qs.filter(q => q.difficulty === "سخت");
  if (filter === "easy") qs = qs.filter(q => q.difficulty === "آسان");
  if (!qs.length) {
    alert("در این مجموعه سوال سختی ثبت نشده.");
    return;
  }
  if (state.mode !== "exam") state.mode = "practice";
  state.queue = qs;
  state.idx = 0;
  state.originalCount = qs.length;
  state.score = {ok:0, no:0, skip:0};
  $("#quiz-head").textContent = `${art.key} — ${art.title}${filter==="hard" ? " (فقط سخت)" : ""}`;
  show("quiz");
  drawQuestion();
}

function allQuestions() {
  return state.lesson.articles.flatMap(a => a.questions);
}

function drawQuestion() {
  clearInterval(state.timer);
  state.locked = false;
  if (state.mode !== "exam") state.remain = 60;
  const q = state.queue[state.idx];
  const sh = shuffleOptions(q);
  state.shuffled = sh.mapped;
  state.correctLetter = sh.correctLetter;
  const total = state.queue.length;
  const extra = total - state.originalCount;
  const qid = q.id ? ` · تکرار تا درست بزنی` : "";
  $("#q-progress-label").textContent = extra > 0
    ? `سوال ${state.idx+1} از ${total} (اصلی ${state.originalCount} + تکرار ${extra})`
    : `سوال ${state.idx+1} از ${total}`;
  $("#progress-bar").style.width = `${((state.idx)/total)*100}%`;
  if (state.mode === "exam") {
    $("#timer").textContent = formatRemain(state.examRemain);
    $("#timer").className = "timer";
  } else {
    $("#timer").textContent = "60";
    $("#timer").className = "timer";
  }
  $("#q-badges").innerHTML = `
    <span class="pill ${q.difficulty==="سخت"?"hard":q.difficulty==="متوسط"?"mid":"easy"}">${q.difficulty}</span>
    ${q.source ? `<span class="pill">${q.source}</span>` : ""}
    ${q._retry ? `<span class="pill hard">تکرار سوال غلط</span>` : ""}
    ${q.is_similar ? `<span class="pill sim">شبیه هم · ${q.similar_count} مورد</span>` : ""}
  `;
  $("#q-text").textContent = q.question;
  const box = $("#options");
  box.innerHTML = "";
  sh.mapped.forEach(o => {
    const b = document.createElement("button");
    b.className = "opt";
    b.dataset.letter = o.letter;
    b.innerHTML = `<b>${o.letter}</b> ${o.text}`;
    b.onclick = () => lock(o.letter);
    box.appendChild(b);
  });
  $("#result").classList.add("hidden");
  $("#nav-top").classList.add("hidden");
  $("#btn-next").classList.add("hidden");
  $("#btn-reveal").classList.remove("hidden");
  syncPrevButtons();
  syncStarBtn();
  if (state.mode === "exam") {
    $("#btn-reveal").classList.add("hidden");
    state.timer = setInterval(() => {
      state.examRemain -= 1;
      $("#timer").textContent = formatRemain(state.examRemain);
      if (state.examRemain <= 60) $("#timer").classList.add("warn");
      if (state.examRemain <= 0) {
        $("#timer").classList.add("dead");
        finishExam(true);
      }
    }, 1000);
    return;
  }
  state.timer = setInterval(() => {
    state.remain -= 1;
    $("#timer").textContent = String(state.remain);
    if (state.remain <= 10) $("#timer").classList.add("warn");
    if (state.remain <= 0) {
      $("#timer").classList.add("dead");
      lock(null);
    }
  }, 1000);
}

function formatRemain(s) {
  s = Math.max(0, s|0);
  const m = Math.floor(s/60), r = s%60;
  return `${m}:${String(r).padStart(2,"0")}`;
}

function lock(choice) {
  if (state.locked) return;
  state.locked = true;
  clearInterval(state.timer);
  const q = state.queue[state.idx];
  const correct = state.correctLetter;
  const correctText = (state.shuffled.find(x => x.letter === correct) || {}).text
    || q.answer_text
    || q.options[(q.answer||"A").toUpperCase()];
  $$("#options .opt").forEach(el => {
    const key = el.dataset.letter;
    if (key === correct) el.classList.add("right");
    if (choice && key === choice && choice !== correct) el.classList.add("wrong");
    if (choice && key === choice) el.classList.add("picked");
    el.disabled = true;
  });
  const ok = choice === correct;
  if (state.mode === "exam") {
    if (!choice) state.score.skip++;
    else if (ok) state.score.ok++;
    else state.score.no++;
    state.examAnswers.push({ q, choice, correct, ok, correctText });
    recordAnswer(q.id, q.article || (state.article && state.article.key), ok);
    if (state.idx + 1 >= state.queue.length) finishExam(false);
    else { state.idx += 1; drawQuestion(); }
    return;
  }

  const box = $("#result");
  box.classList.remove("hidden");
  let verdict, cls;
  if (!choice) {
    state.score.skip++;
    verdict = "زمان تمام شد — این سوال دوباره در صف می‌آید";
    cls = "no";
    queueRetry(q);
    recordAnswer(q.id, q.article || (state.article && state.article.key), false);
  } else if (ok) {
    state.score.ok++;
    verdict = "درست زدی";
    cls = "ok";
    recordAnswer(q.id, q.article || (state.article && state.article.key), true);
  } else {
    state.score.no++;
    verdict = "غلط بود — این سوال دوباره در صف می‌آید تا درست بزنی";
    cls = "no";
    queueRetry(q);
    recordAnswer(q.id, q.article || (state.article && state.article.key), false);
  }

  const laws = parseLaws(q.laws);
  const lawsHtml = laws.map((item, i) => {
    const saved = isSaved(item);
    return `<div class="law-card">
      <div class="law-title">${escapeHtml(item.title)}</div>
      <div class="law-body">${escapeHtml(item.body)}</div>
      <button class="law-save ${saved ? "saved" : ""}" data-law="${i}">${saved ? "ذخیره شد" : "ارسال به قوانین من"}</button>
    </div>`;
  }).join("");

  box.innerHTML = `
    <div class="verdict ${cls}">${verdict}</div>
    <div>گزینه صحیح در این دور: <b>${correct}</b> — ${escapeHtml(correctText || "")}</div>
    <div class="explain"><b>پاسخ تشریحی:</b><br>${escapeHtml(q.explain)}</div>
    ${lawsHtml ? `<div class="laws">${lawsHtml}</div>` : ""}
  `;
  box.querySelectorAll("[data-law]").forEach(btn => {
    btn.onclick = () => toggleSaveLaw(laws[Number(btn.dataset.law)], btn);
  });

  $("#btn-reveal").classList.add("hidden");
  $("#nav-top").classList.remove("hidden");
  $("#btn-next").classList.remove("hidden");
  const lastLabel = state.idx + 1 >= state.queue.length ? "پایان و نتیجه" : "سوال بعدی";
  $("#btn-next").textContent = lastLabel;
  $("#btn-next-top").textContent = lastLabel;
  $("#progress-bar").style.width = `${((state.idx+1)/state.queue.length)*100}%`;
  syncPrevButtons();
}

function queueRetry(q) {
  const copy = { ...q, options: { ...q.options }, _retry: true };
  state.queue.push(copy);
}

function syncPrevButtons() {
  const on = state.idx > 0;
  ["#btn-prev", "#btn-prev-top"].forEach(sel => {
    const b = $(sel);
    if (b) b.disabled = !on;
  });
}

function nextQ() {
  if (state.idx + 1 >= state.queue.length) {
    finish();
    return;
  }
  state.idx += 1;
  drawQuestion();
}

function prevQ() {
  if (state.idx <= 0) return;
  state.idx -= 1;
  drawQuestion();
}

function finishExam(timeout) {
  clearInterval(state.timer);
  // unanswered remaining
  while (state.examAnswers.length < state.queue.length) {
    const q = state.queue[state.examAnswers.length];
    state.examAnswers.push({ q, choice: null, correct: q.answer, ok: false, correctText: q.answer_text });
    state.score.skip++;
  }
  const { all, p } = packProg();
  p.examUsed = Array.from(new Set([...(p.examUsed||[]), ...state.queue.map(q => String(q.id))]));
  all[state.packId] = p;
  saveProg(all);
  const s = state.score;
  $("#exam-score").textContent = `${timeout ? "وقت تمام شد. " : ""}درست ${s.ok} از ${state.queue.length} · غلط ${s.no} · سفید ${s.skip}`;
  $("#exam-sheet").innerHTML = state.examAnswers.map((row,i) => `
    <div class="law-mine">
      <div class="verdict ${row.ok ? "ok" : "no"}">${i+1}. ${row.ok ? "درست" : "غلط / نزده"}</div>
      <p>${escapeHtml(row.q.question)}</p>
      <p class="sub">پاسخ تو: ${row.choice || "—"} · صحیح: ${row.correct} — ${escapeHtml(row.correctText || row.q.answer_text || "")}</p>
      <div class="explain">${escapeHtml(row.q.explain || "")}</div>
    </div>
  `).join("");
  state.mode = "practice";
  show("exam-result");
}

function allPackQuestions() {
  return state.lesson.articles.flatMap(a => a.questions);
}

function openExamSetup() {
  const { p } = packProg();
  const all = allPackQuestions();
  const used = new Set(p.examUsed || []);
  const left = all.filter(q => !used.has(String(q.id)));
  $("#exam-cycle-info").textContent = `از این بسته ${all.length} سوال است. در این دور ${used.size} تا در آزمون آمده. باقی‌مانده چرخه: ${left.length}. اگر باقی کمتر از تعداد درخواستی باشد، چرخه از نو می‌شود.`;
  show("exam-setup");
}

function startExam() {
  const diff = $("#exam-diff").value;
  const n = Number($("#exam-n").value);
  const min = Number($("#exam-min").value);
  const { all, p } = packProg();
  let pool = allPackQuestions();
  if (diff !== "all") pool = pool.filter(q => q.difficulty === diff);
  let used = new Set(p.examUsed || []);
  let fresh = pool.filter(q => !used.has(String(q.id)));
  if (fresh.length < n) {
    // new cycle for this difficulty leftover
    const still = pool.filter(q => !fresh.includes(q));
    // reset used for those already consumed if not enough
    p.examUsed = p.examUsed.filter(id => !pool.some(q => String(q.id)===id));
    fresh = pool;
    all[state.packId] = p; saveProg(all);
  }
  const pick = fresh.slice(0, n);
  if (!pick.length) { alert("سوالی برای این سطح نماند."); return; }
  state.mode = "exam";
  state.examAnswers = [];
  state.examRemain = min * 60;
  startQuiz({ key: "آزمون", title: `${diff} · ${pick.length} سوال · ${min} دقیقه`, questions: pick });
}

function finish() {
  clearInterval(state.timer);
  if (state.mode === "exam") { finishExam(false); return; }
  const s = state.score;
  const n = state.queue.length;
  $("#q-text").textContent = "تمام شد";
  $("#options").innerHTML = "";
  $("#result").classList.remove("hidden");
  $("#result").innerHTML = `
    <div class="verdict ok">نتیجه این مجموعه</div>
    <p>درست: ${s.ok} · غلط: ${s.no} · بدون پاسخ: ${s.skip} · از ${n} سوال</p>
  `;
  $("#btn-next").classList.add("hidden");
  $("#btn-reveal").classList.add("hidden");
  const nt = $("#nav-top");
  if (nt) nt.classList.add("hidden");
}

function renderMyLaws() {
  const list = loadMine();
  const box = $("#my-laws-list");
  if (!list.length) {
    box.innerHTML = `<p class="sub">هنوز قانونی ذخیره نکرده‌ای. بعد از دیدن پاسخ، دکمه قرمز «ارسال به قوانین من» را بزن.</p>`;
    return;
  }
  box.innerHTML = list.map((item, i) => `
    <div class="law-mine">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="meta" style="margin:6px 0">${item.lesson || ""}</div>
      <p>${escapeHtml(item.body)}</p>
      <button class="btn" data-del="${i}" style="margin-top:10px">حذف</button>
    </div>
  `).join("");
  box.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const arr = loadMine();
      arr.splice(Number(btn.dataset.del), 1);
      saveMine(arr);
      renderMyLaws();
    };
  });
}

function escapeHtml(str="") {
  return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

$("#btn-back-lessons").onclick = () => show("home");
$("#btn-back-home").onclick = () => { clearInterval(state.timer); show("packs"); };
$("#btn-back-arts").onclick = () => { clearInterval(state.timer); state.mode="practice"; show("articles"); renderArticles(); };
$("#btn-exam").onclick = openExamSetup;
$("#btn-back-exam-setup").onclick = () => show("articles");
$("#btn-back-from-exam-res").onclick = () => { renderArticles(); show("articles"); };
$("#btn-start-exam").onclick = startExam;
$("#btn-reset-exam").onclick = () => {
  if (!confirm("چرخه آزمون این بسته از نو شود؟")) return;
  const { all, p } = packProg();
  p.examUsed = [];
  all[state.packId] = p; saveProg(all);
  openExamSetup();
};
$("#btn-reset-pack").onclick = () => {
  if (!confirm("پیشرفت این بسته (تست مواد + لایتنر) پاک شود؟ آزمون جداست.")) return;
  const { all, p } = packProg();
  p.articleStats = {}; p.qStats = {};
  all[state.packId] = p; saveProg(all);
  renderArticles();
};
$("#pack-repeats").onchange = () => {
  const { all, p } = packProg();
  p.repeats = Number($("#pack-repeats").value);
  all[state.packId] = p; saveProg(all);
  renderArticles();
};
$("#sort-mode").onchange = renderArticles;
$("#btn-reveal").onclick = () => lock(null);
$("#btn-next").onclick = nextQ;
$("#btn-next-top").onclick = nextQ;
$("#btn-prev").onclick = prevQ;
$("#btn-prev-top").onclick = prevQ;
$("#btn-star").onclick = () => toggleImportant(state.queue[state.idx]);

$("#btn-settings").onclick = (e) => {
  e.stopPropagation();
  $("#settings-panel").classList.toggle("hidden");
};
document.addEventListener("click", (e) => {
  const pan = $("#settings-panel");
  if (!pan || pan.classList.contains("hidden")) return;
  if (pan.contains(e.target) || e.target.id === "btn-settings") return;
  pan.classList.add("hidden");
});
$$("[data-fs]").forEach(b => b.onclick = () => {
  const s = loadSettings(); s.fs = b.dataset.fs;
  localStorage.setItem(SET_KEY, JSON.stringify(s));
  applySettings();
});
$$("[data-theme]").forEach(b => b.onclick = () => {
  const s = loadSettings(); s.theme = b.dataset.theme;
  localStorage.setItem(SET_KEY, JSON.stringify(s));
  applySettings();
});

$("#btn-important").onclick = () => {
  state.lastView = [...document.querySelectorAll("main > section")].find(s => !s.classList.contains("hidden"))?.id.replace("view-","") || "home";
  renderImportant();
  show("important");
};
$("#btn-back-from-imp").onclick = () => show(state.lastView || "home");
$("#btn-quiz-imp").onclick = () => {
  const list = loadImportant();
  if (!list.length) { alert("هنوز سوال مهمی ذخیره نکرده‌ای."); return; }
  startQuiz({ key: "سوالات مهم", title: "مرور ستاره‌دارها", questions: list });
};
$("#btn-clear-imp").onclick = () => {
  if (confirm("همه سوالات مهم پاک شود؟")) { saveImportant([]); renderImportant(); }
};

function renderImportant() {
  const list = loadImportant();
  const box = $("#imp-list");
  if (!list.length) {
    box.innerHTML = `<p class="sub">ستاره هیچ سوالی را نزده‌ای. وسط تست دکمه «سوال مهم» را بزن.</p>`;
    return;
  }
  box.innerHTML = list.map((q,i) => `
    <div class="law-mine">
      <div class="meta">${q.article || ""} · ${q.difficulty || ""}</div>
      <p style="margin-top:6px">${escapeHtml(q.question)}</p>
      <button class="btn" data-impdel="${i}" style="margin-top:10px">حذف از مهم‌ها</button>
    </div>
  `).join("");
  box.querySelectorAll("[data-impdel]").forEach(btn => {
    btn.onclick = () => {
      const arr = loadImportant();
      arr.splice(Number(btn.dataset.impdel), 1);
      saveImportant(arr);
      renderImportant();
    };
  });
}
$("#btn-all").onclick = () => startQuiz({
  key: "همه مواد",
  title: state.lesson.name,
  questions: allQuestions(),
});
$("#btn-all-hard").onclick = () => startQuiz({
  key: "سوالات سخت",
  title: state.lesson.name,
  questions: allQuestions(),
}, "hard");

$("#btn-my-laws").onclick = () => {
  state.lastView = [...document.querySelectorAll("main > section")].find(s => !s.classList.contains("hidden")).id.replace("view-","");
  renderMyLaws();
  show("laws");
};
$("#btn-back-from-laws").onclick = () => show(state.lastView || "home");
$("#btn-clear-laws").onclick = () => {
  if (confirm("همه قوانین ذخیره‌شده پاک شود؟")) {
    saveMine([]);
    renderMyLaws();
  }
};

$("#xlsx-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("کتابخانه اکسل بارگذاری نشد. اتصال اینترنت برای CDN لازم است.");
    return;
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const sheet = wb.Sheets["سوالات"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {defval: ""});
  const lesson = rowsToLesson(file.name.replace(/\.(xlsx|xls|csv)$/i,""), rows);
  state.lesson = lesson;
  $("#lesson-title").textContent = lesson.name;
  $("#lesson-sub").textContent = `${lesson.count} سوال از فایل ${file.name}`;
  renderArticles();
  show("articles");
});

function rowsToLesson(name, rows) {
  const qs = rows.filter(r => r.question || r["سوال"]).map((r,i) => {
    const question = r.question || r["سوال"];
    const options = {
      A: r.A || r["گزینه A"] || "",
      B: r.B || r["گزینه B"] || "",
      C: r.C || r["گزینه C"] || "",
      D: r.D || r["گزینه D"] || "",
    };
    let answer = String(r.answer || r["Choice صحیح"] || r["choice"] || "").replace(/choice/i,"").trim().toUpperCase();
    if (!["A","B","C","D"].includes(answer)) {
      const txt = r.answer_text || r["پاسخ صحیح"] || "";
      answer = ["A","B","C","D"].find(k => options[k] === txt) || "A";
    }
    return {
      id: String(r.id || r.ID || i+1),
      question,
      options,
      answer,
      answer_text: r.answer_text || r["پاسخ صحیح"] || options[answer],
      explain: r.explain || r["پاسخ تشریحی"] || "",
      laws: r.laws || r["قوانین مرتبط"] || "",
      article: r.article || r["ماده اصلی"] || "سایر",
      article_title: r.article_title || r["عنوان ماده"] || "",
      difficulty: r.difficulty || r["سطح"] || "متوسط",
      similar_group: r.similar_group || "",
      is_similar: String(r.is_similar || "") === "بله",
      similar_count: Number(r.similar_count || 1),
    };
  });
  const map = {};
  qs.forEach(q => {
    if (!map[q.article]) map[q.article] = {key:q.article, title:q.article_title||q.article, questions:[], hard:0, medium:0, easy:0};
    map[q.article].questions.push(q);
    if (q.difficulty==="سخت") map[q.article].hard++;
    else if (q.difficulty==="آسان") map[q.article].easy++;
    else map[q.article].medium++;
  });
  const articles = Object.values(map).map(a => ({...a, count:a.questions.length}));
  articles.sort((a,b)=> (b.hard-a.hard) || (b.medium-a.medium));
  return {id:"custom", name, count: qs.length, articles};
}

boot();
