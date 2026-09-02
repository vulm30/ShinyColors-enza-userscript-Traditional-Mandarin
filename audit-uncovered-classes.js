// 盤點「還沒被系統掃過的失效類別」，各自定出可窮舉的母體。
//
// 這支腳本與 audit-coverage.js 的分工：
//   audit-coverage.js  回答「OpenCC 的母體裡還有多少面積沒審過」
//   本腳本             回答「還有哪些**失效類別**根本沒被定義成母體」
//
// 已做完、不再重複的兩個母體：
//   ① 一簡多繁 276 字（TODO-18 的 233 字窮舉審查）
//   ② 真簡體殘留 3,809 字（99.80%）
//
// 🔴 本腳本查不到的盲區（TODO-20 的教訓）：
//   OpenCC 把 `伙→夥`、`汇→匯` 當成單純的一對一，沒列進一簡多繁，
//   但它們在台灣其實是一對二（伙/夥、匯/彙）。這類字**任何以 OpenCC
//   為母體的稽核都掃不到**，只能靠讀轉換後的實際句子發現。
//
// 只讀不寫。用法：
//   node audit-uncovered-classes.js <語料檔> <STCharacters.txt>

const fs = require('fs'), path = require('path');
const repo = __dirname;
const corpusPath = process.argv[2];
const stPath = process.argv[3];
if (!corpusPath || !stPath) {
  console.error('用法：node audit-uncovered-classes.js <語料檔> <STCharacters.txt>');
  console.error('語料取得方式見 TODO.md；STCharacters.txt 來自 OpenCC master。');
  process.exit(1);
}
const dict = JSON.parse(fs.readFileSync(path.join(repo, 's2t_dict.json'), 'utf8'));
const corpus = fs.readFileSync(corpusPath, 'utf8');
const stRaw = fs.readFileSync(stPath, 'utf8');

// 真簡體字集合（候選清單不含它自己）
const trueSimp = new Set();
for (const line of stRaw.split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [k, v] = line.split('\t');
  if (!k || !v) continue;
  const list = v.trim().split(' ').filter(Boolean);
  if (!list.includes(k.trim())) trueSimp.add(k.trim());
}

// 舊字形／非台灣正體（人工列，來源＝OpenCC TWVariants 的常見項）
const OLD_FORM = {
  '爲': '為', '衆': '眾', '啓': '啟', '牀': '床', '竈': '灶', '羣': '群',
  '峯': '峰', '裏': '裡', '麪': '麵', '綫': '線', '嚐': '嘗', '牠': '它',
  '喫': '吃', '擡': '抬', '菸': '菸', '踪': '蹤', '祕': '祕', '毬': '球',
  '晉': '晉', '嚮': '向', '媿': '愧', '慙': '慚', '鷄': '雞', '穉': '稚',
  '蔴': '麻', '搨': '拓', '疉': '疊', '悽': '悽', '銹': '鏽', '蹟': '跡',
};

const si = new Map();
for (let i = 0; i < dict.sChars.length; i++) si.set(dict.sChars[i], i);

console.log('========== 母體盤點 ==========\n');

// ── A：逐字表的輸出值本身有問題 ──────────────────────────
const A = [];
for (let i = 0; i < dict.sChars.length; i++) {
  const s = dict.sChars[i], t = dict.tChars[i];
  if (trueSimp.has(t)) A.push({ s, t, why: '輸出仍是簡體字' });
  else if (OLD_FORM[t] && OLD_FORM[t] !== t) A.push({ s, t, why: `舊字形，台灣正體應為 ${OLD_FORM[t]}` });
}
console.log(`【母體 A】逐字表輸出值有問題：${A.length} 條 / 共 ${dict.sChars.length} 條`);
A.slice(0, 30).forEach(x => console.log(`    ${x.s} -> ${x.t}   （${x.why}）`));
console.log('  🔴 註：床／灶／痴／秘／粽／群 這幾個是**誤報**，OpenCC 有 牀→床、羣→群');
console.log('     這類反向條目，導致台灣正體反而被判成簡體。它們現在的值是對的。');

// ── B：詞組表的輸出值本身有問題 ──────────────────────────
const B = [];
for (const [s, t] of dict.phrases) {
  const bad = [...t].filter(c => trueSimp.has(c));
  const old = [...t].filter(c => OLD_FORM[c] && OLD_FORM[c] !== c);
  if (bad.length) B.push({ s, t, why: `輸出含簡體字「${bad.join('')}」` });
  else if (old.length) B.push({ s, t, why: `輸出含舊字形「${old.join('')}」，應為「${old.map(c => OLD_FORM[c]).join('')}」` });
}
console.log(`\n【母體 B】詞組表輸出值有問題：${B.length} 條 / 共 ${dict.phrases.length} 條`);
B.slice(0, 30).forEach(x => console.log(`    ${x.s} -> ${x.t}   （${x.why}）`));

// ── C：詞組規則的誤傷風險（看板娘那一類）──────────────────
// 機制：規則 key「板娘」在語料中若常是更長詞「看板娘」的一部分，
// 而更長詞的正確轉換不同，規則就會誤傷。
// 母體＝語料中真的出現、且有高頻左右延伸的規則 key。
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isCJK = c => /[一-鿿]/.test(c);
const C = [];
for (const [s, t] of dict.phrases) {
  if (s.length < 2) continue;
  // 只看輸出與輸入「不是逐字等價」的規則（那才有誤傷可能）
  const trivial = [...s].every((c, i) => {
    const expect = si.has(c) ? dict.tChars[si.get(c)] : c;
    return expect === t[i];
  }) && s.length === t.length;
  if (trivial) continue;

  let idx = 0, hits = 0;
  const left = new Map(), right = new Map();
  while ((idx = corpus.indexOf(s, idx)) !== -1) {
    hits++;
    const p = corpus[idx - 1], n = corpus[idx + s.length];
    if (p && isCJK(p)) left.set(p, (left.get(p) || 0) + 1);
    if (n && isCJK(n)) right.set(n, (right.get(n) || 0) + 1);
    idx += s.length;
    if (hits > 5000) break;
  }
  if (!hits) continue;
  const topL = [...left.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topR = [...right.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!topL.length && !topR.length) continue;
  C.push({ s, t, hits, topL, topR });
}
C.sort((a, b) => b.hits - a.hits);
console.log(`\n【母體 C】有延伸語境、可能誤傷的詞組規則：${C.length} 條`);
console.log('  前 20 名（依語料頻次）：');
C.slice(0, 20).forEach(x => {
  const l = x.topL.map(([c, n]) => `${c}${x.s}(${n})`).join(' ');
  const r = x.topR.map(([c, n]) => `${x.s}${c}(${n})`).join(' ');
  console.log(`    ${String(x.hits).padStart(5)}  ${x.s}->${x.t}   左：${l || '—'}   右：${r || '—'}`);
});

// 母體 C 要拿去產工單時，給第三個參數指定輸出路徑（放 repo 之外，不進 commit）
const outPath = process.argv[4];
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(C), 'utf8');
  console.log(`\n（母體 C 已寫入 ${outPath}，供產工單使用）`);
} else {
  console.log('\n（要把母體 C 存成檔案供產工單使用，請給第三個參數指定輸出路徑）');
}
