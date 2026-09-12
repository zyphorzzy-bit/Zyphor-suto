const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../database.json');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ keys: [], groups: {} }, null, 2));
}

function getDb() {
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateKeyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `ZY-${segment()}-${segment()}-${segment()}`;
}

module.exports = { getDb, saveDb, generateKeyCode };
