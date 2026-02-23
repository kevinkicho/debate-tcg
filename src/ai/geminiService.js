/**
 * geminiService.js
 * Handles the generation of witty political debate speeches.
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateSpeech(cardName, cardType, isAI, stateCode) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Custom prompt to ensure the AI uses regional flair and political wit
    const prompt = `
        You are a politician from the state of ${stateCode} in a heated political debate TCG.
        You just played a card called "${cardName}" (Type: ${cardType}).
        
        Task: Generate a short, witty, and slightly aggressive 2-sentence debate speech.
        Style: Use regional slang or stereotypes related to ${stateCode}. 
        Perspective: ${isAI ? 'This is a fierce rebuttal to your opponent.' : 'This is your opening argument.'}
        
        Keep it under 40 words. No hashtags.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "My policies speak for themselves, and the voters know it!";
    }
}

module.exports = { generateSpeech };