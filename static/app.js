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

let todos = [];
let categories = [];

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

function categoryName(id) {
  return categories.find((c) => c.id === id)?.name ?? null;
}

// ---------- 화면 그리기 ----------

function renderTodos() {
  todoList.innerHTML = "";

  for (const todo of todos) {
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

    const badge = document.createElement("span");
    const name = categoryName(todo.category_id);
    badge.className = "badge" + (name ? "" : " none");
    badge.textContent = name ?? "카테고리 없음";

    const date = document.createElement("time");
    date.dateTime = todo.created_at;
    date.textContent = formatDate(todo.created_at);

    meta.append(badge, date);
    body.append(text, meta);

    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteTodo(todo));

    li.append(checkbox, body, del);
    todoList.append(li);
  }

  const doneCount = todos.filter((t) => t.done).length;
  emptyMessage.hidden = todos.length > 0;
  summary.hidden = todos.length === 0;
  summary.textContent = `전체 ${todos.length}개 · 완료 ${doneCount}개`;
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

async function addTodo(text, categoryId) {
  try {
    const created = await api("POST", TODO_API, { text, category_id: categoryId });
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

// 결과: 카테고리 id(문자열) / null(카테고리 없음) / undefined(취소)
function askCategory(todoText) {
  return new Promise((resolve) => {
    dialogTodoText.textContent = todoText;
    dialogNewInput.value = "";
    showError("", dialogError);
    renderDialogChoices(null);
    dialog.returnValue = "";
    dialog.addEventListener("close", () => {
      if (dialog.returnValue !== "ok") return resolve(undefined);
      const checked = dialogChoices.querySelector('input[name="category"]:checked');
      resolve(checked && checked.value ? checked.value : null);
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

  const categoryId = await askCategory(text);
  if (categoryId === undefined) { // 팝업에서 취소
    todoInput.focus();
    return;
  }

  const button = todoForm.querySelector("button");
  button.disabled = true;
  if (await addTodo(text, categoryId)) todoInput.value = "";
  button.disabled = false;
  todoInput.focus();
});

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
