import pkg from 'whatsapp-web.js';  // Import as default
import qrcode from 'qrcode-terminal';
import { Ollama } from 'ollama'; // Import Ollama class

const { Client, LocalAuth } = pkg; // Destructure Client and LocalAuth from the imported package

// Initialize Ollama with the correct host
const ollama = new Ollama({ host: 'http://192.168.15.115:11434' }); // Ollama server URL

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
    const isGroup = message.from.startsWith('g'); // Check if the message is from a group
    
    // Check if the message contains a mention of the bot
    const isMentioned = message.mentions && message.mentions.some(mention => mention.id === client.info.wid._serialized);

    // If the message is from a group and the bot is not mentioned, do not reply
    if (isGroup && !isMentioned) {
        return; // Do nothing
    }

    // Initialize chat history if not present
    if (!chatHistory[chatId]) {
        chatHistory[chatId] = [];
    }

    // Add message to history
    chatHistory[chatId].push({ role: 'user', content: text });

    // Keep only the last three interactions (trim history)
    if (chatHistory[chatId].length > 6) {
        chatHistory[chatId] = chatHistory[chatId].slice(-6);
    }

    // Prepare payload for Ollama
    const payload = {
        model: 'ingles', // Replace with your specific Ollama model
        messages: chatHistory[chatId],
    };

    try {
        // Send request to Ollama server using Ollama's API
        const response = await ollama.chat(payload);
        
        // Extract the bot's reply
        const botReply = response.message.content || 'Sorry, I could not process your request.';

        // Add the bot's reply to the history
        chatHistory[chatId].push({ role: 'assistant', content: botReply });

        // Send the bot's reply back to WhatsApp
        client.sendMessage(chatId, botReply);
    } catch (error) {
        console.error('Error communicating with the Ollama server:', error.message);
        client.sendMessage(chatId, 'Oops! There was an error processing your request.');
    }
});

// Start the WhatsApp client
client.initialize();
