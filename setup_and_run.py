import os
import subprocess
import sys

def create_virtualenv():
    """Create a virtual environment and install dependencies."""
    venv_dir = "venv"
    if not os.path.exists(venv_dir):
        print("Creating virtual environment...")
        subprocess.check_call([sys.executable, "-m", "venv", venv_dir])
    else:
        print("Virtual environment already exists.")

    # Install dependencies
    pip_executable = os.path.join(venv_dir, "Scripts", "pip") if os.name == "nt" else os.path.join(venv_dir, "bin", "pip")
    print("Installing dependencies...")
    subprocess.check_call([pip_executable, "install", "flask", "SpeechRecognition", "pydub"])

if __name__ == "__main__":
    create_virtualenv()
    print("Setup complete. Run the Python server using `python server.py`.")
