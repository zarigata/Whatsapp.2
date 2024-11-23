import { Client, LocalAuth } from 'whatsapp-web.js';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { Ollama } from 'ollama';

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Store message history (you can tweak the size based on your needs)
let messageHistory = [];

// Ollama client for AI interactions (using your provided host and model)
const ollama = new Ollama({ host: 'http://192.168.15.115:11434' });

client.on('message', async (message) => {
  // Check if the message is a voice message
  if (message.hasMedia) {
    // Download the media
    const media = await message.downloadMedia();
    const fileName = `voice_message_${message.id.id}.ogg`; // Save as OGG file
    const filePath = path.join(__dirname, fileName);

    // Write the media file to disk
    fs.writeFileSync(filePath, media.data, 'base64');

    console.log(`Received a voice message, saved as ${fileName}`);

    // Call Python script to transcribe the audio
    exec(`python transcribe_audio.py ${filePath}`, async (err, stdout, stderr) => {
      if (err) {
        console.error(`Error: ${stderr}`);
        message.reply("Sorry, I couldn't process the voice message.");
        return;
      }

      console.log(`Transcription result: ${stdout}`);
      const transcription = stdout.trim();

      // Add the transcription to the message history
      messageHistory.push({ role: 'user', content: transcription });

      // Limit history to last 5 messages
      if (messageHistory.length > 5) {
        messageHistory.shift();
      }

      // Send the complete history to Ollama for context-based reply
      const response = await ollama.chat({
        model: 'vera',  // Use the model "vera"
        messages: messageHistory,
      });

      // Reply with the response from Ollama
      message.reply(response.message.content);
    });
  } else {
    // Regular text message handling
    messageHistory.push({ role: 'user', content: message.body });

    // Limit history to last 5 messages
    if (messageHistory.length > 5) {
      messageHistory.shift();
    }

    // Send the complete history to Ollama for context-based reply
    const response = await ollama.chat({
      model: 'vera',  // Use the model "vera"
      messages: messageHistory,
    });

    // Reply with the response from Ollama
    message.reply(response.message.content);
  }
});

client.on('ready', () => {
  console.log('WhatsApp bot is ready!');
});

client.initialize();
