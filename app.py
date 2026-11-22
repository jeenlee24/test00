import os
import uuid
from datetime import datetime

import requests
from flask import Flask, jsonify, render_template, request

# 로컬에서는 .env 파일에서 키를 읽고, Vercel에서는 환경변수를 사용합니다.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def env(name):
    # 복사/붙여넣기나 셸 파이프로 섞여 들어오는 BOM(﻿)·공백·줄바꿈 제거
    return os.environ.get(name, "").replace("﻿", "").strip()


# 데이터는 Supabase(test00 프로젝트)의 todos / categories 테이블에 저장됩니다.
# secret 키는 서버에만 있고 브라우저로는 절대 보내지 않습니다.
SUPABASE_URL = env("SUPABASE_URL").rstrip("/")
SUPABASE_SECRET_KEY = env("SUPABASE_SECRET_KEY")
MAX_TODO_LENGTH = 200
MAX_CATEGORY_LENGTH = 30

TODO_FIELDS = "id,text,done,created_at,category_id,due_at"
CATEGORY_FIELDS = "id,name,created_at"

app = Flask(__name__)


class SupabaseError(Exception):
    def __init__(self, message, pg_code=None):
        super().__init__(message)
        self.pg_code = pg_code  # PostgreSQL 오류 코드 (예: 23505 = 중복)


def supabase(method, table, params=None, json=None):
    """Supabase REST API(PostgREST) 호출."""
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise SupabaseError("SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수가 설정되지 않았습니다.")
    # 새 형식의 secret 키(sb_secret_...)는 JWT가 아니므로 Authorization 헤더 없이 apikey 헤더로만 보냅니다.
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    try:
        resp = requests.request(
            method, f"{SUPABASE_URL}/rest/v1/{table}",
            headers=headers, params=params, json=json, timeout=10,
        )
    except requests.RequestException as e:
        raise SupabaseError(f"Supabase 연결 실패: {e}") from e
    if not resp.ok:
        try:
            pg_code = resp.json().get("code")
        except ValueError:
            pg_code = None
        raise SupabaseError(f"Supabase 오류 {resp.status_code}: {resp.text}", pg_code)
    return resp.json() if resp.content else []


@app.errorhandler(SupabaseError)
def handle_supabase_error(e):
    if e.pg_code == "23505":
        return jsonify(error="이미 같은 이름의 카테고리가 있습니다."), 409
    if e.pg_code == "23503":
        return jsonify(error="존재하지 않는 카테고리입니다. 새로고침 후 다시 시도해 주세요."), 400
    app.logger.error(str(e))
    return jsonify(error="데이터베이스 요청에 실패했습니다."), 502


def valid_id(value):
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        return None


def parse_due_at(value):
    """일정(due_at) 검증: None이면 일정 없음, 시간대가 포함된 ISO 8601 문자열이면 그대로 저장.
    잘못된 값이면 False를 돌려줍니다."""
    if value is None:
        return None
    if not isinstance(value, str):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    if parsed.tzinfo is None:  # 시간대 없는 값은 해석이 모호하므로 거부
        return False
    return parsed.isoformat()


def bad_request(message="잘못된 요청입니다."):
    return jsonify(error=message), 400


@app.route("/")
def index():
    return render_template("index.html")


# ---------- 할 일 ----------

@app.get("/api/todos")
def list_todos():
    return jsonify(supabase("GET", "todos", params={"select": TODO_FIELDS, "order": "created_at.asc"}))


@app.post("/api/todos")
def add_todo():
    body = request.get_json(silent=True) or {}
    text = str(body.get("text", "")).strip()
    if not text or len(text) > MAX_TODO_LENGTH:
        return bad_request(f"할 일은 1~{MAX_TODO_LENGTH}자로 입력해 주세요.")

    category_id = body.get("category_id")
    if category_id is not None:
        category_id = valid_id(category_id)
        if not category_id:
            return bad_request("잘못된 카테고리입니다.")

    due_at = parse_due_at(body.get("due_at"))
    if due_at is False:
        return bad_request("잘못된 날짜/시간입니다.")

    row = {"text": text, "done": bool(body.get("done", False)), "category_id": category_id, "due_at": due_at}
    rows = supabase("POST", "todos", params={"select": TODO_FIELDS}, json=row)
    return jsonify(rows[0]), 201


@app.patch("/api/todos/<todo_id>")
def update_todo(todo_id):
    todo_id = valid_id(todo_id)
    body = request.get_json(silent=True) or {}
    if not todo_id:
        return bad_request()

    # 보낸 필드만 수정: done(완료 여부), due_at(일정 — null이면 일정 삭제)
    changes = {}
    if "done" in body:
        if not isinstance(body["done"], bool):
            return bad_request()
        changes["done"] = body["done"]
    if "due_at" in body:
        due_at = parse_due_at(body["due_at"])
        if due_at is False:
            return bad_request("잘못된 날짜/시간입니다.")
        changes["due_at"] = due_at
    if not changes:
        return bad_request()

    rows = supabase("PATCH", "todos", params={"id": f"eq.{todo_id}", "select": TODO_FIELDS},
                    json=changes)
    if not rows:
        return jsonify(error="할 일을 찾을 수 없습니다."), 404
    return jsonify(rows[0])


@app.delete("/api/todos/<todo_id>")
def delete_todo(todo_id):
    todo_id = valid_id(todo_id)
    if not todo_id:
        return bad_request()
    supabase("DELETE", "todos", params={"id": f"eq.{todo_id}"})
    return "", 204


# ---------- 카테고리 ----------

def category_name_from(body):
    name = str(body.get("name", "")).strip()
    if not name or len(name) > MAX_CATEGORY_LENGTH:
        return None
    return name


@app.get("/api/categories")
def list_categories():
    return jsonify(supabase("GET", "categories", params={"select": CATEGORY_FIELDS, "order": "created_at.asc"}))


@app.post("/api/categories")
def add_category():
    name = category_name_from(request.get_json(silent=True) or {})
    if not name:
        return bad_request(f"카테고리 이름은 1~{MAX_CATEGORY_LENGTH}자로 입력해 주세요.")
    rows = supabase("POST", "categories", params={"select": CATEGORY_FIELDS}, json={"name": name})
    return jsonify(rows[0]), 201


@app.patch("/api/categories/<category_id>")
def rename_category(category_id):
    category_id = valid_id(category_id)
    name = category_name_from(request.get_json(silent=True) or {})
    if not category_id:
        return bad_request()
    if not name:
        return bad_request(f"카테고리 이름은 1~{MAX_CATEGORY_LENGTH}자로 입력해 주세요.")
    rows = supabase("PATCH", "categories", params={"id": f"eq.{category_id}", "select": CATEGORY_FIELDS},
                    json={"name": name})
    if not rows:
        return jsonify(error="카테고리를 찾을 수 없습니다."), 404
    return jsonify(rows[0])


@app.delete("/api/categories/<category_id>")
def delete_category(category_id):
    category_id = valid_id(category_id)
    if not category_id:
        return bad_request()
    # DB 설정(on delete set null)에 의해 이 카테고리의 할 일은 '카테고리 없음'이 됩니다.
    supabase("DELETE", "categories", params={"id": f"eq.{category_id}"})
    return "", 204


if __name__ == "__main__":
    app.run(debug=True, port=5000)
