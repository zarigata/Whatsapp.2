import pkg from 'whatsapp-web.js'; // Import as default
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import readline from 'readline'; // Import readline for terminal interaction
import { Ollama } from 'ollama'; // Import Ollama class
import { parse, stringify } from 'csv/sync'; // CSV parsing utilities

const { Client, LocalAuth } = pkg; // Destructure Client and LocalAuth from the imported package

const CSV_FILE = './config.csv'; // CSV file path
const SAVE_INTERVAL_MS = 60000; // Save to CSV every 60 seconds

// Initialize Ollama with the correct host
const ollama = new Ollama({ host: 'http://192.168.15.115:11434' }); // Ollama server URL

// Ensure the CSV file exists and create it if necessary
function ensureCSVFile() {
    if (!fs.existsSync(CSV_FILE)) {
        const headers = 'chatId,model\n'; // Define CSV headers
        fs.writeFileSync(CSV_FILE, headers); // Write headers to the CSV file
        console.log('CSV configuration file created.');
    }
}

// Load CSV into memory as a JavaScript object
function loadCSV() {
    ensureCSVFile();
    const rawData = fs.readFileSync(CSV_FILE, 'utf8');
    const records = parse(rawData, { columns: true, skip_empty_lines: true });
    return Object.fromEntries(records.map((row) => [row.chatId, { model: row.model }]));
}

// Save in-memory data to the CSV file
function saveCSV(data) {
    const records = Object.entries(data).map(([chatId, info]) => ({
        chatId,
        model: info.model || 'vera',
    }));
    const csvContent = stringify(records, { header: true });
    fs.writeFileSync(CSV_FILE, csvContent);
    console.log('CSV configuration saved.');
}

// Readline interface for terminal interaction
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Function to ask the user via terminal
function askTerminalQuestion(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

// Load initial configuration from CSV
let config = loadCSV();

// Periodically save the configuration to the CSV file
setInterval(() => {
    saveCSV(config);
}, SAVE_INTERVAL_MS);

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './session' }), // Saves session
});

// History storage
const chatHistory = {};

// Handle incoming messages
client.on('message', async (message) => {
    const chatId = message.from;
    const text = message.body;
    const isGroup = chatId.includes('@g.us'); // Ensure this is a group chat

    // Check if the user is allowed to interact
    if (!config[chatId]) {
        console.log(`User ${chatId} is not allowed to interact.`);

        // Ask via terminal if the user should be added
        const answer = await askTerminalQuestion(
            `User ${chatId} wants to interact with the bot. Add them to the allowed list? (yes/no): `
        );

        if (answer.toLowerCase() === 'yes') {
            // Add user with default model
            config[chatId] = { model: 'vera' };
            console.log(`User ${chatId} has been added with model "vera".`);
        } else {
            console.log(`User ${chatId} was not added.`);
            return; // Do nothing if not added
        }
    }

    // Get the model assigned to the user
    const model = config[chatId].model || 'vera';

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

// Listen for QR code
client.on('qr', (qr) => {
    console.log('Scan the QR Code below to log in:');
    qrcode.generate(qr, { small: true });
});

// Notify when logged in
client.on('ready', () => {
    console.log('WhatsApp Bot is ready!');
});

// Start the WhatsApp client
client.initialize();
