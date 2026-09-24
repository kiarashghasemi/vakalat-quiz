const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

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
};

const views = {
  home: $("#view-home"),
  articles: $("#view-articles"),
  quiz: $("#view-quiz"),
};

function show(name) {
  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}

async function boot() {
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
    el.innerHTML = `
      <h3>${ls.name}</h3>
      <div class="meta">
        <span class="pill">${ls.ready ? ls.count + " سوال" : "فایل اکسل را اضافه کنید"}</span>
      </div>`;
    if (ls.ready) el.onclick = () => openLesson(ls);
    box.appendChild(el);
  });
}

async function openLesson(ls) {
  const res = await fetch(ls.file);
  state.lesson = await res.json();
  $("#lesson-title").textContent = state.lesson.name;
  $("#lesson-sub").textContent = `${state.lesson.count} سوال در ${state.lesson.articles.length} ماده / موضوع`;
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

  arts.forEach(art => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h3>${art.key}</h3>
      <div class="meta" style="margin-bottom:8px">${art.title}</div>
      <div class="meta">
        <span class="pill">${art.count} سوال</span>
        ${art.hard ? `<span class="pill hard">سخت ${art.hard}</span>` : ""}
        ${art.medium ? `<span class="pill mid">متوسط ${art.medium}</span>` : ""}
        ${art.easy ? `<span class="pill easy">آسان ${art.easy}</span>` : ""}
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
  if (!qs.length) qs = [...art.questions];
  state.queue = qs;
  state.idx = 0;
  state.score = {ok:0, no:0, skip:0};
  $("#quiz-head").textContent = `${art.key} — ${art.title}`;
  show("quiz");
  drawQuestion();
}

function drawQuestion() {
  clearInterval(state.timer);
  state.locked = false;
  state.remain = 60;
  const q = state.queue[state.idx];
  const total = state.queue.length;
  $("#q-progress-label").textContent = `سوال ${state.idx+1} از ${total}`;
  $("#progress-bar").style.width = `${((state.idx)/total)*100}%`;
  $("#timer").textContent = "60";
  $("#timer").className = "timer";
  $("#q-badges").innerHTML = `
    <span class="pill ${q.difficulty==="سخت"?"hard":q.difficulty==="متوسط"?"mid":"easy"}">${q.difficulty}</span>
    ${q.is_similar ? `<span class="pill sim">شبیه هم · ${q.similar_count} مورد</span>` : ""}
  `;
  $("#q-text").textContent = q.question;
  const box = $("#options");
  box.innerHTML = "";
  ["A","B","C","D"].forEach(k => {
    const b = document.createElement("button");
    b.className = "opt";
    b.innerHTML = `<b>${k}</b> ${q.options[k]}`;
    b.onclick = () => lock(k);
    box.appendChild(b);
  });
  $("#result").classList.add("hidden");
  $("#btn-next").classList.add("hidden");
  $("#btn-reveal").classList.remove("hidden");
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

function lock(choice) {
  if (state.locked) return;
  state.locked = true;
  clearInterval(state.timer);
  const q = state.queue[state.idx];
  const correct = (q.answer || "").toUpperCase();
  const opts = $$("#options .opt");
  opts.forEach((el, i) => {
    const key = ["A","B","C","D"][i];
    if (key === correct) el.classList.add("right");
    if (choice && key === choice && choice !== correct) el.classList.add("wrong");
    if (choice && key === choice) el.classList.add("picked");
    el.disabled = true;
  });
  const box = $("#result");
  box.classList.remove("hidden");
  let verdict, cls;
  if (!choice) {
    state.score.skip++;
    verdict = "زمان تمام شد";
    cls = "no";
  } else if (choice === correct) {
    state.score.ok++;
    verdict = "درست زدی";
    cls = "ok";
  } else {
    state.score.no++;
    verdict = "غلط بود";
    cls = "no";
  }
  box.innerHTML = `
    <div class="verdict ${cls}">${verdict}</div>
    <div>گزینه صحیح: <b>${correct}</b> — ${q.answer_text || q.options[correct] || ""}</div>
    <div class="explain"><b>پاسخنامه:</b><br>${escapeHtml(q.explain)}</div>
    ${q.laws ? `<div class="laws"><b>قوانین مرتبط:</b><br>${escapeHtml(q.laws)}</div>` : ""}
  `;
  $("#btn-reveal").classList.add("hidden");
  $("#btn-next").classList.remove("hidden");
  $("#btn-next").textContent = state.idx + 1 >= state.queue.length ? "پایان و نتیجه" : "سوال بعدی";
  $("#progress-bar").style.width = `${((state.idx+1)/state.queue.length)*100}%`;
}

function nextQ() {
  if (state.idx + 1 >= state.queue.length) {
    finish();
    return;
  }
  state.idx += 1;
  drawQuestion();
}

function finish() {
  clearInterval(state.timer);
  const s = state.score;
  const n = state.queue.length;
  $("#q-text").textContent = "تمام شد";
  $("#options").innerHTML = "";
  $("#result").classList.remove("hidden");
  $("#result").innerHTML = `
    <div class="verdict ok">نتیجه این ماده</div>
    <p>درست: ${s.ok} · غلط: ${s.no} · بدون پاسخ: ${s.skip} · از ${n} سوال</p>
  `;
  $("#btn-next").classList.add("hidden");
  $("#btn-reveal").classList.add("hidden");
}

function escapeHtml(str="") {
  return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

$("#btn-back-home").onclick = () => { clearInterval(state.timer); show("home"); };
$("#btn-back-arts").onclick = () => { clearInterval(state.timer); show("articles"); };
$("#sort-mode").onchange = renderArticles;
$("#btn-reveal").onclick = () => lock(null);
$("#btn-next").onclick = nextQ;
$("#btn-all").onclick = () => startQuiz({
  key: "همه مواد",
  title: state.lesson.name,
  questions: state.lesson.articles.flatMap(a => a.questions),
});

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
