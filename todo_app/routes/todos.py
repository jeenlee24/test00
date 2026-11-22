"""할 일 API: /api/todos"""
from flask import Blueprint, jsonify, request

from ..config import MAX_TODO_LENGTH
from ..supabase_client import supabase
from ..validation import bad_request, parse_due_at, valid_id

bp = Blueprint("todos", __name__, url_prefix="/api/todos")

TODO_FIELDS = "id,text,done,created_at,category_id,due_at"


@bp.get("")
def list_todos():
    return jsonify(supabase("GET", "todos", params={"select": TODO_FIELDS, "order": "created_at.asc"}))


@bp.post("")
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


@bp.patch("/<todo_id>")
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


@bp.delete("/<todo_id>")
def delete_todo(todo_id):
    todo_id = valid_id(todo_id)
    if not todo_id:
        return bad_request()
    supabase("DELETE", "todos", params={"id": f"eq.{todo_id}"})
    return "", 204
