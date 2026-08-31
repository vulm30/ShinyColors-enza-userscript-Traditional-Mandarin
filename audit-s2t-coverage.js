// 稽核腳本：掃描已編譯的 .user.js，列出常見「文字/名稱型欄位賦值」有沒有包 s2t()。
// 用途：s2t() 目前是逐一手動包在賦值點上，不是全域攔截，未來新增賦值點（遊戲更新、原作者
// 上游更新）時，用本腳本快速抽查有沒有漏包。
//
// 注意：這是啟發式掃描，不是語法解析器，抓到的「疑似未包 s2t()」只是候選名單，
// 仍需人工判斷該欄位是不是真的會被指派成需要繁簡轉換的中文字串
// （例如角色 ID、CSV 欄位鍵、Error 類別名稱這種英文常數，就是合理的誤判，不用處理）。
//
// 用法：node audit-s2t-coverage.js [檔案路徑，預設抓同目錄的 .user.js]

const fs = require('fs');
const path = require('path');

const TARGET_FIELDS = ['text', 'title', 'name', 'select', 'trans'];
const LOOKAHEAD_WINDOW = 20; // 賦值後往右看幾個字元內找 s2t(，涵蓋 `.text=""+s2t(x)` 這種間接寫法

const file = process.argv[2] || path.join(__dirname, 'ShinyColors-enza-userscript-Traditional-Mandarin.user.js');
const code = fs.readFileSync(file, 'utf8');

let totalWrapped = 0;
let totalCandidates = 0;

for (const field of TARGET_FIELDS) {
  const pattern = new RegExp(`\\.${field}=`, 'g');
  let match;
  const unwrapped = [];
  let wrapped = 0;

  while ((match = pattern.exec(code)) !== null) {
    const after = code.slice(match.index + match[0].length, match.index + match[0].length + LOOKAHEAD_WINDOW);
    if (after.includes('s2t(')) {
      wrapped++;
    } else {
      const context = code.slice(Math.max(0, match.index - 40), match.index + 60);
      unwrapped.push(context);
    }
  }

  totalWrapped += wrapped;
  totalCandidates += wrapped + unwrapped.length;

  console.log(`\n== .${field}= ==`);
  console.log(`已包 s2t()：${wrapped}　疑似未包：${unwrapped.length}`);
  unwrapped.forEach((ctx, i) => {
    console.log(`  [${i + 1}] ...${ctx}...`);
  });
}

console.log(`\n總計：${totalCandidates} 個賦值點，${totalWrapped} 個已包 s2t()，${totalCandidates - totalWrapped} 個待人工確認。`);
