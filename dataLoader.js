const fs = require('fs');

function loadAccounts() {
  const raw = fs.readFileSync('./accountsList.json');
  return JSON.parse(raw);
}

module.exports = { loadAccounts };