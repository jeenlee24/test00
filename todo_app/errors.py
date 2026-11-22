"""DB 오류를 사용자에게 보여줄 HTTP 응답으로 바꿉니다."""
from flask import current_app, jsonify

from .supabase_client import SupabaseError


def handle_supabase_error(e):
    if e.pg_code == "23505":
        return jsonify(error="이미 같은 이름의 카테고리가 있습니다."), 409
    if e.pg_code == "23503":
        return jsonify(error="존재하지 않는 카테고리입니다. 새로고침 후 다시 시도해 주세요."), 400
    current_app.logger.error(str(e))
    return jsonify(error="데이터베이스 요청에 실패했습니다."), 502


def register_error_handlers(app):
    app.register_error_handler(SupabaseError, handle_supabase_error)
