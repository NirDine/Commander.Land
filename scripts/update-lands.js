const fs = require('fs');
const path = require('path');

const SCRYFALL_API_URL = "https://api.scryfall.com/cards/search?q=type%3Aland+game%3Apaper+legal%3Acommander+-is%3Areprint";
const LANDS_JSON_PATH = path.join(__dirname, '../data/lands.json');
const POPULATOR_JS_PATH = path.join(__dirname, '../js/populator.js');

async function fetchScryfallData(url, allData = []) {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url);
    const data = await response.json();

    allData.push(...data.data);

    if (data.has_more) {
        // Respect Scryfall API rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        return fetchScryfallData(data.next_page, allData);
    }
    return allData;
}

async function main() {
    try {
        console.log("Starting update script...");

        // 1. Fetch data from Scryfall
        const scryfallData = await fetchScryfallData(SCRYFALL_API_URL);
        console.log(`Fetched ${scryfallData.length} cards from Scryfall.`);

        // 2. Read existing lands.json
        const originalJson = JSON.parse(fs.readFileSync(LANDS_JSON_PATH, 'utf8'));
        const originalLandsData = originalJson.data;
        const originalLandNames = new Set(originalLandsData.map(card => card.name));
        const today = new Date().toISOString().split('T')[0];

        // 3. Find new released lands
        let newLands = scryfallData.filter(card => {
            // Not already in our list
            if (originalLandNames.has(card.name)) return false;
            // Only released cards
            if (card.released_at > today) return false;
            // Filter out transforming DFCs (logic from updater.js)
            if (card.card_faces && card.card_faces.length > 0) {
                const frontFace = card.card_faces[0];
                if (frontFace.mana_cost && frontFace.oracle_text && frontFace.oracle_text.toLowerCase().includes("transform")) {
                    return false;
                }
            }
            return true;
        }).map(card => ({
            object: card.object,
            id: card.id,
            name: card.name,
            released_at: card.released_at,
            image_uris: card.image_uris,
            type_line: card.type_line,
            oracle_text: card.oracle_text,
            color_identity: card.color_identity,
            keywords: card.keywords,
            produced_mana: card.produced_mana,
            edhrec_rank: card.edhrec_rank,
            prices: card.prices,
            is_basic: false,
            properties: [],
        }));

        console.log(`Found ${newLands.length} new lands.`);

        // 4. Update existing lands (rank and price)
        let updatedCount = 0;
        originalLandsData.forEach(originalCard => {
            const scryfallCard = scryfallData.find(card => card.name === originalCard.name);
            if (scryfallCard && !originalCard.is_basic) {
                let updated = false;
                if (originalCard.edhrec_rank !== scryfallCard.edhrec_rank) {
                    originalCard.edhrec_rank = scryfallCard.edhrec_rank;
                    updated = true;
                }
                if (!originalCard.prices) originalCard.prices = {};
                if (originalCard.prices.usd !== scryfallCard.prices.usd) {
                    originalCard.prices.usd = scryfallCard.prices.usd;
                    updated = true;
                }
                if (updated) updatedCount++;
            }
        });
        console.log(`Updated ${updatedCount} existing lands.`);

        if (newLands.length === 0 && updatedCount === 0) {
            console.log("No changes detected. Skipping update.");
            return;
        }

        // 5. Combine and sort
        let updatedLandsData = [...originalLandsData, ...newLands];
        const basicLandOrder = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"];

        updatedLandsData.forEach(card => {
            if (basicLandOrder.includes(card.name)) {
                if (!card.prices) card.prices = {};
                card.prices.usd = "0.00"; // Changed to string to match common Scryfall format if needed, or 0
            }
        });

        updatedLandsData.sort((a, b) => {
            const aName = a.name;
            const bName = b.name;
            const aIsBasic = basicLandOrder.includes(aName);
            const bIsBasic = basicLandOrder.includes(bName);

            if (aIsBasic && bIsBasic) {
                return basicLandOrder.indexOf(aName) - basicLandOrder.indexOf(bName);
            } else if (aIsBasic) {
                return -1;
            } else if (bIsBasic) {
                return 1;
            } else {
                return aName.localeCompare(bName);
            }
        });

        // 6. Calculate new version
        const currentVersion = originalJson.version || "0";
        const newVersion = (parseFloat(currentVersion) + 0.01).toFixed(2);
        console.log(`New version: ${newVersion}`);

        const updatedJson = {
            object: "list",
            total_cards: updatedLandsData.length,
            version: newVersion,
            data: updatedLandsData,
        };

        // 7. Write updated lands.json
        fs.writeFileSync(LANDS_JSON_PATH, JSON.stringify(updatedJson, null, 2));
        console.log("Updated data/lands.json");

        // 8. Update version in js/populator.js
        let populatorJs = fs.readFileSync(POPULATOR_JS_PATH, 'utf8');
        populatorJs = populatorJs.replace(/const currentVersion = '.*'; \/\/ \[VERSION\]/, `const currentVersion = '${newVersion}'; // [VERSION]`);
        fs.writeFileSync(POPULATOR_JS_PATH, populatorJs);
        console.log("Updated js/populator.js version.");

    } catch (error) {
        console.error("Error in update script:", error);
        process.exit(1);
    }
}

main();
