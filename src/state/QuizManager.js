const quizzes = require('../data/quizzes.json');

class QuizManager {
    constructor() {
        // We store active quizzes in memory to verify answers later
        this.activeChallenges = new Map();
    }

    // Pull a random quiz based on whether it's an Attack, Defense, or Ultimate card
    generateQuizForCard(socketId, cardCategory) {
        let pool = [];
        if (cardCategory.includes('Defense') || cardCategory.includes('Damage Control') || cardCategory.includes('Save') || cardCategory.includes('Counter')) {
            pool = quizzes.defense_quizzes;
        } else if (cardCategory === 'Ultimate' || cardCategory === 'Board Reset') {
            pool = quizzes.ultimate_quizzes;
        } else {
            pool = quizzes.attack_quizzes; // Default to attack/action
        }

        // Pick a random quiz from the pool
        const randomIndex = Math.floor(Math.random() * pool.length);
        const selectedQuiz = pool[randomIndex];



        // Store the answer securely on the server
        this.activeChallenges.set(socketId, {
            quizId: selectedQuiz.id,
            correctAnswer: selectedQuiz.correctAnswer || selectedQuiz.targetWord
        });

        // Normalize payload for client
        const options = [];
        if (selectedQuiz.options) {
            selectedQuiz.options.forEach((opt, index) => {
                const label = opt.includes(')') ? opt.split(')')[0] : String.fromCharCode(65 + index);
                options.push({ id: label, text: opt });
            });
        } else if (selectedQuiz.wordBank) {
            selectedQuiz.wordBank.forEach(word => {
                options.push({ id: word, text: word });
            });
        } else if (selectedQuiz.type === 'rapid_typing') {
            options.push({ id: 'typing', text: 'Type the word...' });
        }

        return {
            quizId: selectedQuiz.id,
            question: selectedQuiz.prompt,
            options: options,
            type: selectedQuiz.type
        };
    }

    // Validate the player's submission against the securely stored answer
    validateAnswer(socketId, quizId, submittedAnswer) {
        const challenge = this.activeChallenges.get(socketId);
        if (challenge && challenge.quizId !== quizId) return false;
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