// Fetch and load JSON files from the updates directory
function loadUpdates() {
  const updatesIndex = 'updates/index.json';

  return fetch(updatesIndex)
    .then(response => response.json())
    .then(jsonFiles => {
      const promises = jsonFiles.map(file => {
        const url = `updates/${file}`;
        return fetch(url).then(response => response.json());
      });

      return Promise.all(promises);
    });
}

// Process and display the loaded updates
function processUpdates(updates) {
  const changelog = $('.changelog');
  const maxUpdates = 5; // Maximum number of updates to display

  // Reverse the updates array to show newer updates first
  updates.reverse();

  // Slice the array to limit the updates
  const limitedUpdates = updates.slice(0, maxUpdates);

  limitedUpdates.forEach(update => {
    const title = update.title;
    const changes = update.changes;
    const paragraph = update.paragraph;

    const explainDiv = $('<div class="log"></div>');
    const titleLog = $(`<h4 class="titleLog">${title}:</h4>`);
    const log = $(`<p class="">${paragraph}</p>`);
    const logChanges = $('<ul class="logChanges"></ul>');

    changes.forEach(change => {
      const li = $(`<li>${change}</li>`);
      logChanges.append(li);
    });

    explainDiv.append(titleLog);
    explainDiv.append(log);
    explainDiv.append(logChanges);

    changelog.append(explainDiv);
  });
}


// Load and process the updates
loadUpdates()
  .then(processUpdates)
  .catch(error => {
    console.error('Error loading updates:', error);
  });
