"""진입점: Vercel과 로컬 실행 모두 이 파일의 `app` 객체를 사용합니다.
실제 기능은 todo_app/ 패키지에 있습니다.

  todo_app/config.py           환경변수·설정값
  todo_app/supabase_client.py  Supabase REST 호출
  todo_app/validation.py       요청 값 검증
  todo_app/errors.py           DB 오류 → HTTP 응답
  todo_app/routes/             페이지 / 할 일 / 카테고리 API
"""
from todo_app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
