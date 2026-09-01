// 字典涵蓋率稽核器
//
// 為什麼有這支腳本：2026-09-01 製作人實機遊玩時發現「分鍾」（應為分鐘）。
// 事後查證，那個錯字就排在六位獨立稽核員手上詞頻檔的最前面，沒有一位提出來。
// 根因不是不夠細心，是**方法的結構**：先前所有掃描都是「我先想出一份可疑清單，
// 再去查那份清單」，涵蓋率等於想像力，而「钟」從未進過任何人的候選名單。
//
// 對照組足以說明問題：同一天、同一份語料，「簡體殘留」那一項做到 100% 零漏，
// 因為那裡用的是 OpenCC 的可窮舉母體；「一簡多繁選字」漏掉頻次第 25 名的字，
// 因為那裡用的是手寫清單。
//
// 所以這支腳本只做一件事：**把「涵蓋率」從一種感覺變成一個數字。**
// 它不判斷對錯（那需要語感），它回答「還有多少面積從未被審視過」。
//
// 用法：
//   node audit-coverage.js                      對照 OpenCC 線上資料
//   node audit-coverage.js <STCharacters.txt>    對照本機快取的 OpenCC 資料
//
// 判準來源一律是 OpenCC 的 STCharacters.txt（外部基準）。
// 不拿本專案的字典當判準 —— 拿被驗證對象當判準是循環論證。

const fs = require('fs');
const path = require('path');
const https = require('https');

const DICT = path.join(__dirname, 's2t_dict.json');
const OPENCC_URL = 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt';

const get = url => new Promise((resolve, reject) => {
  https.get(url, res => {
    if (res.statusCode !== 200) return reject(new Error(`${url} -> ${res.statusCode}`));
    let d = '';
    res.setEncoding('utf8');
    res.on('data', c => d += c);
    res.on('end', () => resolve(d));
  }).on('error', reject);
});

function parseOpenCC(raw) {
  const oneToMany = new Map();   // 一簡多繁：候選超過一個
  const trueSimplified = new Set();  // 真簡體字：候選清單不含它自己
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [k, v] = line.split('\t');
    if (!k || !v) continue;
    const ch = k.trim();
    const list = v.trim().split(' ').filter(Boolean);
    if (list.length > 1) oneToMany.set(ch, list);
    // 「了 → 了/瞭」這種，「了」本身就是合法繁體，不算簡體殘留。
    // 這個判準是踩過坑才訂的：第一版把所有 key 都算簡體，得出 83.7% 的假數字。
    if (!list.includes(ch)) trueSimplified.add(ch);
  }
  return { oneToMany, trueSimplified };
}

(async () => {
  const dict = JSON.parse(fs.readFileSync(DICT, 'utf8'));
  const local = process.argv[2];
  let raw;
  if (local) {
    raw = fs.readFileSync(local, 'utf8');
    console.log(`判準來源：${local}（本機）`);
  } else {
    console.log('判準來源：OpenCC master（線上取得）');
    raw = await get(OPENCC_URL);
  }
  const { oneToMany, trueSimplified } = parseOpenCC(raw);

  const sIdx = new Map();
  for (let i = 0; i < dict.sChars.length; i++) sIdx.set(dict.sChars[i], i);
  // 一個字只要出現在任何詞組規則的 key 裡，就代表做過語境決策
  const decided = new Map();
  for (const [s] of dict.phrases) {
    for (const ch of s) decided.set(ch, (decided.get(ch) || 0) + 1);
  }

  console.log(`\nOpenCC 條目 ${oneToMany.size + 0} 個一簡多繁字、${trueSimplified.size} 個真簡體字`);
  console.log(`本專案字典：逐字表 ${dict.sChars.length} 字、詞組表 ${dict.phrases.length} 條`);

  // ── 指標一：真簡體字的收錄率 ──────────────────────────────
  const missingSimp = [...trueSimplified].filter(ch => !sIdx.has(ch));
  console.log('\n===== 指標一：真簡體字的收錄 =====');
  console.log(`  未收錄：${missingSimp.length} / ${trueSimplified.size}`);
  console.log('  註：未收錄的絕大多數是極罕用的擴充區字，不影響本專案語料。');
  console.log('      要判斷實際影響，請用語料重跑殘留量測，本腳本不做語料分析。');

  // ── 指標二：一簡多繁的決策覆蓋 ────────────────────────────
  const zero = [], some = [];
  for (const [ch, list] of oneToMany) {
    const rules = decided.get(ch) || 0;
    const def = sIdx.has(ch) ? dict.tChars[sIdx.get(ch)] : ch;
    (rules === 0 ? zero : some).push({ ch, def, list, rules });
  }
  console.log('\n===== 指標二：一簡多繁的決策覆蓋（本腳本的主要用途）=====');
  console.log('  註：本腳本刻意不依賴語料，所以下面的數字含「本專案語料裡根本不會出現的字」。');
  console.log('      要看真正有影響的面積，請用語料過濾一次再看，兩個數字的分母不同、不可直接比較。');
  console.log(`  母體 ${oneToMany.size} 字`);
  console.log(`  已有詞組規則碰過（＝做過語境決策）：${some.length} 字`);
  console.log(`  🔴 零決策（預設值從未被審視）：${zero.length} 字`);
  if (zero.length) {
    console.log('\n  零決策清單（字 → 目前預設　［OpenCC 候選］）：');
    const lines = zero.map(z => `${z.ch}→${z.def}[${z.list.join('')}]`);
    for (let i = 0; i < lines.length; i += 6) {
      console.log('    ' + lines.slice(i, i + 6).join('  '));
    }
  }

  // ── 指標三：詞組表的自我一致性 ────────────────────────────
  console.log('\n===== 指標三：詞組表的自我一致性 =====');
  const outputHasKey = dict.phrases.filter(([, t]) =>
    [...t].some(c => sIdx.has(c) && dict.tChars[sIdx.get(c)] !== c));
  console.log(`  輸出會被逐字階段覆寫的規則：${outputHasKey.length} 條`);
  if (outputHasKey.length) {
    console.log('  （已知架構限制，詳見 TODO.md 的「詞組輸出優先」研究紀錄）');
    console.log('  ' + outputHasKey.slice(0, 8).map(([s, t]) => `${s}→${t}`).join('  ')
      + (outputHasKey.length > 8 ? `  …另 ${outputHasKey.length - 8} 條` : ''));
  }

  console.log('\n===== 怎麼用這份報表 =====');
  console.log('  「零決策」不等於「有錯」，但它是**唯一從未被人看過的面積**。');
  console.log('  改完字典後重跑本腳本，數字應該只減不增；若變多，代表新規則引進了新的未審面積。');
  console.log('  要真的判斷對錯，把零決策清單做成有邊界的工單交人或 agent 逐項作答，');
  console.log('  不要交出「去找問題」這種沒有可驗證完成度的任務（2026-09-01 的教訓）。');
})();
