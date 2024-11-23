import os
import sys

# Path to the "audios" folder
audio_folder = "audios"

def create_folder(path):
    try:
        # Check if the folder exists, if not, create it
        if not os.path.exists(path):
            os.makedirs(path)
            print(f"'{path}' created successfully.")
        else:
            print(f"'{path}' already exists.")
    except Exception as e:
        print(f"Error creating folder: {e}")

def main():
    # Detect the OS
    if sys.platform == "win32":
        # Windows
        print("Detected Windows OS.")
        create_folder(audio_folder)
    elif sys.platform == "linux" or sys.platform == "darwin":
        # Linux or macOS
        print("Detected Linux/macOS OS.")
        create_folder(audio_folder)
    else:
        print("Unsupported OS")

if __name__ == "__main__":
    main()
