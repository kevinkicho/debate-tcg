/**
 * Simple AI Logic for Political TCG
 * Decides which card to play based on current state.
 */
export const getBestAIMove = (aiPlayer, humanPlayer) => {
    const hand = aiPlayer.hand;
    const capital = aiPlayer.capital;

    if (hand.length === 0) return null;

    // Filter cards AI can actually afford
    const affordable = hand
        .map((card, index) => ({ ...card, index }))
        .filter(card => card.cost <= capital);

    if (affordable.length === 0) return null;

    // Priority Scoring
    const scoredCards = affordable.map(card => {
        let score = card.cost * 10; // Higher cost generally means more impact

        // Priority 1: Winning the game
        if (card.effect.includes("Gain") && aiPlayer.support >= 45) score += 100;

        // Priority 2: Survival (If Support is low, prioritize healing/defense)
        if (aiPlayer.support < 15) {
            if (card.type === "Defense" || card.type === "Heal") score += 50;
        }

        // Priority 3: Economy (If Capital is low, prioritize Resource Gen)
        if (aiPlayer.capital < 3 && card.type === "Resource Gen") score += 40;

        // Priority 4: Disrupting the human (If human is close to winning)
        if (humanPlayer.support > 40) {
            if (card.type.includes("Attack") || card.type === "Trap Card") score += 60;
        }

        return { ...card, score };
    });

    // Sort by score and pick the best one
    scoredCards.sort((a, b) => b.score - a.score);
    return scoredCards[0].index;
};