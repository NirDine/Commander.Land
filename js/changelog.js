// Fetch and load JSON files from the updates directory
function loadUpdates() {
const updatesDirectory = '../updates/';


  return fetch(updatesDirectory)
    .then(response => response.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a'));
      const jsonFiles = links
        .map(link => link.getAttribute('href'))
        .filter(file => file.endsWith('.json'));

      const promises = jsonFiles.map(file => {
        const url = `${file}`;
        return fetch(url).then(response => response.json());
      });

      return Promise.all(promises);
    });
}

// Process and display the loaded updates
function processUpdates(updates) {
  updates.forEach(update => {
    const title = update.title;
    const changes = update.changes;
    const paragraph = update.paragraph;

    // Display the update information as needed
    console.log('Title:', title);
    console.log('Changes:', changes);
    console.log('Paragraph:', paragraph);
  });
}

// Process and display the loaded updates
function processUpdates(updates) {
  const changelog = $('.changelog');

  updates.forEach(update => {
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
