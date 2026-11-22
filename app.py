import os
import uuid

import requests
from flask import Flask, jsonify, render_template, request

# 로컬에서는 .env 파일에서 키를 읽고, Vercel에서는 환경변수를 사용합니다.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# 할 일 데이터는 Supabase(test00 프로젝트)의 todos 테이블에 저장됩니다.
# secret 키는 서버에만 있고 브라우저로는 절대 보내지 않습니다.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")
TABLE_URL = f"{SUPABASE_URL}/rest/v1/todos"
MAX_TEXT_LENGTH = 200

app = Flask(__name__)


class SupabaseError(Exception):
    pass


def supabase(method, params=None, json=None):
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
        resp = requests.request(method, TABLE_URL, headers=headers, params=params, json=json, timeout=10)
    except requests.RequestException as e:
        raise SupabaseError(f"Supabase 연결 실패: {e}") from e
    if not resp.ok:
        raise SupabaseError(f"Supabase 오류 {resp.status_code}: {resp.text}")
    return resp.json() if resp.content else []


@app.errorhandler(SupabaseError)
def handle_supabase_error(e):
    app.logger.error(str(e))
    return jsonify(error="데이터베이스 요청에 실패했습니다."), 502


def valid_id(todo_id):
    try:
        return str(uuid.UUID(todo_id))
    except ValueError:
        return None


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/todos")
def list_todos():
    rows = supabase("GET", params={"select": "id,text,done,created_at", "order": "created_at.asc"})
    return jsonify(rows)


@app.post("/api/todos")
def add_todo():
    body = request.get_json(silent=True) or {}
    text = str(body.get("text", "")).strip()
    if not text or len(text) > MAX_TEXT_LENGTH:
        return jsonify(error=f"할 일은 1~{MAX_TEXT_LENGTH}자로 입력해 주세요."), 400
    rows = supabase("POST", json={"text": text, "done": bool(body.get("done", False))})
    return jsonify(rows[0]), 201


@app.patch("/api/todos/<todo_id>")
def update_todo(todo_id):
    todo_id = valid_id(todo_id)
    body = request.get_json(silent=True) or {}
    if not todo_id or not isinstance(body.get("done"), bool):
        return jsonify(error="잘못된 요청입니다."), 400
    rows = supabase("PATCH", params={"id": f"eq.{todo_id}"}, json={"done": body["done"]})
    if not rows:
        return jsonify(error="할 일을 찾을 수 없습니다."), 404
    return jsonify(rows[0])


@app.delete("/api/todos/<todo_id>")
def delete_todo(todo_id):
    todo_id = valid_id(todo_id)
    if not todo_id:
        return jsonify(error="잘못된 요청입니다."), 400
    supabase("DELETE", params={"id": f"eq.{todo_id}"})
    return "", 204


if __name__ == "__main__":
    app.run(debug=True, port=5000)
