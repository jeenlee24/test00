// 할 일·카테고리 데이터는 서버(Flask) API를 통해 Supabase test00 DB에 저장됩니다.
const TODO_API = "/api/todos";
const CATEGORY_API = "/api/categories";
const OLD_STORAGE_KEY = "todos"; // 예전 localStorage 버전의 저장 키

const $ = (id) => document.getElementById(id);

const todoForm = $("todo-form");
const todoInput = $("todo-input");
const todoList = $("todo-list");
const emptyMessage = $("empty-message");
const summary = $("summary");
const errorBox = $("error");

const categoryForm = $("category-form");
const categoryInput = $("category-input");
const categoryList = $("category-list");
const categoryEmpty = $("category-empty");

const dialog = $("category-dialog");
const dialogTodoText = $("dialog-todo-text");
const dialogChoices = $("dialog-choices");
const dialogNewInput = $("dialog-new-input");
const dialogNewButton = $("dialog-new-button");
const dialogError = $("dialog-error");

const scheduleDialog = $("schedule-dialog");
const scheduleTodoText = $("schedule-todo-text");

const filterBar = $("filter-bar");
const filterName = $("filter-name");
const filterClear = $("filter-clear");

let todos = [];
let categories = [];

// 카테고리 필터: undefined = 전체, null = '카테고리 없음'만, 문자열 = 해당 카테고리 id만
let categoryFilter = undefined;

// ---------- 공통 ----------

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

function showError(message, box = errorBox) {
  box.textContent = message;
  box.hidden = !message;
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : dateFormatter.format(d);
}

const scheduleFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
});

function formatSchedule(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : scheduleFormatter.format(d);
}

function categoryName(id) {
  return categories.find((c) => c.id === id)?.name ?? null;
}

// ---------- 달력형 날짜·시간 선택기 ----------
// 같은 선택기를 '추가 팝업'과 '일정 수정 팝업'에서 함께 씁니다.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_TIME = "09:00";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sameDay(a, b) {
  return Boolean(a && b) && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function createSchedulePicker(container) {
  let selected = null; // 선택한 날짜(그날 0시 Date) 또는 null
  let view = new Date(); // 보고 있는 달(1일)
  view.setDate(1);

  const root = el("div", "schedule-picker");

  const header = el("div", "cal-header");
  const prev = el("button", "secondary cal-nav", "‹");
  const title = el("span", "cal-title");
  const next = el("button", "secondary cal-nav", "›");
  const todayBtn = el("button", "secondary cal-today", "오늘");
  for (const b of [prev, next, todayBtn]) b.type = "button";
  prev.setAttribute("aria-label", "이전 달");
  next.setAttribute("aria-label", "다음 달");
  header.append(prev, title, next, todayBtn);

  const grid = el("div", "cal-grid");

  const footer = el("div", "schedule-row");
  const summaryText = el("span", "schedule-summary");
  const time = el("input", "schedule-time");
  time.type = "time";
  time.value = DEFAULT_TIME;
  time.setAttribute("aria-label", "시간");
  const clear = el("button", "secondary", "지우기");
  clear.type = "button";
  footer.append(summaryText, time, clear);

  root.append(header, grid, footer);
  container.append(root);

  function render() {
    title.textContent = `${view.getFullYear()}년 ${view.getMonth() + 1}월`;
    grid.innerHTML = "";
    WEEKDAYS.forEach((w, i) => {
      grid.append(el("span", "cal-weekday" + (i === 0 ? " sun" : i === 6 ? " sat" : ""), w));
    });

    for (let i = 0; i < view.getDay(); i++) grid.append(el("span"));

    const today = new Date();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(view.getFullYear(), view.getMonth(), day);
      const btn = el("button", "cal-day", String(day));
      btn.type = "button";
      if (date.getDay() === 0) btn.classList.add("sun");
      if (date.getDay() === 6) btn.classList.add("sat");
      if (sameDay(date, today)) btn.classList.add("today");
      if (sameDay(date, selected)) btn.classList.add("selected");
      btn.setAttribute("aria-pressed", String(sameDay(date, selected)));
      btn.addEventListener("click", () => { selected = date; render(); });
      grid.append(btn);
    }

    time.disabled = !selected;
    clear.disabled = !selected;
    summaryText.textContent = selected
      ? `${selected.getMonth() + 1}월 ${selected.getDate()}일 (${WEEKDAYS[selected.getDay()]})`
      : "날짜를 선택하세요";
    summaryText.classList.toggle("muted", !selected);
  }

  prev.addEventListener("click", () => { view.setMonth(view.getMonth() - 1); render(); });
  next.addEventListener("click", () => { view.setMonth(view.getMonth() + 1); render(); });
  todayBtn.addEventListener("click", () => { view = new Date(); view.setDate(1); render(); });
  clear.addEventListener("click", () => { selected = null; render(); });

  return {
    // ISO 문자열 또는 null 로 초기화
    set(iso) {
      const d = iso ? new Date(iso) : null;
      if (d && !isNaN(d)) {
        selected = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        time.value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        view = new Date(selected);
      } else {
        selected = null;
        time.value = DEFAULT_TIME;
        view = new Date();
      }
      view.setDate(1);
      render();
    },
    // 선택값을 ISO 문자열(UTC)로, 날짜를 고르지 않았으면 null
    get() {
      if (!selected) return null;
      const [h, m] = (time.value || DEFAULT_TIME).split(":").map(Number);
      const d = new Date(selected);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    },
  };
}

const addSchedule = createSchedulePicker($("add-schedule-picker"));
const editSchedule = createSchedulePicker($("edit-schedule-picker"));

// ---------- 화면 그리기 ----------

function matchesFilter(todo) {
  if (categoryFilter === undefined) return true;
  return (todo.category_id ?? null) === categoryFilter;
}

function setCategoryFilter(categoryId) {
  categoryFilter = categoryId;
  renderTodos();
}

function renderFilterBar() {
  filterBar.hidden = categoryFilter === undefined;
  if (categoryFilter !== undefined) {
    filterName.textContent = categoryFilter === null ? "'카테고리 없음'" : `'${categoryName(categoryFilter)}'`;
  }
}

function renderTodos() {
  todoList.innerHTML = "";

  // 보고 있던 카테고리가 삭제되었으면 필터 해제
  if (categoryFilter && !categoryName(categoryFilter)) categoryFilter = undefined;
  renderFilterBar();

  const visible = todos.filter(matchesFilter);
  const now = Date.now();

  for (const todo of visible) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "완료 표시");
    checkbox.addEventListener("change", () => toggleTodo(todo));

    const body = document.createElement("div");
    body.className = "todo-body";

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text; // textContent 사용: HTML 삽입 방지

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    // 카테고리 배지: 클릭하면 이 카테고리의 할 일만 보기
    const badge = document.createElement("button");
    badge.type = "button";
    const name = categoryName(todo.category_id);
    badge.className = "badge" + (name ? "" : " none");
    badge.textContent = name ?? "카테고리 없음";
    badge.title = "이 카테고리만 보기";
    badge.addEventListener("click", () => setCategoryFilter(todo.category_id ?? null));

    // 일정(날짜·시간): 클릭하면 수정/삭제 팝업
    const schedule = document.createElement("button");
    schedule.type = "button";
    schedule.className = "schedule";
    if (todo.due_at) {
      const overdue = !todo.done && new Date(todo.due_at).getTime() < now;
      schedule.classList.toggle("overdue", overdue);
      schedule.textContent = "📅 " + formatSchedule(todo.due_at);
      schedule.title = overdue ? "일정이 지났습니다 · 클릭해서 수정" : "클릭해서 일정 수정";
    } else {
      schedule.classList.add("unset");
      schedule.textContent = "+ 일정";
      schedule.title = "일정 추가";
    }
    schedule.addEventListener("click", () => editTodoSchedule(todo));

    const date = document.createElement("time");
    date.className = "created";
    date.dateTime = todo.created_at;
    date.textContent = "추가 " + formatDate(todo.created_at);

    meta.append(badge, schedule, date);
    body.append(text, meta);

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteTodo(todo));

    li.append(checkbox, body, del);
    todoList.append(li);
  }

  const doneCount = visible.filter((t) => t.done).length;
  emptyMessage.hidden = visible.length > 0;
  emptyMessage.textContent = categoryFilter === undefined
    ? "할 일이 없습니다. 위에서 추가해 보세요."
    : "이 카테고리의 할 일이 없습니다.";
  summary.hidden = visible.length === 0;
  summary.textContent = `${categoryFilter === undefined ? "전체" : "표시"} ${visible.length}개 · 완료 ${doneCount}개`;
}

function renderCategories() {
  categoryList.innerHTML = "";

  for (const category of categories) {
    const li = document.createElement("li");
    li.className = "category-item";

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category.name;

    const count = document.createElement("span");
    count.className = "category-count";
    count.textContent = `${todos.filter((t) => t.category_id === category.id).length}개`;

    const rename = document.createElement("button");
    rename.className = "secondary";
    rename.textContent = "수정";
    rename.addEventListener("click", () => renameCategory(category));

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteCategory(category));

    li.append(name, count, rename, del);
    categoryList.append(li);
  }

  categoryEmpty.hidden = categories.length > 0;
}

function renderAll() {
  renderTodos();
  renderCategories();
}

// ---------- 할 일 CRUD ----------

async function addTodo(text, categoryId, dueAt) {
  try {
    const created = await api("POST", TODO_API, { text, category_id: categoryId, due_at: dueAt });
    todos.push(created);
    showError("");
    renderAll();
    return true;
  } catch (e) {
    showError("추가하지 못했습니다: " + e.message);
    return false;
  }
}

async function toggleTodo(todo) {
  try {
    const updated = await api("PATCH", `${TODO_API}/${todo.id}`, { done: !todo.done });
    Object.assign(todo, updated);
    showError("");
  } catch (e) {
    showError("완료 표시를 저장하지 못했습니다: " + e.message);
  }
  renderTodos();
}

// 결과: ISO 문자열 / null(일정 없음) / undefined(취소)
function askSchedule(todo) {
  return new Promise((resolve) => {
    scheduleTodoText.textContent = todo.text;
    editSchedule.set(todo.due_at);
    scheduleDialog.returnValue = "";
    scheduleDialog.addEventListener("close", () => {
      resolve(scheduleDialog.returnValue === "ok" ? editSchedule.get() : undefined);
    }, { once: true });
    scheduleDialog.showModal();
  });
}

async function editTodoSchedule(todo) {
  const dueAt = await askSchedule(todo);
  if (dueAt === undefined || dueAt === (todo.due_at ? new Date(todo.due_at).toISOString() : null)) return;
  try {
    const updated = await api("PATCH", `${TODO_API}/${todo.id}`, { due_at: dueAt });
    Object.assign(todo, updated);
    showError("");
  } catch (e) {
    showError("일정을 저장하지 못했습니다: " + e.message);
  }
  renderTodos();
}

async function deleteTodo(todo) {
  try {
    await api("DELETE", `${TODO_API}/${todo.id}`);
    todos = todos.filter((t) => t.id !== todo.id);
    showError("");
  } catch (e) {
    showError("삭제하지 못했습니다: " + e.message);
  }
  renderAll();
}

// ---------- 카테고리 CRUD ----------

async function createCategory(name) {
  const created = await api("POST", CATEGORY_API, { name });
  categories.push(created);
  renderCategories();
  return created;
}

async function renameCategory(category) {
  const name = prompt("새 카테고리 이름을 입력하세요", category.name);
  if (name === null) return; // 취소
  const trimmed = name.trim();
  if (!trimmed || trimmed === category.name) return;
  try {
    const updated = await api("PATCH", `${CATEGORY_API}/${category.id}`, { name: trimmed });
    Object.assign(category, updated);
    showError("");
  } catch (e) {
    showError("카테고리 이름을 바꾸지 못했습니다: " + e.message);
  }
  renderAll();
}

async function deleteCategory(category) {
  const used = todos.filter((t) => t.category_id === category.id).length;
  const message = used
    ? `"${category.name}" 카테고리를 삭제할까요?\n이 카테고리의 할 일 ${used}개는 '카테고리 없음'이 됩니다.`
    : `"${category.name}" 카테고리를 삭제할까요?`;
  if (!confirm(message)) return;
  try {
    await api("DELETE", `${CATEGORY_API}/${category.id}`);
    categories = categories.filter((c) => c.id !== category.id);
    for (const t of todos) if (t.category_id === category.id) t.category_id = null;
    showError("");
  } catch (e) {
    showError("카테고리를 삭제하지 못했습니다: " + e.message);
  }
  renderAll();
}

// ---------- 카테고리 선택 팝업 ----------

function renderDialogChoices(selectedId) {
  dialogChoices.innerHTML = "";
  const options = [{ id: "", name: "카테고리 없음" }, ...categories];

  for (const option of options) {
    const label = document.createElement("label");
    label.className = "choice";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "category";
    radio.value = option.id;
    radio.checked = option.id === (selectedId ?? "");

    const text = document.createElement("span");
    text.textContent = option.name;

    label.append(radio, text);
    dialogChoices.append(label);
  }
}

// 결과: { categoryId, dueAt } / undefined(취소)
//   categoryId: 카테고리 id 또는 null(카테고리 없음), dueAt: ISO 문자열 또는 null(일정 없음)
function askCategory(todoText) {
  return new Promise((resolve) => {
    dialogTodoText.textContent = todoText;
    dialogNewInput.value = "";
    showError("", dialogError);
    // 특정 카테고리만 보는 중이면 그 카테고리를 미리 선택
    renderDialogChoices(categoryFilter ?? null);
    addSchedule.set(null);
    dialog.returnValue = "";
    dialog.addEventListener("close", () => {
      if (dialog.returnValue !== "ok") return resolve(undefined);
      const checked = dialogChoices.querySelector('input[name="category"]:checked');
      resolve({ categoryId: checked && checked.value ? checked.value : null, dueAt: addSchedule.get() });
    }, { once: true });
    dialog.showModal();
  });
}

async function createCategoryFromDialog() {
  const name = dialogNewInput.value.trim();
  if (!name) return;
  dialogNewButton.disabled = true;
  try {
    const created = await createCategory(name);
    renderDialogChoices(created.id); // 새로 만든 카테고리를 선택된 상태로
    dialogNewInput.value = "";
    showError("", dialogError);
  } catch (e) {
    showError(e.message, dialogError);
  }
  dialogNewButton.disabled = false;
}

dialogNewButton.addEventListener("click", createCategoryFromDialog);
dialogNewInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault(); // 팝업이 닫히지 않게
    createCategoryFromDialog();
  }
});

// ---------- 이벤트 ----------

todoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  const choice = await askCategory(text);
  if (choice === undefined) { // 팝업에서 취소
    todoInput.focus();
    return;
  }

  const button = todoForm.querySelector("button");
  button.disabled = true;
  if (await addTodo(text, choice.categoryId, choice.dueAt)) todoInput.value = "";
  button.disabled = false;
  todoInput.focus();
});

filterClear.addEventListener("click", () => setCategoryFilter(undefined));

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = categoryInput.value.trim();
  if (!name) return;
  try {
    await createCategory(name);
    categoryInput.value = "";
    showError("");
  } catch (err) {
    showError("카테고리를 추가하지 못했습니다: " + err.message);
  }
});

// ---------- 시작 ----------

// 예전(localStorage) 버전에서 저장해 둔 할 일이 이 브라우저에 있으면 DB로 한 번 옮깁니다.
async function migrateLocalTodos() {
  let old;
  try {
    old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
  } catch {
    return;
  }
  if (!Array.isArray(old) || old.length === 0) return;

  const remaining = [];
  for (const t of old) {
    const text = String(t?.text ?? "").trim();
    if (!text) continue;
    try {
      await api("POST", TODO_API, { text, done: Boolean(t.done) });
    } catch {
      remaining.push(t); // 실패한 항목은 다음에 다시 시도
    }
  }
  try {
    if (remaining.length) localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {}
}

async function loadAll() {
  try {
    [todos, categories] = await Promise.all([api("GET", TODO_API), api("GET", CATEGORY_API)]);
    showError("");
  } catch (e) {
    showError("데이터를 불러오지 못했습니다: " + e.message);
  }
  renderAll();
}

(async () => {
  await migrateLocalTodos();
  await loadAll();
})();
