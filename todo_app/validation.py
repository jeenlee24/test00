"""요청 값 검증과 400 응답 헬퍼."""
import uuid
from datetime import datetime

from flask import jsonify


def valid_id(value):
    """UUID 형식이면 정규화한 문자열, 아니면 None."""
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
