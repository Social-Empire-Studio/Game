// Express server — MySQL-backed accounts + saves (no JSON file storage).
console.log(" [+] Loading basics...");

const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
const session = require("express-session");

const { server: serverCfg, sessionSecret } = require("./config");

console.log(" [+] Loading game config...");
const { get_game_config } = require("./gameConfig");

console.log(" [+] Loading modules...");
const db = require("./db");
const { get_player_info, get_neighbor_info } = require("./playerInfo");
const {
  load_saved_villages,
  all_saves_userid,
  save_info,
  fb_friends_str,
} = require("./sessions");
const auth = require("./auth");
const { command } = require("./command");
const { timestamp_now } = require("./engine");
const { version_name } = require("./version");
const { Constant } = require("./constants");
const { get_quest_map } = require("./quests");
const { ASSETS_DIR, STUB_DIR, TEMPLATES_DIR, BASE_DIR } = require("./bundle");

const host = serverCfg.host;
const port = serverCfg.port;

const app = express();

app.set("view engine", "ejs");
app.set("views", TEMPLATES_DIR);

app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
  })
);

// CORS — Ruffle loads the .swf, then the SWF makes cross-origin requests.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, *");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// request.values equivalent: merge query + body
function values(req) {
  return Object.assign({}, req.query, req.body);
}

// Async error wrapper
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

console.log(" [+] Configuring server routes...");

//////////////////
// AUTH / PAGES  //
//////////////////

const DEFAULT_GAMEVERSION = "SocialEmpires0926bsec.swf";

// Login / register screen
app.get("/", (req, res) => {
  return res.render("login", { version: version_name, error: null });
});

app.post(
  "/register",
  wrap(async (req, res) => {
    const { username, password, empire } = req.body;
    const result = await auth.register(username, password, empire);
    if (!result.ok) {
      return res.status(400).render("login", { version: version_name, error: result.error });
    }
    req.session.USERID = result.userid;
    req.session.USERNAME = username;
    req.session.GAMEVERSION = DEFAULT_GAMEVERSION;
    console.log("[REGISTER] new account:", username, "->", result.userid);
    return res.redirect("/ruffle.html");
  })
);

app.post(
  "/login",
  wrap(async (req, res) => {
    const { username, password } = req.body;
    const result = await auth.login(username, password);
    if (!result.ok) {
      return res.status(401).render("login", { version: version_name, error: result.error });
    }
    req.session.USERID = result.userid;
    req.session.USERNAME = username;
    req.session.GAMEVERSION = DEFAULT_GAMEVERSION;
    console.log("[LOGIN] USERID:", result.userid);
    return res.redirect("/ruffle.html");
  })
);

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Auth gate for the game pages
function requireAuth(req, res, next) {
  if (!("USERID" in req.session)) return res.redirect("/");
  if (!all_saves_userid().includes(req.session.USERID)) return res.redirect("/");
  if (!("GAMEVERSION" in req.session)) req.session.GAMEVERSION = DEFAULT_GAMEVERSION;
  next();
}

// /play.html redirects to the Ruffle player.
app.get("/play.html", requireAuth, (req, res) => res.redirect("/ruffle.html"));

// Native-Flash embed page (kept for completeness)
app.get("/play-flash.html", requireAuth, (req, res) => {
  const USERID = req.session.USERID;
  const GAMEVERSION = req.session.GAMEVERSION;
  console.log("[PLAY] USERID:", USERID);
  return res.render("play", {
    save_info: save_info(USERID),
    serverTime: timestamp_now(),
    friendsInfo: fb_friends_str(USERID),
    version: version_name,
    GAMEVERSION,
    SERVERIP: host,
  });
});

app.get("/ruffle.html", requireAuth, (req, res) => {
  const USERID = req.session.USERID;
  const GAMEVERSION = req.session.GAMEVERSION;
  console.log("[RUFFLE] USERID:", USERID);
  return res.render("ruffle", {
    save_info: save_info(USERID),
    serverTime: timestamp_now(),
    version: version_name,
    GAMEVERSION,
    SERVERIP: host,
  });
});

app.get("/crossdomain.xml", (req, res) => {
  res.type("application/xml");
  res.sendFile(path.join(STUB_DIR, "crossdomain.xml"));
});

app.use("/img", express.static(path.join(TEMPLATES_DIR, "img")));
app.use("/css", express.static(path.join(TEMPLATES_DIR, "css")));

//////////////////
// GAME STATIC   //
//////////////////

const SP_PREFIX = "/default01.static.socialpointgames.com/static/socialempires";

app.get(`${SP_PREFIX}/swf/05122012_projectiles.swf`, (req, res) => {
  res.sendFile(path.join(ASSETS_DIR, "swf", "20130417_projectiles.swf"));
});
app.get(`${SP_PREFIX}/swf/05122012_magicParticles.swf`, (req, res) => {
  res.sendFile(path.join(ASSETS_DIR, "swf", "20131010_magicParticles.swf"));
});
app.get(`${SP_PREFIX}/swf/05122012_dynamic.swf`, (req, res) => {
  res.sendFile(path.join(ASSETS_DIR, "swf", "120608_dynamic.swf"));
});

app.get(`${SP_PREFIX}/*`, (req, res) => {
  const assetPath = req.params[0];
  const providedFile = path.join(ASSETS_DIR, assetPath);

  if (fs.existsSync(providedFile)) {
    return res.sendFile(providedFile);
  }

  const downloadedFile = path.join(BASE_DIR, "download_assets", "assets", assetPath);
  if (fs.existsSync(downloadedFile)) {
    console.log(`====== USING EXTERNAL: download_assets/assets/${assetPath}`);
    return res.sendFile(downloadedFile);
  }

  const directory = path.dirname(downloadedFile);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  const URL = `https://static.socialpointgames.com/static/socialempires/assets/${assetPath}`;

  https
    .get(URL, (cdnRes) => {
      if (cdnRes.statusCode !== 200) {
        cdnRes.resume();
        return res.status(404).send("");
      }
      const out = fs.createWriteStream(downloadedFile);
      cdnRes.pipe(out);
      out.on("finish", () => {
        out.close(() => {
          console.log(`====== DOWNLOADED ASSET: ${URL}`);
          res.sendFile(downloadedFile);
        });
      });
    })
    .on("error", () => res.status(404).send(""));
});

///////////////////
// GAME DYNAMIC   //
///////////////////

const DYN_PREFIX = "/dynamic.flash1.dev.socialpoint.es/appsfb/socialempiresdev/srvempires";

app.post(`${DYN_PREFIX}/track_game_status.php`, (req, res) => {
  const v = values(req);
  console.log(`track_game_status: status=${v.status}, user_id=${v.user_id}.`);
  res.status(200).send("");
});

app.all(`${DYN_PREFIX}/get_game_config.php`, (req, res) => {
  const v = values(req);
  console.log(`get_game_config: USERID: ${v.USERID}.`);
  res.json(get_game_config());
});

app.post(`${DYN_PREFIX}/get_player_info.php`, (req, res) => {
  const v = values(req);
  const user = "user" in v ? v.user : null;
  const map = "map" in v ? parseInt(v.map, 10) : null;

  console.log(`get_player_info: USERID: ${v.USERID}. user: ${user}`);

  if (user === null || user === undefined) {
    return res.status(200).json(get_player_info(v.USERID));
  } else if (
    user === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_1 ||
    user === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_2 ||
    user === Constant.NEIGHBOUR_ARTHUR_GUINEVERE_3
  ) {
    return res.status(200).json(get_neighbor_info(user, map));
  } else if (String(user).startsWith("100000")) {
    const { body, status } = get_quest_map(user);
    return res.status(status).json(body);
  } else {
    return res.status(200).json(get_neighbor_info(user, map));
  }
});

app.post(`${DYN_PREFIX}/sync_error_track.php`, (req, res) => {
  const v = values(req);
  console.log(`sync_error_track: USERID: ${v.USERID}. [Error: ${v.error}] tries: ${v.tries}.`);
  res.status(200).send("");
});

app.all("/null", (req, res) => {
  const v = values(req);
  let reason = "";
  if (v.sp_ref_cat === "flash_sync_error") reason = "reload On Sync Error";
  else if (v.sp_ref_cat === "flash_reload_quest") reason = "reload On End Quest";
  else if (v.sp_ref_cat === "flash_reload_attack") reason = "reload On End Attack";
  console.log("flash_sync_error", reason);
  res.redirect("/ruffle.html");
});

app.post(`${DYN_PREFIX}/command.php`, (req, res) => {
  const v = values(req);
  console.log(`command: USERID: ${v.USERID}.`);

  const data_str = v.data;
  if (!data_str || data_str[64] !== ";") {
    return res.status(400).json({ result: "error", reason: "bad data format" });
  }
  const data_payload = data_str.slice(65);
  const data = JSON.parse(data_payload);

  command(v.USERID, data);
  res.status(200).json({ result: "success" });
});

app.all(`${DYN_PREFIX}/get_continent_ranking.php`, (req, res) => {
  res.json({
    world_id: 0,
    continent: [
      { posicion: 0, nivel: 1, user_id: 1111 },
      { posicion: 1, nivel: 0 },
      { posicion: 2, nivel: 0 },
      { posicion: 3, nivel: 0 },
      { posicion: 4, nivel: 0 },
      { posicion: 5, nivel: 0 },
      { posicion: 6, nivel: 0 },
      { posicion: 7, nivel: 0 },
    ],
  });
});

// Express error handler
app.use((err, req, res, next) => {
  console.error(" ! Request error:", err.message);
  if (res.headersSent) return next(err);
  res.status(500).send("Internal server error");
});

//////////
// MAIN //
//////////

async function main() {
  console.log(" [+] Connecting to database...");
  try {
    await db.init();
  } catch (err) {
    console.error("");
    console.error(" [X] Could not connect to MySQL/MariaDB.");
    console.error("     " + err.message);
    console.error("     Check your .env settings (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
    console.error("     If you use a shared host, remote MySQL connections may be blocked.");
    console.error("");
    process.exit(1);
  }

  console.log(" [+] Loading players...");
  await load_saved_villages();

  console.log(" [+] Running server...");
  app.listen(port, host, () => {
    console.log(" [+] Social Empires Server running at http://localhost:" + port + "/");
  });
}

main();
