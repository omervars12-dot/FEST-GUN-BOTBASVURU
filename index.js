try { require('dotenv').config(); } catch {}
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, MessageFlags,
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('TOKEN (ya da DISCORD_TOKEN) değişkeni tanımlı değil!'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers, // GİRİŞ LOGU İÇİN ŞART
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ======================
// AYARLAR VE KANAL/ROL ID'LERİ
// ======================
const AC_LOG_CHANNEL_ID = '1546239467033989210';       // AC Başvuru Log Kanalı
const YETKILI_LOG_CHANNEL_ID = '1546240461822361710';  // Yetkili Log Kanalı
const WELCOME_CHANNEL_ID = '1542872463870922814';      // Hoş Geldin Mesajının Düşeceği Kanal ID'si

const ROL_1 = '1542872121833820322';                   // AC için etiketlenecek 1. rol
const ROL_2 = '1542872252045856879';                   // Yetkili için etiketlenecek rol (başvuruları bu rol sonuçlandırır)
const UNREGISTERED_ROLE_ID = '1542872121833820322';    // Girene otomatik verilecek Kayıtsız rolü

const TARGET_VOICE_CHANNEL_ID = '1542872463870922814'; // 7/24 duracağı ses kanalı
const TARGET_IMAGE = 'https://cdn.discordapp.com/attachments/1542872935809814688/1543803508547915786/ChatGPT_Image_31_Agu_2026_05_01_30.png?ex=6a9ec44e&is=6a9d72ce&hm=1a1a3cd5515ea1d43d8d89a44c16ff71702398ef3da14e341032e7c8144ecc37&';

const MIN_YAS = { ac: 12, staff: 12 };                 // en düşük yaş
const BEKLEME_SAAT = { red: 24, bekliyor: 48 };        // reddedilince / sonuçsuz kalınca tekrar başvuru süresi

// ======================
// KALICI KAYIT (Railway'de Volume bağlarsan DATA_DIR=/data yap)
// ======================
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const DB_FILE = path.join(DATA_DIR, 'basvuru-db.json');
let db = { durum: {}, gecmis: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch {}
function kaydet() {
  try { fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); }
  catch (e) { console.error('DB yazılamadı:', e.message); }
}
const formAcilis = new Map(); // forma basıldığı an (form doldurma süresi için)

// ================================================================
// 🤖 BAŞVURU ANALİZ MOTORU
// ================================================================
// <<ANALIZ BASLA>>
const TR_HARITA = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
const ascii = (t = '') => String(t).toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (c) => TR_HARITA[c]);
const norm = (t = '') => ascii(t).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const kelimeler = (t) => { const n = norm(t); return n ? n.split(' ') : []; };
const kisalt = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// ---- Küfür / hakaret (ı harfi korunur: "sıkıntı", "sıktım" gibi normal kelimeler yakalanmaz)
const kufurNorm = (t) => String(t).toLocaleLowerCase('tr-TR')
  .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
  .replace(/@/g, 'a').replace(/\$/g, 's')
  .replace(/(.)\1+/g, '$1');
const KUFUR_TAM = new Set(['oç', 'oc', 'amk', 'aq', 'amq', 'piç', 'puşt', 'sik', 'göt'].map(kufurNorm));
const KUFUR_KOK = ['sikt', 'sikey', 'siker', 'sikik', 'sikiş', 'sikm', 'amına', 'amina', 'amınak', 'aminak', 'amcık', 'amcik', 'amcı',
  'orospu', 'oruspu', 'yarrak', 'yarak', 'pezevenk', 'ibne', 'gavat', 'kahpe', 'godoş', 'godos', 'götveren', 'götünü', 'gotunu',
  'piçlik', 'piçler'].map(kufurNorm);
const KUFUR_UZUN = ['siktir', 'sikeyim', 'orospu', 'oruspu', 'amınakoy', 'aminakoy', 'amınakod', 'aminakod', 'pezevenk'].map(kufurNorm);
const KUFUR_YUMUSAK = new Set(['mal', 'salak', 'gerizekalı', 'aptal', 'enayi', 'angut', 'dangalak', 'beyinsiz', 'ezik', 'anan', 'baban'].map(kufurNorm));

function kufurTara(text) {
  const n = kufurNorm(text);
  const tokens = n.split(/[^a-zı]+/).filter(Boolean);
  let sert = false; const yumusak = new Set();
  for (const t of tokens) {
    if (KUFUR_TAM.has(t) || KUFUR_KOK.some((k) => t.startsWith(k))) sert = true;
    else if (KUFUR_YUMUSAK.has(t)) yumusak.add(t);
  }
  if (!sert) { const b = n.replace(/[^a-zı]/g, ''); if (KUFUR_UZUN.some((k) => b.includes(k))) sert = true; }
  return { sert, yumusak: [...yumusak] };
}

// ---- Hile itirafı / sisteme zarar verme niyeti (hile "tespit" etmek normaldir, hile "kullanmak" değil)
const ITIRAF = [
  /\b(hile|cheat|hack|bypass|inject|aimbot|wallhack|esp)\w*\s+(kullan|yap|at|sat)(iyor|tim|dim|irim|arim|acagim|iyom|mistim|irdim|ardim)/,
  /\bhileci(yim|yiz)?\b/,
  /\b(bypass|by pass)\s+(etmek|edecegim|ederim|icin|etmeye)/,
  /\b(ac|anticheat|anti cheat|sistem)\w*\s+(bypass|by pass|atlat|kandir)/,
  /\bban\s+(yemeden|yemem|yemiyorum)/,
  /\b(denemek|test etmek|bakmak)\s+icin\s+(basvur|girdim|geldim)/,
  /\bsadece\s+(denemek|test|bakmak)\b/,
];
function guvenlikRiski(text) {
  const t = ascii(text).replace(/\s+/g, ' ');
  return ITIRAF.some((r) => r.test(t));
}

// ---- Anlamsız yazı / klavye ezme
const KLAVYE = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'qazwsxedc', 'poiuytrewq', 'lkjhgfdsa', 'mnbvcxz'];
const KLAVYE_PARCA = (() => { const s = new Set(); for (const r of KLAVYE) for (let i = 0; i + 4 <= r.length; i++) s.add(r.slice(i, i + 4)); return s; })();
function anlamsizToken(w) {
  if (w.length < 3) return false;
  if (['qwe', 'asd', 'zxc', 'qaz', 'wasd', 'abc'].includes(w)) return true;
  if (/^(.{1,3})\1{2,}$/.test(w)) return true;
  if (/(.)\1{3,}/.test(w)) return true;
  if (w.length >= 4 && !/[aeiou]/.test(w)) return true;
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/.test(w)) return true;
  for (let i = 0; i + 4 <= w.length; i++) if (KLAVYE_PARCA.has(w.slice(i, i + 4))) return true;
  return false;
}
function anlamsizOrani(raw) {
  const w = kelimeler(raw);
  if (!w.length) return 0;
  if (w.length >= 2 && new Set(w).size === 1) return 1;
  return w.filter(anlamsizToken).length / w.length;
}

// ---- Cevap türü
const TROLL_TAM = new Set(['ne', 'yok', 'bos', 'bilmiyorum', 'bilmiyom', 'bilmem', 'farketmez', 'deneme', 'test', 'selam', 'merhaba', 'lol', 'xd', 'hmm',
  'keyfim', 'sanane', 'sana ne', 'oylesine', 'eglence', 'ne biliyim', 'ne bileyim', 'cunku', 'istiyorum', 'bos ver', 'nolur', 'tamam', 'evet', 'hayir', 'abc']);
const TROLL_IFADE = ['keyfim', 'sanane', 'sana ne', 'seni ilgilendirmez', 'ne biliyim', 'ne bileyim', 'oylesine', 'eglence', 'eglencesine', 'takilmaca',
  'zaman gecirmek', 'canim sikildi', 'bos ver', 'farketmez', 'deneme', 'denemek icin', 'test etmek icin'];
const TAVIR_IFADE = ['sanane', 'sana ne', 'seni ilgilendirmez', 'keyfim', 'bos ver'];
const GECMIS_YOK_OK = new Set(['yok', 'hayir', 'olmadim', 'hic olmadim', 'ilk defa', 'ilk', 'deneyimim yok', 'tecrubem yok', 'hayir olmadim', 'hayir yok', 'hayir hic olmadim']);
function cevapTuru(raw, { gecmisAlani = false } = {}) {
  const n = norm(raw); const w = n ? n.split(' ') : [];
  if (!w.length) return 'bos';
  if (gecmisAlani && GECMIS_YOK_OK.has(n)) return 'durust-yok';
  if (anlamsizOrani(raw) >= 0.5) return 'anlamsiz';
  if (w.length >= 6 && new Set(w).size / w.length < 0.4) return 'anlamsiz'; // aynı kelimeleri tekrarlayan yazı
  if (TROLL_TAM.has(n)) return 'troll';
  if (w.length <= 5 && TROLL_IFADE.some((p) => ` ${n} `.includes(` ${p} `))) return 'troll';
  return 'normal';
}

// ---- Konu bilgisi sözlükleri (kelime başı eşleşir: "hileleri", "kanıtlar" da sayılır)
const ALAN_KELIME = {
  ac: {
    guclu: ['aimbot', 'esp', 'wallhack', 'triggerbot', 'noclip', 'godmode', 'speedhack', 'silent aim', 'recoil', 'screenshare', 'screen share', 'ss', 'ekran paylasim', 'ekran goruntu', 'obs',
      'replay', 'txadmin', 'kanit', 'tespit', 'executor', 'inject', 'mod menu', 'klip', 'kayit', 'anormal', 'tutarsiz', 'anticheat', 'anti cheat', 'fivem', 'log', 'delil', 'process'],
    genel: ['hile', 'cheat', 'hack', 'oyuncu', 'supheli', 'inceleme', 'rapor', 'sikayet', 'ban', 'video', 'discord', 'script', 'menu', 'kontrol', 'bildir', 'yetkili', 'kural', 'dosya', 'ac', 'bypass', 'sunucu'],
  },
  staff: {
    guclu: ['moderasyon', 'moderator', 'ticket', 'sikayet', 'ceza', 'uyari', 'mute', 'kick', 'roleplay', 'rp', 'kural', 'kanit', 'log', 'arabulucu', 'tarafsiz', 'adil', 'sabir', 'iletisim', 'destek', 'cozum', 'inceleme', 'rapor', 'yetki', 'delil'],
    genel: ['yetkili', 'oyuncu', 'ekip', 'sorumluluk', 'deneyim', 'tecrube', 'aktif', 'aktiflik', 'saat', 'sunucu', 'discord', 'yardim', 'duzen', 'topluluk', 'ban', 'kontrol', 'bildir', 'fivem'],
  },
};
function kelimeVarMi(kw, tokens, padded) {
  if (kw.includes(' ')) return padded.includes(` ${kw}`);
  if (kw.length <= 3) return tokens.includes(kw);
  return tokens.some((t) => t.startsWith(kw));
}
function alanPuani(tip, metin) {
  const tokens = kelimeler(metin); const padded = ` ${tokens.join(' ')} `;
  const d = ALAN_KELIME[tip]; const guclu = [], genel = [];
  for (const k of d.guclu) if (kelimeVarMi(k, tokens, padded)) guclu.push(k);
  for (const k of d.genel) if (kelimeVarMi(k, tokens, padded)) genel.push(k);
  return { agirlikli: guclu.length * 2 + genel.length, guclu, genel };
}

// ---- Senaryo cevabının yapısı (sıra + eylem)
const SIRA = ['once', 'ilk olarak', 'ilk', 'sonra', 'daha sonra', 'ardindan', 'en son', 'son olarak', 'ikinci', 'ucuncu', 'birinci', 'adim'];
const EYLEM = ['incele', 'kontrol', 'kanit', 'ss', 'screenshare', 'kayit', 'kaydet', 'uyar', 'banla', 'ban', 'bildir', 'ticket', 'dinle', 'sakin', 'tarafsiz', 'arastir', 'logla',
  'rapor', 'yetkili', 'ekran', 'video', 'izle', 'sor', 'karar', 'ceza', 'mute', 'kick', 'cozum', 'ayir', 'sustur', 'yonlendir', 'delil', 'tespit', 'ilet'];
function senaryoYapisi(raw) {
  const tokens = kelimeler(raw); const padded = ` ${tokens.join(' ')} `;
  const eylem = EYLEM.filter((k) => (k.length <= 3 ? tokens.includes(k) : tokens.some((t) => t.startsWith(k)))).length;
  const sira = SIRA.filter((k) => (k.includes(' ') ? padded.includes(` ${k} `) : tokens.includes(k))).length;
  return { eylem, sira, skor: Math.min(1, eylem / 5) * 0.7 + Math.min(1, sira / 2) * 0.3 };
}

// ---- Detay (süre, sayı, noktalama, özel isim)
function detayPuani(raw) {
  let p = 0;
  if (/\d+\s*(yil|yıl|ay|hafta|gun|gün|saat|sa\b|dk|dakika|sene)/i.test(raw)) p += 0.4; else if (/\d/.test(raw)) p += 0.2;
  const buyuk = (String(raw).match(/(?<=[a-zçğıöşü0-9,;]\s)[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}/g) || []).length;
  if (buyuk >= 1) p += 0.2; if (buyuk >= 3) p += 0.1;
  if ((String(raw).match(/[.!?]/g) || []).length >= 2) p += 0.2;
  if (/[,;]/.test(raw)) p += 0.1;
  return Math.min(1, p);
}

function cevapKalitesi(raw, hedef) {
  const w = kelimeler(raw); const n = w.length;
  if (!n) return 0;
  const lenScore = Math.min(1, n / hedef);
  const uniq = n >= 5 ? new Set(w).size / n : 1;
  const divScore = Math.min(1, uniq / 0.7);
  const avgLen = w.reduce((a, b) => a + b.length, 0) / n;
  const avgScore = Math.min(1, avgLen / 3.5);
  let q = 0.55 * lenScore + 0.15 * divScore + 0.1 * avgScore + 0.2 * detayPuani(raw);
  q *= 1 - anlamsizOrani(raw);
  const harfler = String(raw).replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (harfler.length >= 15 && harfler.replace(/[^A-ZÇĞİÖŞÜ]/g, '').length / harfler.length > 0.8) q *= 0.7;
  return Math.max(0, Math.min(1, q));
}

// ---- Aktiflik cevabı
function aktiflikAnaliz(raw) {
  const t = ascii(raw);
  const abartili = /7\s*\/\s*24|24\s*saat|surekli|her an\b|her zaman|haftanin 7 gunu/.test(t);
  const saat = /(\d{1,2})(?:\s*-\s*\d{1,2})?\s*(saat|sa\b)/.test(t);
  const zaman = /(sabah|oglen|aksam|gece|\d{1,2}\s*[:.]\s*\d{2}|hafta ici|hafta sonu|her gun|gunde|haftada)/.test(t);
  const gun = /\d\s*gun/.test(t);
  return { abartili, saat, zaman, q: Math.min(1, (saat ? 0.6 : 0) + (zaman ? 0.3 : 0) + (gun ? 0.1 : 0)) };
}

// ---- Form alanları
const ALANLAR = {
  ac: [
    { id: 'deneyim', etiket: 'AC / Hile Tespit Bilgisi', hedef: 25, agirlik: 1.0, konu: true },
    { id: 'senaryo', etiket: 'Hile Şüphesi Senaryosu', hedef: 30, agirlik: 1.4, konu: true, senaryo: true },
    { id: 'aktiflik', etiket: 'Aktiflik', hedef: 6, agirlik: 0.5, aktiflik: true },
    { id: 'ekstra', etiket: 'Ekstra', hedef: 10, agirlik: 0.3, konu: true, opsiyonel: true },
  ],
  staff: [
    { id: 'gecmis', etiket: 'Geçmiş Yetkililik', hedef: 12, agirlik: 0.6, konu: true, gecmisAlani: true },
    { id: 'neden', etiket: 'Neden Seçmeliyiz?', hedef: 25, agirlik: 1.0, konu: true },
    { id: 'senaryo', etiket: 'Kavga / Şikayet Senaryosu', hedef: 30, agirlik: 1.4, konu: true, senaryo: true },
    { id: 'aktiflik', etiket: 'Aktiflik', hedef: 6, agirlik: 0.5, aktiflik: true },
  ],
};

function yasAyikla(adyas) {
  const nums = (String(adyas).match(/\d{1,3}/g) || []).map(Number).filter((x) => x >= 5 && x <= 99);
  const yas = nums.length ? nums[0] : null;
  const ad = String(adyas).replace(/\d+/g, '').replace(/[,\-\/|]+/g, ' ').replace(/yas(inda(yim)?)?/i, '').replace(/\s+/g, ' ').trim();
  return { yas, ad: ad || adyas };
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let k = 0; for (const w of a) if (b.has(w)) k++;
  return k / (a.size + b.size - k);
}
const kelimeSeti = (t) => new Set(kelimeler(t).filter((w) => w.length >= 4));

function benzerlikBul(set, gecmis, kullaniciId) {
  if (set.size < 8) return null;
  let en = null;
  for (const g of gecmis) {
    const oran = jaccard(set, new Set(g.kelimeler));
    if (!en || oran > en.oran) en = { oran, user: g.user, tip: g.tip, ayni: g.user === kullaniciId };
  }
  return en;
}

function seviyeBelirle(p) {
  if (p >= 80) return { seviye: '⭐ Mükemmel Aday', oneri: '✅ Mülakata öncelikli al', renk: 0x2ecc71 };
  if (p >= 65) return { seviye: '🟢 Güçlü Aday', oneri: '✅ Mülakata alınabilir', renk: 0x57f287 };
  if (p >= 50) return { seviye: '🟡 Orta Aday', oneri: '🔎 Dikkatli incele', renk: 0xf1c40f };
  if (p >= 30) return { seviye: '🟠 Zayıf Başvuru', oneri: '⚠️ Reddetmeye yakın', renk: 0xe67e22 };
  return { seviye: '🔴 Düşük / Riskli Başvuru', oneri: '❌ Reddet önerilir', renk: 0xe74c3c };
}

function basvuruAnaliz({ tip, adyas, cevap, uye, doldurmaSn, gecmis = [], kullaniciId }) {
  const alanlar = ALANLAR[tip];
  const olumlu = [], olumsuz = [], risk = [];
  const tumMetin = [adyas, ...alanlar.map((a) => cevap[a.id] || '')].join(' \n ');
  const { yas, ad } = yasAyikla(adyas);
  let ozel = null; // otomatik red sebebi

  // 1) Küfür / hakaret
  const kf = kufurTara(tumMetin);
  if (kf.sert) { ozel = { seviye: '🚨 Küfür / Hakaret Tespit Edildi', oneri: '❌ Reddet önerilir', renk: 0xff0000 }; risk.push('🤬 Başvuruda küfür / ağır hakaret var.'); }
  else if (kf.yumusak.length) risk.push(`😠 Kaba / hakaret içeren kelime: \`${kf.yumusak.join('`, `')}\``);

  // 2) Güvenlik riski
  if (guvenlikRiski(tumMetin)) {
    if (!ozel) ozel = { seviye: '🚨 Güvenlik Riski / Hile İtirafı', oneri: '❌ Reddet ve kullanıcıyı izle', renk: 0xff0000 };
    risk.push('🚨 Hile kullanma / sistemi aşma niyeti ifadesi tespit edildi.');
  }

  // 3) Cevap kalitesi
  let topA = 0, topQ = 0, trollSay = 0, anlamsizSay = 0, bosSay = 0, toplamKelime = 0;
  const turler = {};
  for (const a of alanlar) {
    const ham = cevap[a.id] || '';
    if (a.opsiyonel && !ham.trim()) continue;
    const tur = cevapTuru(ham, { gecmisAlani: a.gecmisAlani });
    turler[a.id] = tur;
    toplamKelime += kelimeler(ham).length;
    let q;
    if (tur === 'bos') { q = 0; bosSay++; risk.push(`⬜ **${a.etiket}** boş bırakılmış.`); }
    else if (tur === 'troll') { q = 0; trollSay++; risk.push(`🤡 **${a.etiket}** cevabı ciddiyetsiz.`); }
    else if (tur === 'anlamsiz') { q = 0; anlamsizSay++; risk.push(`⌨️ **${a.etiket}** cevabı anlamsız (klavye ezmesi ya da aynı kelimelerin tekrarı).`); }
    else if (tur === 'durust-yok') { q = 0.5; olumlu.push('Önceki yetkililik konusunda dürüst ve net cevap.'); }
    else if (a.aktiflik) {
      const ak = aktiflikAnaliz(ham); q = ak.q || Math.min(1, kelimeler(ham).length / a.hedef) * 0.5;
      if (ak.abartili) { q *= 0.6; olumsuz.push('Aktiflik iddiası abartılı ("7/24", "sürekli" gibi).'); }
      else if (ak.saat && ak.zaman) olumlu.push('Aktiflik saatlerini net belirtmiş.');
    } else {
      q = cevapKalitesi(ham, a.hedef);
      const kelime = kelimeler(ham).length;
      if (kelime < 4) olumsuz.push(`**${a.etiket}** cevabı çok kısa.`);
      else if (q >= 0.8 && a.senaryo) olumlu.push('Senaryo cevabı detaylı ve düzenli.');
      else if (q >= 0.8) olumlu.push(`**${a.etiket}** cevabı yeterince detaylı.`);
      else if (q < 0.4 && a.senaryo) olumsuz.push('Senaryo cevabı yüzeysel.');
    }
    topQ += q * a.agirlik; topA += a.agirlik;
  }
  const icerik = 35 * (topA ? topQ / topA : 0);

  // 4) Konu bilgisi
  const konuMetin = alanlar.filter((a) => a.konu && !['troll', 'anlamsiz', 'bos'].includes(turler[a.id])).map((a) => cevap[a.id] || '').join(' ');
  const ap = alanPuani(tip, konuMetin);
  const sen = alanlar.find((a) => a.senaryo);
  const senTur = turler[sen.id];
  const yapi = senTur === 'normal' ? senaryoYapisi(cevap[sen.id]) : { eylem: 0, sira: 0, skor: 0 };
  const konu = Math.min(1, ap.agirlikli / 14) * 17 + yapi.skor * 8;
  if (ap.guclu.length >= 4) olumlu.push(`Konuya hakim: ${ap.guclu.slice(0, 5).map((x) => `\`${x}\``).join(', ')} gibi terimleri kullanmış.`);
  else if (ap.agirlikli <= 1 && senTur !== 'bos') olumsuz.push('Konuyla ilgili teknik / somut bilgi neredeyse yok.');
  if (yapi.skor >= 0.7) olumlu.push('Senaryoda adım adım ve doğru bir yöntem izlemiş.');
  else if (senTur === 'normal' && yapi.skor < 0.3) olumsuz.push('Senaryoda net bir yöntem / adım yok.');

  // 5) Yaş
  let yasP = 0, yasCap = false;
  if (yas == null) risk.push('🎂 Yaş okunamadı (sayı yazılmamış).');
  else if (yas < MIN_YAS[tip]) { yasCap = true; risk.push(`🎂 Yaş yetersiz: **${yas}** (en az ${MIN_YAS[tip]} olmalı).`); }
  else {
    yasP = yas >= 18 ? 15 : yas >= 16 ? 13 : yas >= 14 ? 10 : 6;
    if (yas > 60) { yasP = 5; risk.push(`🎂 Yaş alışılmadık: **${yas}**.`); }
    else if (yas >= 18) olumlu.push(`Yaş uygun (${yas}).`);
  }

  // 6) Güven (hesap, sunucudaki süre, form hızı)
  let guven = 0;
  const hg = uye.hesapGun;
  if (hg < 3) { guven -= 6; risk.push(`🆕 Hesap çok yeni (**${Math.floor(hg)} gün**) — alt hesap olabilir.`); }
  else if (hg < 7) { guven += 0; olumsuz.push(`Hesap yeni (${Math.floor(hg)} gün).`); }
  else if (hg < 30) guven += 2; else if (hg < 90) guven += 4; else if (hg < 365) guven += 6; else { guven += 8; olumlu.push('Hesap eski ve köklü.'); }
  const kg = uye.katilimGun;
  if (kg == null) guven += 2;
  else if (kg < 1 / 24) { olumsuz.push('Sunucuya 1 saatten kısa süre önce katılmış.'); }
  else if (kg < 1) guven += 1; else if (kg < 7) guven += 3; else if (kg < 30) guven += 5; else { guven += 7; olumlu.push('Sunucunun uzun süredir üyesi.'); }
  if (doldurmaSn != null && doldurmaSn < 12 && toplamKelime >= 40) { guven -= 5; risk.push(`⚡ Form **${doldurmaSn} sn**de dolduruldu — hazır metin yapıştırılmış olabilir.`); }
  guven = Math.max(0, Math.min(15, guven));

  // 7) Özgünlük (kopya kontrolü)
  let ozgun = 10;
  const serbest = alanlar.filter((a) => !a.aktiflik && (cevap[a.id] || '').trim());
  const set = kelimeSeti(serbest.map((a) => cevap[a.id]).join(' '));
  const benzer = benzerlikBul(set, gecmis, kullaniciId);
  if (benzer && !benzer.ayni && benzer.oran >= 0.8) { ozgun = 0; risk.push(`📋 Başka bir başvuruyla **%${Math.round(benzer.oran * 100)}** aynı — kopya! (<@${benzer.user}>)`); }
  else if (benzer && !benzer.ayni && benzer.oran >= 0.55) { ozgun = 4; risk.push(`📋 <@${benzer.user}> başvurusuyla **%${Math.round(benzer.oran * 100)}** benzer (kopya olabilir).`); }
  else if (benzer && benzer.ayni && benzer.oran >= 0.8) { ozgun = 5; olumsuz.push('Önceki başvurusuyla neredeyse aynı metni göndermiş.'); }
  for (let x = 0; x < serbest.length; x++) for (let y = x + 1; y < serbest.length; y++) {
    const A = kelimeSeti(cevap[serbest[x].id]), B = kelimeSeti(cevap[serbest[y].id]);
    if (A.size >= 6 && B.size >= 6 && jaccard(A, B) >= 0.7) { ozgun = Math.min(ozgun, 4); olumsuz.push(`**${serbest[x].etiket}** ile **${serbest[y].etiket}** cevapları neredeyse aynı.`); }
  }
  if (ozgun >= 10 && toplamKelime >= 30) olumlu.push('Cevaplar özgün görünüyor.');

  // Toplam + üst sınırlar
  let puan = icerik + konu + yasP + guven + ozgun;
  if (kf.yumusak.length) puan -= Math.min(20, kf.yumusak.length * 10);
  if (TAVIR_IFADE.some((p) => ` ${norm(tumMetin)} `.includes(` ${p} `)) && trollSay === 0) { puan -= 10; risk.push('😒 Saygısız / umursamaz ifade kullanmış.'); }
  const cevapSayisi = alanlar.filter((a) => !a.opsiyonel || (cevap[a.id] || '').trim()).length;
  if (trollSay + anlamsizSay + bosSay >= Math.ceil(cevapSayisi / 2)) { puan = Math.min(puan, 12); if (!ozel) ozel = { seviye: '🤡 Troll / Ciddiyetsiz Başvuru', oneri: '❌ Reddet önerilir', renk: 0xe74c3c }; }
  else if (trollSay + anlamsizSay >= 1) puan = Math.min(puan, 45);
  if (yasCap) { puan = Math.min(puan, 20); if (!ozel) ozel = { seviye: '🔞 Yaş Sınırı Altında', oneri: '❌ Reddet önerilir', renk: 0xe74c3c }; }
  if (ozgun === 0) { puan = Math.min(puan, 25); if (!ozel) ozel = { seviye: '📋 Kopya Başvuru', oneri: '❌ Reddet önerilir', renk: 0xe74c3c }; }
  if (kf.sert || (ozel && ozel.seviye.includes('Güvenlik'))) puan = 0;
  puan = Math.max(0, Math.min(100, Math.round(puan)));

  const sv = ozel || seviyeBelirle(puan);
  return {
    puan, yas, ad, seviye: sv.seviye, oneri: sv.oneri, renk: sv.renk,
    kirilim: { icerik: Math.round(icerik), konu: Math.round(konu), yas: yasP, guven, ozgun },
    olumlu: [...new Set(olumlu)], olumsuz: [...new Set(olumsuz)], risk,
    kelimeler: [...set].slice(0, 150),
  };
}
// <<ANALIZ BITIS>>

// ================================================================
// BAŞVURU AKIŞI
// ================================================================
function basvuruEngeli(userId, tip) {
  const d = db.durum[`${tip}:${userId}`];
  if (!d) return null;
  const saat = (Date.now() - d.t) / 3600e3;
  if (d.durum === 'onay') return '✅ Başvurun daha önce onaylandı.';
  if (d.durum === 'bekliyor' && saat < BEKLEME_SAAT.bekliyor) return '⏳ Zaten bekleyen bir başvurun var. Yetkililer inceleyecek.';
  if (d.durum === 'red' && saat < BEKLEME_SAAT.red) return `⏳ Reddedilen başvurundan sonra **${Math.ceil(BEKLEME_SAAT.red - saat)} saat** beklemen gerekiyor.`;
  return null;
}

const alan = (id, label, stil, o = {}) => new ActionRowBuilder().addComponents(
  new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(stil).setRequired(o.zorunlu !== false)
    .setMaxLength(o.max || 900).setPlaceholder(o.ph || ''),
);
function formModal(tip) {
  const S = TextInputStyle.Short, P = TextInputStyle.Paragraph;
  if (tip === 'ac') {
    return new ModalBuilder().setCustomId('modal_ac').setTitle('🛡️ AntiCheat Başvuru Formu').addComponents(
      alan('ac_adyas', 'Adınız ve yaşınız?', S, { max: 60, ph: 'Örn: Mehmet, 17' }),
      alan('ac_deneyim', 'Hile tespiti / AC bilginiz ve tecrübeniz?', P, { ph: 'Hangi hileleri tanıyorsun, nerede ve ne kadar süre çalıştın?' }),
      alan('ac_senaryo', 'Hile şüphesinde adım adım ne yaparsın?', P, { ph: 'Bir oyuncudan hile şüphesi var. Ne yaparsın?' }),
      alan('ac_aktiflik', 'Haftalık aktiflik (gün / saat)?', S, { max: 150, ph: 'Örn: Her akşam 19:00 sonrası 3-4 saat' }),
      alan('ac_ekstra', 'Eklemek istediğiniz özel durum?', P, { zorunlu: false }),
    );
  }
  return new ModalBuilder().setCustomId('modal_staff').setTitle('👑 Yetkili Başvuru Formu').addComponents(
    alan('staff_adyas', 'Adınız ve yaşınız?', S, { max: 60, ph: 'Örn: Mehmet, 17' }),
    alan('staff_gecmis', 'Önceden yetkili oldunuz mu? Nerede?', P, { ph: 'Hangi sunucuda, hangi konumdaydınız? Yoksa "yok" yazabilirsin.' }),
    alan('staff_neden', 'Neden sizi seçmeliyiz?', P),
    alan('staff_senaryo', 'İki oyuncu kavga etse ne yaparsın?', P, { ph: 'Ticket / ses kanalında kavga çıktı, adım adım ne yaparsın?' }),
    alan('staff_aktiflik', 'Haftalık aktiflik (gün / saat)?', S, { max: 150, ph: 'Örn: Hafta içi 2 saat, hafta sonu 5 saat' }),
  );
}

const barCiz = (p) => '█'.repeat(Math.round(p / 10)) + '░'.repeat(10 - Math.round(p / 10));
const unix = (ms) => Math.floor(ms / 1000);

function raporEmbed({ tip, user, member, adyas, cevap, analiz, doldurmaSn, benzerNot }) {
  const alanlar = ALANLAR[tip];
  const e = new EmbedBuilder()
    .setColor(analiz.renk)
    .setTitle(tip === 'ac' ? '🛡️ AntiCheat Başvuru Raporu' : '👑 Yetkili Başvuru Raporu')
    .setThumbnail(user.displayAvatarURL())
    .setDescription(
      `**Başvuran:** <@${user.id}> (\`${user.tag}\`)\n` +
      `**Hesap:** <t:${unix(user.createdTimestamp)}:R> • **Sunucuya katılım:** ${member?.joinedTimestamp ? `<t:${unix(member.joinedTimestamp)}:R>` : 'bilinmiyor'}` +
      (doldurmaSn != null ? `\n**Form süresi:** ${doldurmaSn} sn` : ''),
    )
    .addFields(
      { name: '📝 Ad', value: kisalt(analiz.ad, 100) || '—', inline: true },
      { name: '🎂 Yaş', value: analiz.yas != null ? String(analiz.yas) : '❓ okunamadı', inline: true },
    );
  for (const a of alanlar) {
    const v = (cevap[a.id] || '').trim();
    if (a.opsiyonel && !v) continue;
    e.addFields({ name: `📌 ${a.etiket}`, value: kisalt(v || '— boş —', 420) });
  }
  const k = analiz.kirilim;
  e.addFields({
    name: '🤖 Otomatik Analiz',
    value: `\`${barCiz(analiz.puan)}\` **${analiz.puan}/100**\n${analiz.seviye}\n**Öneri:** ${analiz.oneri}\n` +
      `📝 İçerik **${k.icerik}**/35 • 🧠 Konu **${k.konu}**/25 • 🎂 Yaş **${k.yas}**/15 • 🔐 Güven **${k.guven}**/15 • ✨ Özgünlük **${k.ozgun}**/10`,
  });
  if (analiz.olumlu.length) e.addFields({ name: '✅ Olumlu', value: kisalt(analiz.olumlu.slice(0, 5).map((x) => `• ${x}`).join('\n'), 520) });
  if (analiz.olumsuz.length) e.addFields({ name: '⚠️ Dikkat', value: kisalt(analiz.olumsuz.slice(0, 5).map((x) => `• ${x}`).join('\n'), 520) });
  if (analiz.risk.length) e.addFields({ name: '🚩 Risk Bayrakları', value: kisalt(analiz.risk.slice(0, 6).map((x) => `• ${x}`).join('\n'), 600) });
  e.setFooter({ text: `ID: ${user.id} • Analiz yardımcıdır, son karar yetkililerindir.` }).setTimestamp();
  return e;
}

async function basvuruAl(i, tip) {
  const engel = basvuruEngeli(i.user.id, tip);
  if (engel) return i.reply({ content: engel, flags: MessageFlags.Ephemeral });
  await i.deferReply({ flags: MessageFlags.Ephemeral }); // 3 saniye sınırına takılmamak için hemen yanıt

  const adyas = i.fields.getTextInputValue(`${tip}_adyas`).trim();
  const cevap = {};
  for (const a of ALANLAR[tip]) { try { cevap[a.id] = i.fields.getTextInputValue(`${tip}_${a.id}`).trim(); } catch { cevap[a.id] = ''; } }

  const key = `${tip}:${i.user.id}`;
  const acilis = formAcilis.get(key); formAcilis.delete(key);
  const doldurmaSn = acilis ? Math.round((Date.now() - acilis) / 1000) : null;
  const uye = {
    hesapGun: (Date.now() - i.user.createdTimestamp) / 86400e3,
    katilimGun: i.member?.joinedTimestamp ? (Date.now() - i.member.joinedTimestamp) / 86400e3 : null,
  };
  const analiz = basvuruAnaliz({ tip, adyas, cevap, uye, doldurmaSn, gecmis: db.gecmis, kullaniciId: i.user.id });

  const logKanal = await client.channels.fetch(tip === 'ac' ? AC_LOG_CHANNEL_ID : YETKILI_LOG_CHANNEL_ID).catch(() => null);
  if (!logKanal?.isTextBased()) {
    console.error('❌ Başvuru log kanalı bulunamadı:', tip);
    return i.editReply('❌ Başvuru şu an iletilemedi (log kanalı bulunamadı). Lütfen yetkililere haber ver.');
  }

  const satir = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bv_onay|${tip}|${i.user.id}`).setLabel('Mülakata Al / Onayla').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`bv_red|${tip}|${i.user.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji('❌'),
  );
  const roller = tip === 'ac' ? [ROL_1, ROL_2] : [ROL_2];
  let mesaj;
  try {
    mesaj = await logKanal.send({
      content: `${roller.map((r) => `<@&${r}>`).join(' ')} Yeni ${tip === 'ac' ? 'AC' : 'Yetkili'} başvurusu var!`,
      embeds: [raporEmbed({ tip, user: i.user, member: i.member, adyas, cevap, analiz, doldurmaSn })],
      components: [satir],
      allowedMentions: { roles: roller },
    });
  } catch (e) {
    console.error('❌ Başvuru log kanalına yazılamadı:', e.code, e.message);
    return i.editReply('❌ Başvuru şu an iletilemedi (botun log kanalında yetkisi yok olabilir). Lütfen yetkililere haber ver.');
  }

  db.durum[key] = { durum: 'bekliyor', t: Date.now(), msg: mesaj.id };
  db.gecmis.push({ user: i.user.id, tip, t: Date.now(), kelimeler: analiz.kelimeler });
  if (db.gecmis.length > 300) db.gecmis.shift();
  kaydet();
  return i.editReply(`✅ ${tip === 'ac' ? 'AntiCheat' : 'Yetkili'} başvurun iletildi! Yetkililer en kısa sürede inceleyecek.`);
}

const sonucYetkisi = (m) => !!m && (m.permissions.has(PermissionFlagsBits.Administrator) || m.roles.cache.has(ROL_2));

async function sonuclandir(i, tip, userId, onay, sebep) {
  const e = EmbedBuilder.from(i.message.embeds[0])
    .setColor(onay ? 0x2ecc71 : 0xe74c3c)
    .addFields({ name: '📌 Sonuç', value: `${onay ? '✅ **Onaylandı / Mülakata alındı**' : '❌ **Reddedildi**'} — <@${i.user.id}> • <t:${unix(Date.now())}:R>${sebep ? `\n**Sebep:** ${kisalt(sebep, 500)}` : ''}` });
  await i.update({ embeds: [e], components: [] });
  db.durum[`${tip}:${userId}`] = { ...(db.durum[`${tip}:${userId}`] || {}), durum: onay ? 'onay' : 'red', t: Date.now(), by: i.user.id };
  kaydet();
  const u = await client.users.fetch(userId).catch(() => null);
  if (u) {
    const ad = tip === 'ac' ? 'AntiCheat' : 'Yetkili';
    const metin = onay
      ? `✅ **${ad} başvurun olumlu bulundu!** Yetkililer seninle mülakat için iletişime geçecek.`
      : `❌ **${ad} başvurun maalesef reddedildi.**${sebep ? `\n**Sebep:** ${sebep}` : ''}\nİstersen ${BEKLEME_SAAT.red} saat sonra tekrar başvurabilirsin.`;
    u.send(metin).catch(() => {});
  }
}

// ================================================================
// SES KANALI (7/24)
// ================================================================
async function connectToVoice(guild) {
  const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
  if (!channel || !channel.isVoiceBased()) return;
  try {
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: true });
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        connection.destroy();
        setTimeout(() => connectToVoice(guild), 3000);
      }
    });
  } catch (error) { console.error('Ses bağlantı hatası:', error); }
}

// ================================================================
// 🔔 HOŞ GELDİN & GİRİŞ LOGU
// ================================================================
client.on('guildMemberAdd', async (member) => {
  try {
    if (UNREGISTERED_ROLE_ID) await member.roles.add(UNREGISTERED_ROLE_ID).catch(() => {});
    const tarihStr = member.user.createdAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const guvenliMi = Date.now() - member.user.createdTimestamp > 7 * 24 * 60 * 60 * 1000;
    const uyeSayisi = member.guild.memberCount;
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setThumbnail(member.guild.iconURL() || member.user.displayAvatarURL())
      .setDescription(
        `🔔 - **Kullanıcı:** <@${member.user.id}> - \`${member.user.username}\`\n` +
        `👤 - **Kullanıcı ID:** \`${member.user.id}\`\n` +
        `📆 - **Hesap oluşturma tarihi:** \`${tarihStr}\`\n` +
        `⏰ - **Sunucuya giriş sırası:** \`${uyeSayisi}/${uyeSayisi}\`\n` +
        `📜 - **Hesap güvenliği :** ${guvenliMi ? '`Güvenli ✔️`' : '`Şüpheli ❌`'}\n\n` +
        '📣 - Merhabalar, sunucumuza hoşgeldiniz! Sunucumuza katıldığın için üzerine **Kayıtsız Üye** rolünü verdim!',
      )
      .setImage(TARGET_IMAGE)
      .setFooter({ text: '#FestPvP - Welcomer System', iconURL: member.guild.iconURL() || undefined });
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel) await channel.send({ content: `<@${member.user.id}>`, embeds: [welcomeEmbed] });
  } catch (e) { console.error('Hoşgeldin hatası:', e.message); }
});

// ================================================================
// HAZIR
// ================================================================
let hazirMi = false;
async function hazir() {
  if (hazirMi) return;
  hazirMi = true;
  console.log(`✅ ${client.user.tag} Sistem Aktif!`);
  const commands = [
    new SlashCommandBuilder().setName('ac-panel').setDescription('AC başvuru paneli').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('yetkili-panel').setDescription('Yetkili başvuru paneli').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map((c) => c.toJSON());
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
      console.log(`✅ Komutlar kaydedildi: ${guild.name}`);
    } catch (e) { console.error('Komut kayıt hatası:', e.message); }
    connectToVoice(guild);
  }
}
client.once('clientReady', hazir);
client.once('ready', hazir);

// ================================================================
// ETKİLEŞİMLER
// ================================================================
function panelEmbed(tip) {
  const e = new EmbedBuilder().setColor('#2b2d31');
  if (tip === 'ac') e.setTitle('🛡️ FEST GUN | AC Başvuru Paneli').setDescription('### Sunucu Güvenliğinde Yeni Bir Adım At!\n\nSunucumuzun güvenlik duvarını güçlendirmek için hemen alttaki butona tıklayarak formu doldurabilirsin.');
  else e.setTitle('👑 FEST GUN | Yetkili Başvuru Paneli').setDescription('### Ailemize Katıl ve Yönetimde Söz Sahibi Ol!\n\nSunucu içi düzeni sağlamak için hemen alttaki butona basarak başvuru formunu doldur!');
  if (TARGET_IMAGE) e.setImage(TARGET_IMAGE);
  const row = new ActionRowBuilder().addComponents(
    tip === 'ac'
      ? new ButtonBuilder().setCustomId('apply_ac').setLabel('AntiCheat Başvurusu Yap').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
      : new ButtonBuilder().setCustomId('apply_staff').setLabel('Yetkili Başvurusu Yap').setStyle(ButtonStyle.Success).setEmoji('👑'),
  );
  return { embeds: [e], components: [row] };
}

async function etkilesim(i) {
  if (i.isChatInputCommand()) {
    if (!['ac-panel', 'yetkili-panel'].includes(i.commandName)) return;
    if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ content: '⛔ Bu komutu sadece yöneticiler kullanabilir.', flags: MessageFlags.Ephemeral });
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await i.channel.send(panelEmbed(i.commandName === 'ac-panel' ? 'ac' : 'staff'));
    return i.editReply(i.commandName === 'ac-panel' ? '✅ AC Paneli kuruldu.' : '✅ Yetkili paneli kuruldu.');
  }

  if (i.isButton()) {
    if (i.customId === 'apply_ac' || i.customId === 'apply_staff') {
      const tip = i.customId === 'apply_ac' ? 'ac' : 'staff';
      const engel = basvuruEngeli(i.user.id, tip);
      if (engel) return i.reply({ content: engel, flags: MessageFlags.Ephemeral });
      formAcilis.set(`${tip}:${i.user.id}`, Date.now());
      return i.showModal(formModal(tip));
    }
    if (i.customId.startsWith('bv_')) {
      const [eylem, tip, userId] = i.customId.split('|');
      if (!sonucYetkisi(i.member)) return i.reply({ content: '⛔ Başvuruları sadece yetkili ekip sonuçlandırabilir.', flags: MessageFlags.Ephemeral });
      if (eylem === 'bv_onay') return sonuclandir(i, tip, userId, true, null);
      if (eylem === 'bv_red') {
        const modal = new ModalBuilder().setCustomId(`bvm_red|${tip}|${userId}`).setTitle('Reddetme Sebebi').addComponents(
          alan('sebep', 'Sebep (başvurana DM ile iletilir)', TextInputStyle.Paragraph, { zorunlu: false, max: 400 }),
        );
        return i.showModal(modal);
      }
    }
    return;
  }

  if (i.isModalSubmit()) {
    if (i.customId === 'modal_ac') return basvuruAl(i, 'ac');
    if (i.customId === 'modal_staff') return basvuruAl(i, 'staff');
    if (i.customId.startsWith('bvm_red|')) {
      const [, tip, userId] = i.customId.split('|');
      if (!sonucYetkisi(i.member)) return i.reply({ content: '⛔ Yetkin yok.', flags: MessageFlags.Ephemeral });
      let sebep = ''; try { sebep = i.fields.getTextInputValue('sebep').trim(); } catch {}
      if (!i.message) return i.reply({ content: '❌ Mesaj bulunamadı.', flags: MessageFlags.Ephemeral });
      return sonuclandir(i, tip, userId, false, sebep);
    }
  }
}

client.on('interactionCreate', async (interaction) => {
  try { await etkilesim(interaction); }
  catch (e) {
    console.error('Etkileşim hatası:', e);
    try {
      const msg = { content: '❌ Bir hata oluştu, lütfen tekrar dene. Sorun sürerse yetkililere haber ver.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) await interaction.followUp(msg); else await interaction.reply(msg);
    } catch {}
  }
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild || !message.member) return;
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (message.content === '!ac-panel') { await message.delete().catch(() => {}); await message.channel.send(panelEmbed('ac')); }
    else if (message.content === '!yetkili-panel') { await message.delete().catch(() => {}); await message.channel.send(panelEmbed('staff')); }
  } catch (e) { console.error('Mesaj komutu hatası:', e.message); }
});

process.on('unhandledRejection', (e) => console.error('Yakalanmamış hata:', e));
process.on('uncaughtException', (e) => console.error('Beklenmeyen hata:', e));
console.log('SÜRÜM: ac-bot-v2');
client.login(TOKEN);
