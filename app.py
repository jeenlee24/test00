from flask import Flask, render_template

# 할 일 데이터는 서버에 저장하지 않습니다.
# 모든 데이터는 브라우저 localStorage 에 저장되므로 (static/app.js 참고)
# Vercel 같은 서버리스 환경에서도 파일 쓰기 오류(500) 없이 동작합니다.
app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
