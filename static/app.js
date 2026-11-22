// 할 일 데이터는 브라우저 localStorage 에만 저장됩니다.
const STORAGE_KEY = "todos";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const summary = document.getElementById("summary");

function loadTodos() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    alert("브라우저 저장소에 저장하지 못했습니다. (시크릿 모드인지 확인해 주세요)");
  }
}

let todos = loadTodos();

function render() {
  list.innerHTML = "";

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "완료 표시");
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text; // textContent 사용: HTML 삽입 방지

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteTodo(todo.id));

    li.append(checkbox, text, del);
    list.append(li);
  }

  const doneCount = todos.filter((t) => t.done).length;
  emptyMessage.hidden = todos.length > 0;
  summary.hidden = todos.length === 0;
  summary.textContent = `전체 ${todos.length}개 · 완료 ${doneCount}개`;
}

function addTodo(text) {
  todos.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), text, done: false });
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.done = !todo.done;
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addTodo(text);
  input.value = "";
  input.focus();
});

render();
