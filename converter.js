/**
 * USA Political TCG - XLSX to Master JSON Converter
 * * This script reads the workbook, parses sheet names (e.g., 54CA),
 * and creates a unified JSON file for the game engine.
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = 'k USApoliticalTCG022326.xlsx';
const OUTPUT_FILE = 'political_tcg_master.json';

function convertXlsxToJson() {
    console.log(`Reading file: ${INPUT_FILE}...`);

    try {
        // 1. Load the Workbook
        const workbook = XLSX.readFile(INPUT_FILE);
        const masterData = {
            metadata: {
                version: "1.0.0",
                lastUpdated: new Date().toISOString(),
                totalStates: 0
            },
            states: {}
        };

        // 2. Iterate through each sheet
        workbook.SheetNames.forEach(sheetName => {
            // Regex to match: [Numbers][2 Letters] -> e.g. 54CA, 3WY, 3DC
            const match = sheetName.match(/^(\d+)([A-Z]{2})$/);
            
            if (match) {
                const electoralVotes = parseInt(match[1], 10);
                const stateCode = match[2];

                console.log(`Processing ${stateCode} (${electoralVotes} EVs)...`);

                // Get sheet data
                const worksheet = workbook.Sheets[sheetName];
                // convert to array of objects
                const rawCards = XLSX.utils.sheet_to_json(worksheet);

                // Clean data (standardizing headers if they vary)
                const formattedCards = rawCards.map(card => {
                    return {
                        name: card['Card Name'] || card['name'],
                        // Handles "Local Slang / Translation" or "Local Slang / Spanish"
                        translation: card['Local Slang / Translation'] || card['Local Slang / Spanish'] || card['translation'],
                        type: card['Type'] || card['type'],
                        cost: card['Cost'] !== undefined ? card['Cost'] : card['cost'],
                        effect: card['Effect'] || card['effect'],
                        flavorText: card['Flavor Text'] || card['flavor'],
                        learningGoal: card['ELL Goal'] || card['goal']
                    };
                });

                // Add to master object
                masterData.states[stateCode] = {
                    stateCode: stateCode,
                    electoralVotes: electoralVotes,
                    cardCount: formattedCards.length,
                    cards: formattedCards
                };

                masterData.metadata.totalStates++;
            } else {
                console.warn(`Skipping sheet "${sheetName}": Does not match naming pattern (e.g. 54CA).`);
            }
        });

        // 3. Write to File
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(masterData, null, 4));
        
        console.log('-----------------------------------------');
        console.log(`SUCCESS! Master file created: ${OUTPUT_FILE}`);
        console.log(`Total States Processed: ${masterData.metadata.totalStates}`);
        console.log('-----------------------------------------');

    } catch (error) {
        console.error("An error occurred during conversion:");
        console.error(error.message);
    }
}

// Execute
convertXlsxToJson();