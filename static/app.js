// 할 일 데이터는 서버(Flask) API를 통해 Supabase test00 DB에 저장됩니다.
const API = "/api/todos";
const OLD_STORAGE_KEY = "todos"; // 예전 localStorage 버전의 저장 키

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const summary = document.getElementById("summary");
const errorBox = document.getElementById("error");

let todos = [];

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

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function render() {
  list.innerHTML = "";

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "완료 표시");
    checkbox.addEventListener("change", () => toggleTodo(todo));

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text; // textContent 사용: HTML 삽입 방지

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteTodo(todo));

    li.append(checkbox, text, del);
    list.append(li);
  }

  const doneCount = todos.filter((t) => t.done).length;
  emptyMessage.hidden = todos.length > 0;
  summary.hidden = todos.length === 0;
  summary.textContent = `전체 ${todos.length}개 · 완료 ${doneCount}개`;
}

async function loadTodos() {
  try {
    todos = await api("GET", API);
    showError("");
  } catch (e) {
    showError("할 일을 불러오지 못했습니다: " + e.message);
  }
  render();
}

async function addTodo(text) {
  try {
    const created = await api("POST", API, { text });
    todos.push(created);
    showError("");
    render();
    return true;
  } catch (e) {
    showError("추가하지 못했습니다: " + e.message);
    return false;
  }
}

async function toggleTodo(todo) {
  try {
    const updated = await api("PATCH", `${API}/${todo.id}`, { done: !todo.done });
    Object.assign(todo, updated);
    showError("");
  } catch (e) {
    showError("완료 표시를 저장하지 못했습니다: " + e.message);
  }
  render();
}

async function deleteTodo(todo) {
  try {
    await api("DELETE", `${API}/${todo.id}`);
    todos = todos.filter((t) => t.id !== todo.id);
    showError("");
  } catch (e) {
    showError("삭제하지 못했습니다: " + e.message);
  }
  render();
}

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
      await api("POST", API, { text, done: Boolean(t.done) });
    } catch {
      remaining.push(t); // 실패한 항목은 다음에 다시 시도
    }
  }
  try {
    if (remaining.length) localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {}
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const button = form.querySelector("button");
  button.disabled = true;
  if (await addTodo(text)) input.value = "";
  button.disabled = false;
  input.focus();
});

(async () => {
  await migrateLocalTodos();
  await loadTodos();
})();
