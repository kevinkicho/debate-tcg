const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Configuration: Put all your CSV files in a 'csv_data' folder
const INPUT_DIR = path.join(__dirname, 'csv_data');
const OUTPUT_DIR = path.join(__dirname, 'src', 'data'); // Outputs to your game's data folder

// Helper function: Parses a CSV line accurately, handling commas inside quotes
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
            // Escaped quote
            current += '"';
            i++; 
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Main Converter Function
async function convertCsvToJson(inputFilePath, outputFilePath, prefix) {
    const fileStream = fs.createReadStream(inputFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const cards = [];
    let isHeader = true;
    let idCounter = 1;

    for await (const line of rl) {
        if (!line.trim()) continue; // Skip empty lines
        
        const parsed = parseCSVLine(line);

        // Skip the header row
        if (isHeader) {
            isHeader = false;
            continue;
        }

        // Map the columns: Name, Slang, Type, Cost, Effect, Flavor Text, ELL Goal
        const cardObject = {
            id: `${prefix}${idCounter++}`, // e.g., ohio1, ohio2
            name: parsed[0] || "Unknown",
            localSlang: parsed[1] || "",
            type: parsed[2] || "Event",
            cost: parseInt(parsed[3], 10) || 0,
            effect: parsed[4] || "",
            flavorText: parsed[5] || "",
            ellGoal: parsed[6] || ""
        };

        cards.push(cardObject);
    }

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write to JSON file cleanly
    fs.writeFileSync(outputFilePath, JSON.stringify(cards, null, 4), 'utf-8');
    console.log(`✅ Successfully converted ${path.basename(inputFilePath)} -> ${cards.length} cards saved to ${path.basename(outputFilePath)}`);
}

// Execution Runner
async function runAllConversions() {
    if (!fs.existsSync(INPUT_DIR)) {
        console.error(`❌ Error: Please create a folder named 'csv_data' in the same directory as this script and put your CSV files inside it.`);
        return;
    }

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.csv'));
    
    if (files.length === 0) {
        console.log(`⚠️ No CSV files found in the 'csv_data' folder.`);
        return;
    }

    console.log(`Found ${files.length} CSV files. Starting conversion...\n`);

    for (const file of files) {
        const inputPath = path.join(INPUT_DIR, file);
        // Clean the filename (e.g., "ohio_politicians.csv" -> "ohio_politicians.json")
        const outFileName = file.replace('.csv', '.json');
        const outputPath = path.join(OUTPUT_DIR, outFileName);
        
        // Generate a 2-3 letter prefix for IDs based on filename (e.g., 'oh' for ohio)
        const prefix = file.substring(0, 2).toLowerCase() + '_';

        await convertCsvToJson(inputPath, outputPath, prefix);
    }
    
    console.log(`\n🎉 All conversions complete! You can now load these JSON files into your deckBuilder.js database.`);
}

runAllConversions();