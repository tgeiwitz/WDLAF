import os
import sys

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory

from wdlaf.chatbot import ChatBot

load_dotenv()

app = Flask(__name__, static_folder="static")
bot = None


def get_bot() -> ChatBot:
    global bot
    if bot is not None:
        return bot

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    wd_key = os.getenv("WOODELIVERY_API_KEY")

    if not anthropic_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set. Add it to your .env file.")
    if not wd_key:
        raise RuntimeError("WOODELIVERY_API_KEY not set. Add it to your .env file.")

    model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    bot = ChatBot(anthropic_key, wd_key, model=model)
    return bot


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Empty message"}), 400
    try:
        reply = get_bot().chat(message)
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Starting WDLAF on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
