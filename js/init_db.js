//Run to create the sqlite database
const sqlite3 = require('sqlite3');
const user = new sqlite3.Database('user.db');
user.run('CREATE TABLE IF NOT EXISTS user (account TEXT PRIMARY KEY, apikey TEXT)');
user.run('CREATE TABLE IF NOT EXISTS settings (account TEXT PRIMARY KEY, num INTAGER, size INTAGER, autosave INTAGER)');
user.run('CREATE TABLE IF NOT EXISTS dialogue (id INTAGER, account TEXT, name TEXT, seq INTAGER, content TEXT, type TEXT,PRIMARY KEY(id,account,seq))');
user.run('CREATE TABLE IF NOT EXISTS prompt (id INTAGER,account TEXT,content TEXT,PRIMARY KEY(id,account))');
