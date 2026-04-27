/**
 * Simple AI Logic for Political TCG
 * Decides which card to play based on current state.
 */
const getBestAIMove = (aiPlayer, humanPlayer, swingStateDefenses = {}) => {
    const hand = aiPlayer.hand;
    const capital = aiPlayer.politicalCapital;

    if (hand.length === 0) return null;

    // Filter cards AI can actually afford
    const affordable = hand
        .map((card, index) => {
            let finalCost = card.cost;
            if (aiPlayer.costMod === 'double') finalCost *= 2;
            if (aiPlayer._costDiscount) finalCost = Math.max(0, finalCost - aiPlayer._costDiscount);
            return { ...card, index, finalCost };
        })
        .filter(card => card.finalCost <= capital);

    if (affordable.length === 0) return null;

    // Priority Scoring
    const scoredCards = affordable.map(card => {
        let score = card.finalCost * 10; // Higher cost generally means more impact

        // Bonus: Advantage over last played card
        const lastCard = aiPlayer.room?.lastPlayedCard;
        if (lastCard && card.argType && lastCard.argType) {
            const advantageMap = { 'Emotional': 'Moral Authority', 'Moral Authority': 'Data-Driven', 'Data-Driven': 'Emotional' };
            if (advantageMap[card.argType] === lastCard.argType) score += 25;
        }

        // Bonus: Targeting AI's weakest demographic
        if (card.demographic && aiPlayer.demographicApprovals) {
            const approvals = Object.values(aiPlayer.demographicApprovals);
            const minApproval = Math.min(...approvals);
            if (aiPlayer.demographicApprovals[card.demographic] === minApproval) score += 20;
        }

        // Bonus: Bilingual play
        if (card.translation) score += 15;

        // Priority 1: Winning the game
        if (card.effect.includes("Gain") && aiPlayer.points >= 45) score += 100;

        // Priority 2: Survival (If Support is low, prioritize healing/defense)
        if (aiPlayer.points < 15) {
            if (card.type.includes("Defense") || card.type.includes("Save") || card.type.includes("Counter")) score += 50;
        }

        // Priority 3: Economy (If Capital is low, prioritize Resource Gen)
        if (aiPlayer.politicalCapital < 3 && card.type.includes("Resource")) score += 40;

        // Priority 4: Disrupting the human
        const humanSwingStatesCount = (humanPlayer.swingStates || []).length;
        const aiSwingStatesCount = (aiPlayer.swingStates || []).length;
        if (humanPlayer.points > 40 || humanSwingStatesCount > aiSwingStatesCount) {
            let bonus = 60;
            if (humanSwingStatesCount > aiSwingStatesCount) bonus += 30;
            if (aiPlayer.politicalCapital >= 6 && humanSwingStatesCount > 0 && (card.type.includes("Attack") || card.type.includes("Trap"))) {
                const defendedCount = Object.keys(swingStateDefenses).length;
                if (defendedCount === humanSwingStatesCount) bonus -= 40; // Penalty if all targets are defended
                else bonus += 50;
            }
            if (card.type.includes("Attack") || card.type.includes("Trap")) score += bonus;
        }

        return { ...card, score };
    });

    // Sort by score and pick the best one
    scoredCards.sort((a, b) => b.score - a.score);
    return scoredCards[0].index;
};

module.exports = { getBestAIMove };