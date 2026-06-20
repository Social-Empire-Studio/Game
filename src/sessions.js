// Player/session storage — now backed by MySQL instead of JSON files.
//
// A synchronous in-memory cache (__saves) mirrors the DB so the existing
// synchronous game logic (command.js, playerInfo.js) keeps working unchanged.
// Reads hit the cache; writes update the cache AND persist to MySQL.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { version_code, migrate_loaded_save } = require("./version");
const { timestamp_now } = require("./engine");
const { VILLAGES_DIR } = require("./bundle");
const db = require("./db");

// In-memory cache of all saves: { userid: saveDocument }
let __saves = {};
// userid -> account_id (needed for inserts)
let __accountOf = {};

// Empire template (the gabarit for a brand-new empire). This is NOT a save,
// it's the blueprint, so we keep reading it from disk.
const __initial_village = JSON.parse(
  fs.readFileSync(path.join(VILLAGES_DIR, "initial.json"), "utf-8")
);

// ---------- Load all saves from MySQL into the cache ----------

async function load_saved_villages() {
  __saves = {};
  __accountOf = {};
  __saves = await db.getAllSaves();

  // Map userid -> account_id
  const [rows] = await db.getPool().query("SELECT id, userid FROM accounts");
  for (const r of rows) {
    __accountOf[String(r.userid)] = r.id;
  }

  // Migrate any out-of-date saves
  for (const userid of Object.keys(__saves)) {
    const modified = migrate_loaded_save(__saves[userid]);
    if (modified) await persist(userid);
  }

  console.log(` * Loaded ${Object.keys(__saves).length} save(s) from MySQL.`);
}

// ---------- New empire (tied to an account) ----------

async function create_empire_for_account(account_id, userid, empireName) {
  const village = JSON.parse(JSON.stringify(__initial_village));
  village.version = version_code;
  village.playerInfo.pid = userid;
  if (empireName) {
    village.playerInfo.name = empireName;
    village.playerInfo.map_names = [empireName];
  }
  village.maps[0].timestamp = timestamp_now();
  village.privateState.dartsRandomSeed = Math.abs(
    Math.trunc((Math.pow(2, 16) - 1) * Math.random())
  );

  __saves[userid] = village;
  __accountOf[userid] = account_id;
  await db.upsertSave(userid, account_id, village);
  return userid;
}

function newUserId() {
  return crypto.randomUUID();
}

// ---------- Access functions ----------

function all_saves_userid() {
  return Object.keys(__saves);
}

function all_userid() {
  return Object.keys(__saves);
}

function save_info(USERID) {
  const save = __saves[USERID];
  const default_map = save.playerInfo.default_map;
  const empire_name = String(save.playerInfo.map_names[default_map]);
  const xp = save.maps[default_map].xp;
  const level = save.maps[default_map].level;
  return { userid: USERID, name: empire_name, xp, level };
}

function all_saves_info() {
  return Object.keys(__saves).map((userid) => save_info(userid));
}

// equivalent of Python's session(USERID)
function getSave(USERID) {
  if (typeof USERID !== "string") throw new Error("USERID must be a string");
  return USERID in __saves ? __saves[USERID] : null;
}

// No more static villages — neighbours are other players only.
function neighbor_session(USERID) {
  if (typeof USERID !== "string") throw new Error("USERID must be a string");
  return USERID in __saves ? __saves[USERID] : undefined;
}

function fb_friends_str(USERID) {
  const friends = [];
  for (const key of Object.keys(__saves)) {
    const vill = __saves[key];
    if (vill.playerInfo.pid === USERID) continue;
    const frie = { uid: vill.playerInfo.pid, pic_square: vill.playerInfo.pic };
    if (!frie.pic_square) frie.pic_square = "/img/profile/1025.png";
    friends.push(frie);
  }
  return friends;
}

function neighbors(USERID) {
  const out = [];
  for (const key of Object.keys(__saves)) {
    const vill = __saves[key];
    if (vill.playerInfo.pid === USERID) continue;
    const neigh = vill.playerInfo;
    neigh.coins = vill.maps[0].coins;
    neigh.xp = vill.maps[0].xp;
    neigh.level = vill.maps[0].level;
    neigh.stone = vill.maps[0].stone;
    neigh.wood = vill.maps[0].wood;
    neigh.food = vill.maps[0].food;
    out.push(neigh);
  }
  return out;
}

// ---------- Persistency ----------

async function persist(USERID) {
  const data = __saves[USERID];
  if (!data) return;
  const account_id = __accountOf[USERID];
  if (account_id === undefined) {
    await db.updateSaveData(USERID, data);
  } else {
    await db.upsertSave(USERID, account_id, data);
  }
}

// Called synchronously by the game logic after each command batch.
// Persists to MySQL in the background; logs (does not crash) on error.
function save_session(USERID) {
  persist(USERID).catch((err) => {
    console.error(` ! Failed to persist save for ${USERID}:`, err.message);
  });
}

function is_valid_village(save) {
  if (!("playerInfo" in save) || !("maps" in save) || !("privateState" in save)) {
    return false;
  }
  for (const map of save.maps) {
    if ("oil" in map || "steel" in map) return false;
    if (!("stone" in map) || !("food" in map)) return false;
    if (!("items" in map)) return false;
    if (!Array.isArray(map.items)) return false;
  }
  return true;
}

module.exports = {
  load_saved_villages,
  create_empire_for_account,
  newUserId,
  all_saves_userid,
  all_userid,
  save_info,
  all_saves_info,
  getSave,
  neighbor_session,
  fb_friends_str,
  neighbors,
  is_valid_village,
  save_session,
  persist,
};
