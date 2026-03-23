from flask import Flask
from flask_cors import CORS

from routes import home_bp, search_bp

app = Flask(__name__)
app.register_blueprint(home_bp)
app.register_blueprint(search_bp)

CORS(app, resources={r"/api/*": {"origins": ["http://localhost:4200", "http://localhost:4201"]}})

@app.route("/")
def home():
    return {"message": "Backend is running"}


if __name__ == "__main__":
    app.run(debug=True)