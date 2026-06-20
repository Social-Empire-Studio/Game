// Ported from quests.py
const fs = require("fs");
const path = require("path");
const { QUESTS_DIR } = require("./bundle");

// Returns { body, status }
function get_quest_map(questid) {
  const file = path.join(QUESTS_DIR, String(questid) + ".json");
  if (!fs.existsSync(file)) {
    return { body: "", status: 404 };
  }
  const d = JSON.parse(fs.readFileSync(file, "utf-8"));
  return { body: d, status: 200 };
}

module.exports = { get_quest_map };
