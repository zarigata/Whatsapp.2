import pkg from 'whatsapp-web.js'; // Import as default
const { Client, LocalAuth } = pkg; // Destructure the required exports
import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch'; // For sending audio to Python server
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Ensure __dirname is interpreted correctly for ES modules
const __dirname = new URL('.', import.meta.url).pathname;

// Initialize the WhatsApp client with session persistence
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }) // Saves session
});

// Listen for QR code
client.on('qr', (qr) => {
    console.log('Scan the QR Code below to log in:');
    qrcode.generate(qr, { small: true });
});

// Notify when logged in
client.on('ready', () => {
    console.log('WhatsApp Bot is ready!');
});

// History storage
const chatHistory = {};

// Handle incoming messages
client.on('message', async (message) => {
    const chatId = message.from;
    const text = message.body;

    // If the message is an audio message (voice message)
    if (message.hasMedia && message.type === 'ptt') {
        try {
            const media = await message.downloadMedia();
            const audioBuffer = Buffer.from(media.data, 'base64'); // Convert audio to buffer

            console.log('Audio received, preparing for transcription...');

            // Save audio as a temporary WAV file
            const tempFilePath = path.join(__dirname, 'temp_audio.wav');
            fs.writeFileSync(tempFilePath, audioBuffer);

            // Convert WAV to MP3 if your Python server requires it
            const mp3FilePath = path.join(__dirname, 'temp_audio.mp3');
            exec(`ffmpeg -i ${tempFilePath} -q:a 0 -map a ${mp3FilePath}`, async (err) => {
                if (err) {
                    console.error('Error converting WAV to MP3:', err);
                    message.reply('Error processing the voice message.');
                    return;
                }

                console.log('Audio conversion successful, sending to transcription server...');

                try {
                    // Send audio to Python server
                    const response = await fetch('http://127.0.0.1:5000/transcribe', {
                        method: 'POST',
                        body: fs.createReadStream(mp3FilePath),
                        headers: {
                            'Content-Type': 'audio/mp3',
                        },
                    });

                    const result = await response.json();
                    if (response.ok && result.transcription) {
                        const transcription = result.transcription;
                        console.log('Transcription received:', transcription);

                        chatHistory[chatId] = chatHistory[chatId] || [];
                        chatHistory[chatId].push({ role: 'user', content: transcription });

                        // Send transcription back as a message
                        client.sendMessage(chatId, `Transcription: ${transcription}`);
                    } else {
                        console.error('Error from transcription server:', result.error || 'Unknown error');
                        client.sendMessage(chatId, 'Sorry, I could not transcribe the audio.');
                    }
                } catch (error) {
                    console.error('Error communicating with the transcription server:', error);
                    message.reply('An error occurred while sending the audio for transcription.');
                } finally {
                    // Cleanup temporary files
                    fs.unlinkSync(tempFilePath);
                    fs.unlinkSync(mp3FilePath);
                }
            });
        } catch (error) {
            console.error('Error handling voice message:', error);
            message.reply('An error occurred while processing the voice message.');
        }
    } else if (text) {
        // Regular text message handling
        chatHistory[chatId] = chatHistory[chatId] || [];
        chatHistory[chatId].push({ role: 'user', content: text });

        // Reply with a confirmation (or further processing logic)
        client.sendMessage(chatId, `Message received: "${text}"`);
    }
});

// Start the WhatsApp client
client.initialize();
