import os

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes import ai_bp, auth_bp, content_bp, home_bp, search_bp

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-change-me')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.register_blueprint(home_bp)
app.register_blueprint(search_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(content_bp)
app.register_blueprint(ai_bp)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:4200",
                "http://localhost:4201",
                "http://127.0.0.1:4200",
                "http://127.0.0.1:4201",
            ]
        }
    },
    supports_credentials=True,
)

@app.route("/")
def home():
    return {"message": "Backend is running"}


if __name__ == "__main__":
    app.run(debug=True)