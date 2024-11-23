# Use a Node.js image with Python support
FROM node:18-slim

# Install Python and required dependencies for transcription server
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install flask librosa pydub soundfile numpy && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy Python script for transcription server
COPY transcribe_audio.py ./transcribe_audio.py

# Copy JavaScript bot code
COPY bot_alpha.js ./bot_alpha.js

# Expose the port for the transcription server
EXPOSE 5000

# Start the transcription server in the background and run the WhatsApp bot
CMD ["sh", "-c", "python3 transcribe_audio.py & node bot_alpha.js"]
