import pkg from 'whatsapp-web.js'; // Import as default
import qrcode from 'qrcode-terminal';
import { Ollama } from 'ollama'; // Import Ollama class
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process'; // For calling Python script

const { Client, LocalAuth } = pkg; // Destructure Client and LocalAuth from the imported package

// Initialize Ollama with the correct host
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' }); // Ollama server URL

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

// Handle incoming messages
client.on('message', async (message) => {
    const chatId = message.from;
    const text = message.body;
    const isGroup = chatId.includes('@g.us'); // Ensure this is a group chat
    
    // Check if the message contains a mention of the bot
    const isMentioned = message.mentionedIds && message.mentionedIds.includes(client.info.wid._serialized);

    // If the message is from a group and the bot is not mentioned, do not reply
    if (isGroup && !isMentioned) {
        console.log('Bot not mentioned in group, ignoring message.');
        return; // Do nothing
    }

    // Handle audio messages
    if (message.hasMedia && message.type === 'audio') {
        // Download the audio
        const media = await message.downloadMedia();
        const audioFilePath = path.join(__dirname, 'audio_message.ogg');
        fs.writeFileSync(audioFilePath, media.data, 'base64');

        // Convert audio to text using an external Python script
        const transcribedText = await transcribeAudioToText(audioFilePath);

        // If transcription was successful, send it to Ollama for a response
        if (transcribedText) {
            const payload = {
                model: 'llama3.1', // Replace with your specific Ollama model
                messages: [{ role: 'user', content: transcribedText }],
            };

            try {
                // Send request to Ollama server using Ollama's API
                const response = await ollama.chat(payload);
                
                // Extract the bot's reply
                const botReply = response.message.content || 'Sorry, I could not process your request.';
                
                // Send the bot's reply back to WhatsApp
                client.sendMessage(chatId, botReply);
            } catch (error) {
                console.error('Error communicating with the Ollama server:', error.message);
                client.sendMessage(chatId, 'Oops! There was an error processing your request.');
            }
        }
    } else {
        // If it's not an audio message, handle it as a regular text message
        const payload = {
            model: 'llama3.1',
            messages: [{ role: 'user', content: text }],
        };

        try {
            const response = await ollama.chat(payload);
            const botReply = response.message.content || 'Sorry, I could not process your request.';
            client.sendMessage(chatId, botReply);
        } catch (error) {
            console.error('Error communicating with the Ollama server:', error.message);
            client.sendMessage(chatId, 'Oops! There was an error processing your request.');
        }
    }
});

// Function to transcribe audio to text using an external Python script
async function transcribeAudioToText(audioFilePath) {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(__dirname, 'transcribe_audio.py'); // Path to your Python script

        // Call the Python script and pass the audio file path
        exec(`python ${pythonScriptPath} "${audioFilePath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Error executing Python script:', error);
                reject(error);
            }
            if (stderr) {
                console.error('Python script stderr:', stderr);
                reject(stderr);
            }

            // Return the transcribed text
            resolve(stdout.trim());
        });
    });
}

// Start the WhatsApp client
client.initialize();
