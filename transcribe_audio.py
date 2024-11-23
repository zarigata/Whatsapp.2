import sys
import speech_recognition as sr
from pydub import AudioSegment

# Convert OGG to WAV if needed (because SpeechRecognition works best with WAV files)
def convert_ogg_to_wav(ogg_path):
    audio = AudioSegment.from_ogg(ogg_path)
    wav_path = ogg_path.replace('.ogg', '.wav')
    audio.export(wav_path, format='wav')
    return wav_path

def transcribe_audio(audio_path):
    recognizer = sr.Recognizer()

    # If the audio is in OGG format, convert to WAV first
    if audio_path.endswith('.ogg'):
        audio_path = convert_ogg_to_wav(audio_path)

    with sr.AudioFile(audio_path) as source:
        audio = recognizer.record(source)  # Record the entire audio
        try:
            # Recognize speech using Google Speech Recognition in Portuguese
            print(recognizer.recognize_google(audio, language="pt-BR"))  # Use Brazilian Portuguese
        except sr.UnknownValueError:
            print("Google Speech Recognition could not understand the audio")
        except sr.RequestError as e:
            print(f"Could not request results from Google Speech Recognition service; {e}")

if __name__ == "__main__":
    audio_file_path = sys.argv[1]
    transcribe_audio(audio_file_path)
