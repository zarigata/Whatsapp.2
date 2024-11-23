import os
from flask import Flask, request, jsonify
import speech_recognition as sr

app = Flask(__name__)

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    """Endpoint to receive and transcribe audio."""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(audio_file) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language="pt-BR")  # Portuguese language
            return jsonify({"transcription": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = 5000
    print(f"Starting transcription server on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port)
