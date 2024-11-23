import pkg from 'whatsapp-web.js';  // Import as default
const { Client, LocalAuth } = pkg;  // Destructure the required exports
import qrcode from 'qrcode-terminal';
import { Ollama } from 'ollama'; // Import Ollama class
import fetch from 'node-fetch'; // For sending audio to Python server
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Ensure __dirname is interpreted correctly for ES modules
const __dirname = new URL('.', import.meta.url).pathname;

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

// History storage
const chatHistory = {};

// Handle incoming messages
client.on('message', async (message) => {
    const chatId = message.from;
    const text = message.body;
    const isGroup = chatId.includes('@g.us'); // Ensure this is a group chat
    
    // Check if the message contains a mention of the bot
    const isMentioned = message.mentionedIds && message.mentionedIds.includes(client.info.wid._serialized);

    // Debugging: Log the message and mentions array to help troubleshoot
    console.log('Message:', message);
    console.log('Mentions:', message.mentionedIds);
    console.log('Group Mentions:', message.groupMentions);

    // If the message is from a group and the bot is not mentioned, do not reply
    if (isGroup && !isMentioned) {
        console.log('Bot not mentioned in group, ignoring message.');
        return; // Do nothing
    }

    // Initialize chat history if not present
    if (!chatHistory[chatId]) {
        chatHistory[chatId] = [];
    }

    // If the message is an audio message (voice message)
    if (message.hasMedia && message.type === 'ptt') {
        try {
            const media = await message.downloadMedia();
            const audioBuffer = Buffer.from(media.data, 'base64');  // Convert audio to buffer

            console.log('Audio buffer ready, sending to transcription server...');

            // Send the audio buffer directly to the Python server for transcription
            const response = await fetch('http://127.0.0.1:5000/transcribe', {
                method: 'POST',
                body: audioBuffer,  // Send audio buffer as body
                headers: {
                    'Content-Type': 'audio/wav',
                },
            });
            
            const result = await response.json();
            if (response.ok) {
                const transcription = result.transcription || 'Sorry, I could not transcribe the audio.';
                console.log('Transcription:', transcription);
                
                // Add the transcription to chat history
                chatHistory[chatId].push({ role: 'user', content: transcription });

                // Prepare payload for Ollama
                const payload = {
                    model: 'llama3.1', // Replace with your specific Ollama model
                    messages: chatHistory[chatId],
                };

                // Send transcription to Ollama for response
                const ollamaResponse = await ollama.chat(payload);

                const botReply = ollamaResponse.message.content || 'Sorry, I could not process your request.';
                chatHistory[chatId].push({ role: 'assistant', content: botReply });

                // Send the bot's reply back to WhatsApp
                client.sendMessage(chatId, botReply);
            } else {
                console.error('Error transcribing audio:', result.error);
                client.sendMessage(chatId, 'Sorry, I could not transcribe the audio.');
            }
        } catch (error) {
            console.error('Error handling voice message:', error);
            message.reply('An error occurred while processing the voice message.');
        }
    } else if (text) {
        // Regular text message handling (same as before)
        chatHistory[chatId].push({ role: 'user', content: text });

        if (chatHistory[chatId].length > 6) {
            chatHistory[chatId] = chatHistory[chatId].slice(-6);
        }

        const payload = {
            model: 'llama3.1', // Replace with your specific Ollama model
            messages: chatHistory[chatId],
        };

        try {
            const response = await ollama.chat(payload);
            const botReply = response.message.content || 'Sorry, I could not process your request.';
            chatHistory[chatId].push({ role: 'assistant', content: botReply });
            client.sendMessage(chatId, botReply);
        } catch (error) {
            console.error('Error communicating with Ollama server:', error.message);
            client.sendMessage(chatId, 'Oops! There was an error processing your request.');
        }
    }
});

// Start the WhatsApp client
client.initialize();
