import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SETTINGS_CODE = process.env.SETTINGS_CODE || '7/9/2010';
const INITIAL_ACCESS_CODE = process.env.INITIAL_ACCESS_CODE || '999001';
const DB_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const DATABASE_URL = process.env.DATABASE_URL || '';

// SPYx NEXORA - Fictional Issuers Ecosystem
const issuers = [
  ['NOVA SHIELD BANK','NS','NOVA ARC','AURORA ELITE'],['VORTEX UNION','VX','VORTEX X','ONYX PRIME'],
  ['ZENITH VAULT','ZV','ZENITH GRID','EMBER CLASS'],['OBSIDIAN BANK','OB','OBSIDIAN LOOP','VOID SIGNATURE'],
  ['AURORA TRUST','AT','AURORA WAVE','VERDE PRIME'],['PHANTOM FINANCE','PF','PHANTOM ARC','GOLD RESERVE'],
  ['ORBITAL BANK','OR','ORBITAL LINK','COSMIC ELITE'],['ECLIPSE TRUST','ET','ECLIPSE RING','CRIMSON BLACK'],
  ['NEON CAPITAL','NC','NEON PULSE','TIDAL PRIME'],['NEXUS BANK','NX','NEXUS CORE','VIOLET ULTRA'],
  ['BHARATN NOVA BANK','BN','BHARATN ARC','NOVA SOVEREIGN']
].map(([name,mark,network,category])=>({name,mark,network,category}));

const luck=['LOW','MEDIUM','HIGH','RARE','ULTRA','EXTREME'];
const security=['LEVEL 01','LEVEL 02','LEVEL 03','LEVEL 04','LEVEL 05'];
const levels=['LEVEL I','LEVEL II','LEVEL III','LEVEL IV','LEVEL V','LEVEL VI'];
const holders=['ALEX RAY','RYAN CROSS','MAX NOVA','KAI STORM','JAY VOID','NOAH FLUX','ZANE ROY','LEO NIGHT','ARON X','SAM VEX','RAVI NOVA','ARIN VALE','KIRA VOSS','DEV RAY','NOVA KAI'];

const rand=(min,max)=>crypto.randomInt(min,max+1);
const pick=a=>a[rand(0,a.length-1)];
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const newId=()=>crypto.randomBytes(24).toString('hex');

function makeCard(issuer){
  const initialBalance = rand(2000, 9999);
  return {
    issuerName: issuer.name,
    number: `CV-${rand(1000,9999)} ${rand(1000,9999)} ${rand(1000,9999)}`,
    holder: pick(holders),
    expiry: `${String(rand(1,12)).padStart(2,'0')}/${String(rand(2029,2036)).slice(-2)}`,
    id: `GV-${rand(100000,999999)}-${rand(10,99)}`,
    level: pick(levels),
    security: pick(security),
    luck: pick(luck),
    power: rand(5,99),
    balance: initialBalance,
    pin: String(rand(1000,9999)),
    status: 'ACTIVE • GAME ONLY',
    year: 2026,
    validity: '5 GAME YEARS',
    transactions: [
      { id: `TX-${rand(1000,9999)}`, type: 'WELCOME_BONUS', amount: initialBalance, timestamp: new Date().toISOString() }
    ]
  };
}

let pg=null;
let db={passwordHash:hash(INITIAL_ACCESS_CODE),sessions:{}};
if(!DATABASE_URL){
  try{db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{}
  if(!db.passwordHash)db.passwordHash=hash(INITIAL_ACCESS_CODE);
  if(!db.sessions)db.sessions={};
}
function saveFile(){if(!DATABASE_URL)fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));}

async function initDb(){
  if(!DATABASE_URL)return;
  const mod=await import('pg');
  pg=new mod.default.Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false}});
  await pg.query(`CREATE TABLE IF NOT EXISTS vault_settings (id INTEGER PRIMARY KEY, password_hash TEXT NOT NULL);`);
  await pg.query(`CREATE TABLE IF NOT EXISTS vault_sessions (session_id TEXT PRIMARY KEY, logged_in BOOLEAN NOT NULL DEFAULT FALSE, card_json TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await pg.query(`INSERT INTO vault_settings (id,password_hash) VALUES (1,$1) ON CONFLICT (id) DO NOTHING`,[hash(INITIAL_ACCESS_CODE)]);
}

async function getPasswordHash(){if(!pg)return db.passwordHash;const r=await pg.query('SELECT password_hash FROM vault_settings WHERE id=1');return r.rows[0].password_hash;}
async function setPasswordHash(v){if(!pg){db.passwordHash=v;saveFile();return;}await pg.query('UPDATE vault_settings SET password_hash=$1 WHERE id=1',[v]);}
async function getSession(id){if(!pg){if(!db.sessions[id])db.sessions[id]={loggedIn:false,card:null};return db.sessions[id];}const r=await pg.query('SELECT logged_in,card_json FROM vault_sessions WHERE session_id=$1',[id]);if(!r.rows[0]){await pg.query('INSERT INTO vault_sessions(session_id,logged_in,card_json) VALUES($1,FALSE,NULL)',[id]);return {loggedIn:false,card:null}}return {loggedIn:r.rows[0].logged_in,card:r.rows[0].card_json?JSON.parse(r.rows[0].card_json):null};}
async function saveSession(id,s){if(!pg){db.sessions[id]=s;saveFile();return;}await pg.query(`INSERT INTO vault_sessions(session_id,logged_in,card_json,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(session_id) DO UPDATE SET logged_in=EXCLUDED.logged_in,card_json=EXCLUDED.card_json,updated_at=NOW()`,[id,s.loggedIn,JSON.stringify(s.card)]);}
function sessionId(req,res){let id=req.cookies.vault_session;if(!id){id=newId();res.cookie('vault_session',id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:31536000000});}return id;}

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'20kb'}));
app.use(cookieParser());

app.get('/api/session',async(req,res)=>{
  try{const id=sessionId(req,res),s=await getSession(id);res.json({loggedIn:!!s.loggedIn,cardLocked:!!s.card,card:s.card||null});}
  catch(e){res.status(500).json({error:'SERVER ERROR'})}
});

app.post('/api/login',async(req,res)=>{
  try{const password=String(req.body?.password||''),expected=await getPasswordHash();if(hash(password)!==expected)return res.status(401).json({error:'ACCESS DENIED'});const id=sessionId(req,res),s=await getSession(id);s.loggedIn=true;s.card=null;await saveSession(id,s);res.json({loggedIn:true,cardLocked:false,card:null});}
  catch(e){res.status(500).json({error:'SERVER ERROR'})}
});

app.post('/api/settings/verify',(req,res)=>{if(String(req.body?.settingsPass||'')!==SETTINGS_CODE)return res.status(403).json({error:'WRONG SETTINGS PASSCODE'});res.json({ok:true});});

app.post('/api/settings/change',async(req,res)=>{
  try{const newPass=String(req.body?.newPass||'').trim();if(newPass.length<4)return res.status(400).json({error:'PASSCODE MUST HAVE AT LEAST 4 CHARACTERS'});await setPasswordHash(hash(newPass));res.json({ok:true});}
  catch(e){res.status(500).json({error:'COULD NOT UPDATE SHARED PASSCODE'})}
});

app.post('/api/card/open',async(req,res)=>{
  try{const id=sessionId(req,res),s=await getSession(id);if(!s.loggedIn)return res.status(401).json({error:'LOGIN REQUIRED'});if(s.card)return res.status(409).json({error:'CARD ALREADY CHOSEN — SESSION LOCKED',loggedIn:true,cardLocked:true,card:s.card});const issuer=issuers.find(x=>x.name===String(req.body?.issuer||''));if(!issuer)return res.status(400).json({error:'INVALID CARD'});s.card=makeCard(issuer);await saveSession(id,s);res.json({loggedIn:true,cardLocked:true,card:s.card});}
  catch(e){res.status(500).json({error:'COULD NOT OPEN CARD'})}
});

app.get('*',(req,res)=>{
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="theme-color" content="#02050a"><title>SPYx NEXORA — CARD VAULT</title><style>body{min-height:100vh;background:#02050a;color:#fff;font-family:system-ui,Arial,sans-serif;margin:0}main{max-width:900px;margin:auto;padding:30px 18px}h1{color:#00eaff}pre{white-space:pre-wrap;color:#9db0c9}</style></head><body><main><h1>SPYx NEXORA — CARD VAULT</h1><p>Frontend is embedded in this server build.</p><pre>Use the API routes documented in README.md.</pre></main></body></html>`);
});

initDb().then(()=>app.listen(PORT,()=>console.log(`SPYx NEXORA CARD VAULT running on port ${PORT}`))).catch(e=>{console.error('Database startup failed:',e);process.exit(1)});
