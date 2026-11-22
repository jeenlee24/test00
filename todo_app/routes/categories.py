"""카테고리 API: /api/categories"""
from flask import Blueprint, jsonify, request

from ..config import MAX_CATEGORY_LENGTH
from ..supabase_client import supabase
from ..validation import bad_request, valid_id

bp = Blueprint("categories", __name__, url_prefix="/api/categories")

CATEGORY_FIELDS = "id,name,created_at"


def category_name_from(body):
    name = str(body.get("name", "")).strip()
    if not name or len(name) > MAX_CATEGORY_LENGTH:
        return None
    return name


@bp.get("")
def list_categories():
    return jsonify(supabase("GET", "categories", params={"select": CATEGORY_FIELDS, "order": "created_at.asc"}))


@bp.post("")
def add_category():
    name = category_name_from(request.get_json(silent=True) or {})
    if not name:
        return bad_request(f"카테고리 이름은 1~{MAX_CATEGORY_LENGTH}자로 입력해 주세요.")
    rows = supabase("POST", "categories", params={"select": CATEGORY_FIELDS}, json={"name": name})
    return jsonify(rows[0]), 201


@bp.patch("/<category_id>")
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


@bp.delete("/<category_id>")
def delete_category(category_id):
    category_id = valid_id(category_id)
    if not category_id:
        return bad_request()
    # DB 설정(on delete set null)에 의해 이 카테고리의 할 일은 '카테고리 없음'이 됩니다.
    supabase("DELETE", "categories", params={"id": f"eq.{category_id}"})
    return "", 204
