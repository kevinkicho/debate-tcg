const quizzes = require('../data/quizzes.json');

class QuizManager {
    constructor() {
        // We store active quizzes in memory to verify answers later
        this.activeChallenges = new Map();
    }

    // Pull a random quiz based on whether it's an Attack, Defense, or Ultimate card
    generateQuizForCard(socketId, cardCategory) {
        let pool = [];
        if (cardCategory === 'Defense' || cardCategory === 'Damage Control') {
            pool = quizzes.defense_quizzes;
        } else if (cardCategory === 'Ultimate' || cardCategory === 'Board Reset') {
            pool = quizzes.ultimate_quizzes;
        } else {
            pool = quizzes.attack_quizzes; // Default to attack/action
        }

        // Pick a random quiz from the pool
        const randomIndex = Math.floor(Math.random() * pool.length);
        const selectedQuiz = pool[randomIndex];

        // Store the answer securely on the server, linked to the player's socket ID
        this.activeChallenges.set(socketId, {
            quizId: selectedQuiz.id,
            correctAnswer: selectedQuiz.correctAnswer
        });

        // Strip the correct answer before sending the payload to the client!
        const { correctAnswer, ...clientPayload } = selectedQuiz;
        return clientPayload;
    }

    // Validate the player's submission against the securely stored answer
    validateAnswer(socketId, submittedAnswer) {
        const challenge = this.activeChallenges.get(socketId);
        if (!challenge) return false;

        let isCorrect = false;

        // Check if the answer is an array (for fill-in-the-blanks) or a string (multiple choice)
        if (Array.isArray(challenge.correctAnswer)) {
            isCorrect = JSON.stringify(challenge.correctAnswer) === JSON.stringify(submittedAnswer);
        } else {
            // Case-insensitive check for rapid typing / multiple choice
            isCorrect = String(submittedAnswer).toLowerCase() === String(challenge.correctAnswer).toLowerCase();
        }

        // Clean up the challenge from memory
        this.activeChallenges.delete(socketId);
        
        return isCorrect;
    }
}

module.exports = new QuizManager();