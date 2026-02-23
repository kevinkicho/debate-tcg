const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateSpeech(cardName, cardType, isAI = false) {
    // Fallback if no API key is set
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_actual_api_key_here') {
        return isAI ? `(AI uses ${cardName}) "I strongly oppose this!"` : `(You used ${cardName}) "This is exactly what the people need!"`;
    }

    // THE FIX: Upgraded to the active 2.5 Flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const speaker = isAI ? "a rival AI political opponent" : "a passionate human politician";
    
    const prompt = `You are ${speaker} in a heated parliamentary debate. You just played a strategic maneuver called "${cardName}" (Strategy Type: ${cardType}). Write a dramatic, slightly humorous, and highly persuasive 2-sentence political speech executing this exact move. Do not use quotes around the text.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "The microphone cut out! (Speech generation failed)";
    }
}

module.exports = { generateSpeech };