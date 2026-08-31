// builder.js 守門機制的負向測試
//
// 為什麼需要這支：builder.js 的檢查全部通過時，「真的沒問題」與「檢查根本
// 抓不到問題」看起來一模一樣。所以另外注入真實可能發生的失誤形態，
// 確認守門確實會以 exit=1 中止，綠燈才有意義。
//
// 安全性：全部操作都在系統暫存目錄的沙盒副本裡進行，不觸碰 repo 本身。
//
// 用法：node guard-negative-test.js
// 回傳：全部通過 exit=0，任一未通過 exit=1

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = __dirname;
const SANDBOX = path.join(os.tmpdir(), 'sczh-guard-test-sandbox');
const NODE = process.execPath;

const DICT = 's2t_dict.json';
const USERJS = 'ShinyColors-enza-userscript-Traditional-Mandarin.user.js';
const BUILDER = 'builder.js';

function resetSandbox() {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  fs.mkdirSync(SANDBOX, { recursive: true });
  for (const f of [DICT, USERJS, BUILDER]) {
    fs.copyFileSync(path.join(REPO, f), path.join(SANDBOX, f));
  }
}

function runBuilder() {
  try {
    return { code: 0, out: execFileSync(NODE, [BUILDER], { cwd: SANDBOX, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const dictPath = () => path.join(SANDBOX, DICT);
const readDict = () => JSON.parse(fs.readFileSync(dictPath(), 'utf8'));
const writeDict = d => fs.writeFileSync(dictPath(), JSON.stringify(d), 'utf8');

const cases = [
  {
    name: 'A. 基準組（未注入任何錯誤）',
    expect: 0,
    mutate: () => {},
  },
  {
    name: 'B. sChars 與 tChars 長度不一致（平行陣列錯位，b4d5be1 的真實事故形態）',
    expect: 1,
    mutate: () => { const d = readDict(); d.tChars = d.tChars.slice(0, -1); writeDict(d); },
  },
  {
    name: 'C. sChars 出現重複字元（後者靜默覆蓋前者）',
    expect: 1,
    mutate: () => {
      const d = readDict();
      d.sChars += d.sChars[0];
      d.tChars += d.tChars[0];
      writeDict(d);
    },
  },
  {
    name: 'D. phrases 出現重複詞條（後者靜默覆蓋前者）',
    expect: 1,
    mutate: () => {
      const d = readDict();
      d.phrases = d.phrases.concat([[d.phrases[0][0], '不同的譯法']]);
      writeDict(d);
    },
  },
  {
    name: 'E. 遊戲原始碼變更導致 Wi 字型攔截消失（完成度檢查該擋下）',
    expect: 1,
    mutate: () => {
      const p = path.join(SANDBOX, USERJS);
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split('Wi=async()=>').join('WiRenamed=async()=>'), 'utf8');
    },
  },
];

let fail = 0;
for (const c of cases) {
  resetSandbox();
  c.mutate();
  const r = runBuilder();
  const ok = r.code === c.expect;
  if (!ok) fail++;
  console.log(`${ok ? '通過  ' : '未通過'}  ${c.name}（期望 exit=${c.expect}，實際 exit=${r.code}）`);
  if (!ok) console.log(`        輸出：${r.out.slice(0, 300)}`);
}

fs.rmSync(SANDBOX, { recursive: true, force: true });
console.log(`\n合計：${cases.length - fail} 通過、${fail} 未通過`);
process.exit(fail ? 1 : 0);
