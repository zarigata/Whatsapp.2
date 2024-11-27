import pkg from 'whatsapp-web.js'; // Import as default
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { Ollama } from 'ollama'; // Import Ollama class

const { Client, LocalAuth } = pkg; // Destructure Client and LocalAuth from the imported package

// File path for the configuration JSON
const CONFIG_FILE = './config.json';

// Initialize Ollama with the correct host
const ollama = new Ollama({ host: 'http://192.168.15.115:11434' }); // Ollama server URL

// Function to ensure the JSON file exists and is correctly formatted
function ensureConfigFile() {
    if (!fs.existsSync(CONFIG_FILE)) {
        const defaultConfig = {
            allowedUsers: [], // Array of allowed users
            models: {} // Map of user IDs to models
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 4));
        console.log('Configuration file created.');
    }
}

// Function to load the JSON configuration
function loadConfig() {
    ensureConfigFile();
    const rawData = fs.readFileSync(CONFIG_FILE);
    return JSON.parse(rawData);
}

// Function to save the JSON configuration
function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4));
}

// Initialize WhatsApp client
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

// Load configuration
let config = loadConfig();

// History storage
const chatHistory = {};

// Handle incoming messages
client.on('message', async (message) => {
    const chatId = message.from;
    const text = message.body;
    const isGroup = chatId.includes('@g.us'); // Ensure this is a group chat

    // Check if the user is allowed to interact
    const userAllowed = config.allowedUsers.includes(chatId);
    const model = config.models[chatId] || 'default';

    if (!userAllowed) {
        console.log(`User ${chatId} is not allowed to interact.`);
        return; // Do nothing
    }

    // Check if the message contains a mention of the bot
    const isMentioned = message.mentionedIds && message.mentionedIds.includes(client.info.wid._serialized);

    // If the message is from a group and the bot is not mentioned, do not reply
    if (isGroup && !isMentioned) {
        console.log('Bot not mentioned in group, ignoring message.');
        return;
    }

    // Initialize chat history if not present
    if (!chatHistory[chatId]) {
        chatHistory[chatId] = [];
    }

    // Add message to history
    chatHistory[chatId].push({ role: 'user', content: text });

    // Keep only the last six interactions
    if (chatHistory[chatId].length > 6) {
        chatHistory[chatId] = chatHistory[chatId].slice(-6);
    }

    // Prepare payload for Ollama
    const payload = {
        model, // Use the user's configured model
        messages: chatHistory[chatId],
    };

    try {
        // Send request to Ollama server
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
