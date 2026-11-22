"""Supabase REST API(PostgREST) 호출."""
import requests

from .config import SUPABASE_SECRET_KEY, SUPABASE_URL


class SupabaseError(Exception):
    def __init__(self, message, pg_code=None):
        super().__init__(message)
        self.pg_code = pg_code  # PostgreSQL 오류 코드 (예: 23505 = 중복)


def supabase(method, table, params=None, json=None):
    """테이블에 REST 요청을 보내고 결과 행 목록을 돌려줍니다. 실패하면 SupabaseError."""
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
