# Setup — Social Empires (Node.js + MySQL)

The game now uses **accounts (username + password)** and stores **all player data in MySQL/MariaDB**. There are no more JSON save files.

## 1. Requirements

- [Node.js](https://nodejs.org/) v18 or newer.
- A **MySQL** or **MariaDB** database you can connect to.

## 2. Configure the database connection

Open the **`.env`** file at the project root and fill in your database details:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=social_empires
```

- **Local database (recommended for testing):** install something like
  [XAMPP](https://www.apachefriends.org/) or [WAMP](https://www.wampserver.com/),
  start MySQL, and keep the defaults above (`root`, no password). phpMyAdmin
  comes bundled so you can browse the data.
- **Hosted database (cPanel / phpMyAdmin at your host):** copy the values from
  your hosting panel. They usually look like:
  - `DB_HOST` = the MySQL host given by your host (sometimes `localhost`, sometimes a domain/IP)
  - `DB_USER` / `DB_NAME` = often prefixed, e.g. `myaccount_se`
  - `DB_PASSWORD` = the password you set for that MySQL user

> ⚠️ **Heads up about shared hosting:** many shared hosts **block remote MySQL
> connections** — only their own web server may connect. If the game can't
> connect from your PC, go to **"Remote MySQL"** in your hosting panel and add
> your IP address to the allowed list, or run a local database instead.

## 3. Create the tables

You don't have to do anything — **the server creates the database and tables
automatically on first run.**

If you'd rather create them by hand (e.g. on a host where the MySQL user can't
create databases), open **phpMyAdmin → SQL tab** and paste the contents of
[`schema.sql`](schema.sql).

## 4. Install and run

```bash
npm install      # first time only
npm start
```

Then open **http://localhost:3000/** in your browser.

## 5. Play

1. On the home page, **create an account** (username + empire name + password).
   An empire is generated for you automatically.
2. You're taken straight into the game (Ruffle player).
3. Next time, just **log in** with your username and password.
4. Everything you do is saved to MySQL in the `saves` table.

Use **/logout** (the logout link in the game header) to switch accounts.

## Notes

- Passwords are stored as **bcrypt hashes**, never in plaintext.
- One account = one empire.
- The `accounts` table holds login credentials; the `saves` table holds the full
  player document as a JSON column.
