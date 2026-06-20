// Account system: register + login (bcrypt password hashing).
// One account = one empire (created automatically on registration).
const bcrypt = require("bcryptjs");
const db = require("./db");
const { newUserId, create_empire_for_account } = require("./sessions");

const SALT_ROUNDS = 10;

function validUsername(u) {
  return typeof u === "string" && /^[A-Za-z0-9_]{3,32}$/.test(u);
}

function validPassword(p) {
  return typeof p === "string" && p.length >= 4 && p.length <= 128;
}

// Returns { ok, userid } or { ok:false, error }
async function register(username, password, empireName) {
  if (!validUsername(username)) {
    return { ok: false, error: "Username must be 3-32 chars (letters, digits, _)." };
  }
  if (!validPassword(password)) {
    return { ok: false, error: "Password must be 4-128 characters." };
  }

  const existing = await db.getAccountByUsername(username);
  if (existing) {
    return { ok: false, error: "This username is already taken." };
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const userid = newUserId();
  const account_id = await db.createAccount(username, password_hash, userid);

  // Create the player's empire (1 account = 1 empire)
  await create_empire_for_account(account_id, userid, empireName || username);

  return { ok: true, userid };
}

// Returns { ok, userid } or { ok:false, error }
async function login(username, password) {
  if (!username || !password) {
    return { ok: false, error: "Missing username or password." };
  }
  const account = await db.getAccountByUsername(username);
  if (!account) {
    return { ok: false, error: "Invalid username or password." };
  }
  const match = await bcrypt.compare(password, account.password_hash);
  if (!match) {
    return { ok: false, error: "Invalid username or password." };
  }
  return { ok: true, userid: account.userid };
}

module.exports = { register, login };
