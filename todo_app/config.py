"""환경변수와 앱 전체에서 쓰는 설정값."""
import os

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
