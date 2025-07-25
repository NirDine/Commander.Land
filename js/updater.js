const SCRYFALL_API_URL =
  "https://api.scryfall.com/cards/search?q=type%3Aland+game%3Apaper+legal%3Acommander+-is%3Areprint";
const LANDS_JSON_PATH = "data/lands.json";

const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const newCardsList = document.getElementById("new-cards-list");
const downloadButton = document.getElementById("download-button");
const startButton = document.getElementById("start-button");
const progressContainer = document.getElementById("progress-container");

let scryfallData = [];
let originalLandsData = [];

async function fetchScryfallData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();

    scryfallData = scryfallData.concat(data.data);

    if (data.has_more) {
      const progress = (scryfallData.length / (scryfallData.length + data.total_cards)) * 100;
      progressBar.value = progress;
      progressText.textContent = `Fetching data... (${scryfallData.length} cards so far)`;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await fetchScryfallData(data.next_page);
    }
  } catch (error) {
    console.error("Error fetching Scryfall data:", error);
    progressText.textContent = "Error fetching data from Scryfall.";
  }
}

async function main() {
  progressContainer.style.display = "block";
  startButton.style.display = "none";

  await fetchScryfallData(SCRYFALL_API_URL);
  progressBar.value = 100;
  progressText.textContent = "All data fetched!";

  await fetchOriginalLands();
  compareAndDisplayNewCards();
}

async function fetchOriginalLands() {
  try {
    const response = await fetch(LANDS_JSON_PATH);
    const data = await response.json();
    originalLandsData = data.data;
  } catch (error) {
    console.error("Error fetching original lands data:", error);
  }
}

function compareAndDisplayNewCards() {
  const originalLandNames = new Set(originalLandsData.map((card) => card.name));
  let newCards = scryfallData.filter(
    (card) => !originalLandNames.has(card.name)
  );

  newCards = newCards.filter((card) => {
    if (card.card_faces && card.card_faces.length > 0) {
      const frontFace = card.card_faces[0];
      if (frontFace.mana_cost && frontFace.oracle_text && frontFace.oracle_text.toLowerCase().includes("transform")) {
        return false;
      }
    }
    return true;
  });

  const newCardsContainer = document.getElementById("new-cards-container");
  newCardsContainer.querySelector("h2").textContent = `New Cards (${newCards.length})`;

  if (newCards.length === 0) {
    newCardsList.innerHTML = "<p>No new lands found.</p>";
  } else {
      newCards.forEach((card) => {
      const cardElement = document.createElement("div");
      cardElement.classList.add("card");
      let imageUri;
      if (card.image_uris) {
        imageUri = card.image_uris.small;
      } else if (card.card_faces && card.card_faces[0].image_uris) {
        imageUri = card.card_faces[0].image_uris.small;
      } else {
        imageUri = "img/art/bg2.webp";
      }
      cardElement.innerHTML = `
        <img src="${imageUri}" alt="${card.name}">
        <p>${card.name}</p>
        <input type="checkbox" id="${card.id}" name="new-card" value="${card.id}" checked>
        <label for="${card.id}">Add to list</label>
      `;
      newCardsList.appendChild(cardElement);
    });
  }


  const updatedCards = [];
  const cardsToUpdate = [];

  originalLandsData.forEach(originalCard => {
    const scryfallCard = scryfallData.find(card => card.name === originalCard.name);
    if (scryfallCard && !originalCard.is_basic) {
      let updated = false;
      const originalRank = originalCard.edhrec_rank;
      const originalPrice = originalCard.prices ? originalCard.prices.usd : null;

      if (originalRank !== scryfallCard.edhrec_rank) {
        updated = true;
      }
      if (!originalCard.prices) {
        originalCard.prices = {};
      }
      if (originalPrice !== scryfallCard.prices.usd) {
        updated = true;
      }

      if(updated) {
        cardsToUpdate.push({
          original: {...originalCard, prices: {...originalCard.prices}},
          scryfall: scryfallCard,
        });
        originalCard.edhrec_rank = scryfallCard.edhrec_rank;
        originalCard.prices.usd = scryfallCard.prices.usd;
      }
    }
  });

  const updatedCardsContainer = document.createElement('div');
  updatedCardsContainer.innerHTML = `<h2>Updated Cards (${cardsToUpdate.length})</h2><div id="updated-cards-list"></div>`;
  document.body.insertBefore(updatedCardsContainer, downloadButton);

  const updatedCardsList = document.getElementById('updated-cards-list');
  if (cardsToUpdate.length === 0) {
    updatedCardsList.innerHTML = "<p>No cards to update.</p>";
  } else {
    cardsToUpdate.forEach(({ original, scryfall }) => {
      const cardElement = document.createElement("div");
      cardElement.classList.add("card");
      let imageUri;
      if (original.image_uris) {
        imageUri = original.image_uris.small;
      } else if (original.card_faces && original.card_faces[0].image_uris) {
        imageUri = original.card_faces[0].image_uris.small;
      } else {
        imageUri = "img/art/bg2.webp";
      }

      const rankChange = scryfall.edhrec_rank - original.edhrec_rank;
      const priceChange = scryfall.prices.usd - (original.prices ? original.prices.usd : 0);

      let rankHtml = `EDHREC Rank: ${scryfall.edhrec_rank}`;
      if(rankChange !== 0) {
        rankHtml = `EDHREC Rank: <span class="${rankChange > 0 ? 'increase' : 'decrease'}"><del>${original.edhrec_rank}</del> → ${scryfall.edhrec_rank}</span>`;
      }

      let priceHtml = `Price: $${scryfall.prices.usd}`;
      if(priceChange !== 0) {
        priceHtml = `Price: <span class="${priceChange > 0 ? 'increase' : 'decrease'}"><del>$${original.prices.usd || 0}</del> → $${scryfall.prices.usd}</span>`;
      }


      cardElement.innerHTML = `
        <img src="${imageUri}" alt="${original.name}">
        <p>${original.name}</p>
        <p>${rankHtml}</p>
        <p>${priceHtml}</p>
      `;
      updatedCardsList.appendChild(cardElement);
    });
  }


  downloadButton.disabled = false;
}

downloadButton.addEventListener("click", () => {
  const newLands = Array.from(document.querySelectorAll('input[name="new-card"]:checked')).map(
    (checkbox) => {
      const cardId = checkbox.value;
      const cardData = scryfallData.find((card) => card.id === cardId);
      return {
        object: cardData.object,
        id: cardData.id,
        name: cardData.name,
        released_at: cardData.released_at,
        image_uris: cardData.image_uris,
        type_line: cardData.type_line,
        oracle_text: cardData.oracle_text,
        color_identity: cardData.color_identity,
        keywords: cardData.keywords,
        produced_mana: cardData.produced_mana,
        edhrec_rank: cardData.edhrec_rank,
        is_basic: false,
        properties: [],
      };
    }
  );

  let updatedLandsData = [...originalLandsData, ...newLands];

  const basicLandOrder = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"];
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

  const updatedJson = {
    object: "list",
    total_cards: updatedLandsData.length,
    version: originalLandsData.version, // You might want to update this
    data: updatedLandsData,
  };

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(updatedJson, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "lands.json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});

startButton.addEventListener("click", main);
