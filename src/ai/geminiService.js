const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "DUMMY_KEY");

const FALLBACK_TEMPLATES = [
    "Voters in ${stateCode} won't be fooled by your stance on ${cardName}!",
    "My ${cardName} policy is the 'Synergy' this state needs. Let's pivot!",
    "I've discussed ${cardName} with real families in ${stateCode}. They're ready.",
    "Your ${cardName} plan? It's fundamentally flawed. I have the receipts.",
    "I'm not just playing ${cardName}; I'm building a legacy for ${stateCode}!",
    "Wait until the donors at the gala hear about this ${cardName} move...",
    "Is ${cardName} really the hill you want to die on in this debate?",
    "Under my administration, ${cardName} will be a fundamental right!",
    "I'll be speaking my truth about ${cardName} on every platform in ${stateCode}.",
    "The data from my internal polling in ${stateCode} says YAY on ${cardName}!"
];

async function generateSpeech(cardName, cardType, isAI, stateCode) {
    const isValidKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith("AIza");

    // Select a random witty template for local use
    const template = FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
    const localSpeech = template.replace("${stateCode}", stateCode).replace("${cardName}", cardName);

    if (!isValidKey) return localSpeech;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const role = isAI ? "a fierce political opponent" : "a confident political candidate";
    const prompt = `
        You are ${role} from the state of ${stateCode} in a political TCG.
        You just played a card called "${cardName}" of type "${cardType}".
        
        Write a short (20 words max), punchy, and thematic debate line. 
        Use regional flair from ${stateCode} if possible.
        No hashtags, no mentions of "TCG" or "cards", just the speech.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/^"(.*)"$/, '$1');
        return text || localSpeech;
    } catch (error) {
        console.error("Gemini Error:", error);
        return localSpeech;
    }
}

module.exports = { generateSpeech };