const fs = require('fs');
const path = require('path');

const dict = JSON.parse(fs.readFileSync(path.join(__dirname, 's2t_dict.json'), 'utf8'));

// 詞組依長度降冪排序後才組進正則。
// 原因：regexPhrases 是 PHRASES.map(...).join('|')，而 JS 的正則交替
// 取「最先列出的那一個」而非「最長的那一個」。因此只要某個短詞排在
// 一個以它為前綴的長詞前面，長詞就永遠比對不到、變成靜默失效的死規則
// （修正前實測有 5 條「关系」開頭的詞是這樣被遮蔽的）。
// 排序後長詞優先，行為才符合直覺，往後新增詞條也不必再擔心順序。
dict.phrases.sort((a, b) => b[0].length - a[0].length);

// 產生輕量且完整的繁簡轉換引擎 (無大體積 Base64)
const s2tEngineCode = `
// =========================================================================
// 內建完整繁簡轉換引擎 (含 OpenCC 4000+ 字符對照與 2500+ 高頻詞庫，體積輕巧秒加載)
// =========================================================================
const S_CHARS = ` + JSON.stringify(dict.sChars) + `;
const T_CHARS = ` + JSON.stringify(dict.tChars) + `;
const PHRASES = ` + JSON.stringify(dict.phrases) + `;

const s2tMap = new Map();
for (let i = 0; i < S_CHARS.length; i++) {
  s2tMap.set(S_CHARS[i], T_CHARS[i]);
}

const phraseMap = new Map();
PHRASES.forEach(([s, t]) => {
  phraseMap.set(s, t);
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^` + '${}()|[\\]' + `\\\\]/g, '\\\\$&');
}

const regexPhrases = new RegExp(PHRASES.map(p => escapeRegExp(p[0])).join('|'), 'g');

const s2tCache = new Map();
function s2t(text) {
  if (!text || typeof text !== 'string') return text;
  if (s2tCache.has(text)) return s2tCache.get(text);
  let str = text.replace(regexPhrases, matched => phraseMap.get(matched) || matched);
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    res += s2tMap.get(ch) || ch;
  }
  s2tCache.set(text, res);
  return res;
}

const TW_FONT_FAMILY = '"jf open 粉圓 2.1", "jf-openhuninn-2.1", "jf open 粉圓", "jf-openhuninn", "jf openhuninn", "jf粉圓", HummingStd-E, "Zen Maru Gothic", "Microsoft JhengHei", "PingFang TC", sans-serif';

(function injectOnlineHuninn() {
  try {
    if (!document.getElementById("sczh-tw-huninn-fonts")) {
      const gFont = document.createElement("link");
      gFont.id = "sczh-tw-huninn-fonts";
      gFont.rel = "stylesheet";
      gFont.href = "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Noto+Sans+TC:wght@500;700&display=swap";
      (document.head || document.documentElement).appendChild(gFont);
    }
    
    const styleEl = document.createElement("style");
    styleEl.id = "sczh-tw-font-style";
    styleEl.innerHTML = \`
      @font-face {
        font-family: "HummingStd-E";
        src: local("jf open 粉圓 2.1"),
             local("jf-openhuninn-2.1"),
             local("jf open 粉圓"),
             local("jf-openhuninn"),
             local("jf openhuninn"),
             local("jf粉圓"),
             url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf") format("truetype"),
             local("Zen Maru Gothic Bold"),
             local("Zen Maru Gothic Medium"),
             local("Microsoft JhengHei");
        font-weight: normal 100 200 300 400 500 600 700 800 900;
        font-display: swap;
      }
      @font-face {
        font-family: "UDKakugo_SmallPr6-B";
        src: local("jf open 粉圓 2.1"),
             local("jf-openhuninn-2.1"),
             local("jf open 粉圓"),
             local("jf-openhuninn"),
             local("jf openhuninn"),
             local("jf粉圓"),
             url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf") format("truetype"),
             local("Noto Sans TC Bold"),
             local("Zen Maru Gothic Bold"),
             local("Microsoft JhengHei");
        font-weight: normal 100 200 300 400 500 600 700 800 900;
        font-display: swap;
      }
    \`;
    (document.head || document.documentElement).appendChild(styleEl);

    if (window.FontFace && document.fonts) {
      const f1 = new FontFace("HummingStd-E", 'local("jf open 粉圓 2.1"), local("jf-openhuninn-2.1"), url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf")');
      const f2 = new FontFace("UDKakugo_SmallPr6-B", 'local("jf open 粉圓 2.1"), local("jf-openhuninn-2.1"), url("https://cdn.jsdelivr.net/gh/justfont/open-huninn-font@master/font/jf-openhuninn-2.0.ttf")');
      Promise.all([f1.load(), f2.load()]).then(fonts => {
        fonts.forEach(f => document.fonts.add(f));
        console.info("[ShinyColors-TW] 粉圓體與日系圓體已成功加載！");
      }).catch(()=>{});
    }
  } catch(e) {}
})();
`;

// ⚠️ 注意：這裡讀的是「已注入過的輸出檔本身」，repo 內沒有保存未修改過的原廠遊戲程式碼。
// 若遊戲官方更新了 ji()/Wi 的原始邏輯，下方的正則比對可能會抓不到目標（見下方的比對失敗防呆）。
// 真的遇到官方更新導致比對失敗時，建議先手動另存一份「當次原始（未注入）程式碼」快照，
// 當作之後 diff 新舊官方邏輯差異的基準，不要直接在舊的注入結果上硬套新邏輯。
// 讀取原始主體邏輯
let currentCode = fs.readFileSync(path.join(__dirname, 'ShinyColors-enza-userscript-Traditional-Mandarin.user.js'), 'utf8');

const logicStartIndex = currentCode.indexOf('var e="undefined"!=typeof globalThis');
if (logicStartIndex === -1) {
  console.error('Logic start not found!');
  process.exit(1);
}

let mainLogic = currentCode.slice(logicStartIndex);

// 替換 ji 函數，在 PIXI Text 渲染時注入 TW_FONT_FAMILY
const oldJiPattern = /async function ji\(\)\{[\s\S]*?Reflect\.set\(this,"_text",t\),r\.call\(this,e\);\s*\}\s*\};\s*\}/;
const newJiCode = `async function ji(){
  const e=await Oa("AOBA");
  try{
    Si=await(async()=>{if(!Ei){ki=await _i();const e=await un();ki=new Map([...e,...ki]),Ei=!0}return ki})(),xi=await gs()
  }catch(e){}
  
  const t=e.Text.prototype.typeText;
  e.Text.prototype.typeText=function(...e){
    const r=e[0];
    if(this._style){
      this._style.fontFamily=TW_FONT_FAMILY;
      this._style.fontWeight='bold';
    }
    return e[0]=Ci(r,!0),t.apply(this,e);
  };
  
  const r=e.Text.prototype.updateText;
  e.Text.prototype.updateText=function(e){
    if(this._style && this._style.fontFamily!==TW_FONT_FAMILY){
      this._style.fontFamily=TW_FONT_FAMILY;
      this._style.fontWeight='bold';
      this.dirty=!0;
    }
    if(this.localStyleID!==this._style.styleID&&(this.dirty=!0,this._style.styleID),this.dirty||!e){
      T.dev,0;
      const t=Ci(this._text);
      return Reflect.set(this,"_text",t),r.call(this,e);
    }
  };
}`;

mainLogic = mainLogic.replace(oldJiPattern, newJiCode);

// 替換 Wi 函數
const oldWiPattern = /const Ui=[\s\S]*?document\.body\.appendChild\(e\);?\s*\};/;
const newWiCode = `const Ui=e=>{},
Hi=(e,t)=>\`/data/font/\${e}.woff2?v=\${t[\`font/\${e}.woff2\`]}\`,
Wi=async()=>{};`;

mainLogic = mainLogic.replace(oldWiPattern, newWiCode);

// 完成度檢查：驗證「輸出有沒有該有的特徵」，而不是「有沒有比對到舊樣式」。
// 本檔是冪等的：跑過一次之後，上面兩個舊樣式就不會再比對到
// （例如 oldWiPattern 找的 document.body.appendChild(e) 只存在於未注入過的
// 上游原始碼），那是正常的 no-op，不是錯誤。
// 若改成檢查「有沒有比對到」，第二次編譯就會誤判失敗。
const endStateChecks = [
  { name: 'ji 的字型注入（TW_FONT_FAMILY）', ok: mainLogic.includes('TW_FONT_FAMILY') },
  { name: 'Wi 的字型載入攔截', ok: /Wi=async\(\)=>/.test(mainLogic) },
];
const failedChecks = endStateChecks.filter(c => !c.ok);
if (failedChecks.length) {
  console.error('編譯中止：輸出缺少下列必要結構，可能遊戲原始碼已變更：');
  failedChecks.forEach(c => console.error('  - ' + c.name));
  process.exit(1);
}

// 字典完整性檢查：sChars/tChars 是兩條必須等長、同索引對應的平行陣列，
// 這個格式本身抓不出自己的錯位（b4d5be1 版的「艺 → 豔」就是這樣來的）。
const dictProblems = [];
if (dict.sChars.length !== dict.tChars.length) {
  dictProblems.push(`sChars(${dict.sChars.length}) 與 tChars(${dict.tChars.length}) 長度不一致，字元對應會整批錯位`);
}
const seenChar = new Set();
for (const ch of dict.sChars) {
  if (seenChar.has(ch)) dictProblems.push(`sChars 出現重複字元「${ch}」，後者會覆蓋前者`);
  seenChar.add(ch);
}
const seenPhrase = new Set();
for (const [s] of dict.phrases) {
  if (seenPhrase.has(s)) dictProblems.push(`phrases 出現重複詞條「${s}」，後者會覆蓋前者`);
  seenPhrase.add(s);
}
if (dictProblems.length) {
  console.error('編譯中止：s2t_dict.json 完整性檢查未通過：');
  dictProblems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

const header = `// ==UserScript==
// @name         偶像大師 Shiny Colors 繁體中文化與字體增強插件 (ShinyColors-enza-userscript-Traditional-Mandarin)
// @namespace    https://github.com/vulm30/ShinyColors-enza-userscript-Traditional-Mandarin
// @version      1.13.8
// @description  偶像大師 Shiny Colors 繁體中文（Traditional Mandarin）漢化與字體增強腳本。基於 biuuu/ShinyColors 漢化專案衍生，整合 OpenCC 繁中詞庫即時轉換、優先套用「jf open 粉圓 2.1」字型並提升字體粗細度（Bold）以改善閱讀體驗。
// @icon         https://shinycolors.enza.fun/icon_192x192.png
// @author       biuuu (Original Author)
// @homepage     https://github.com/vulm30/ShinyColors-enza-userscript-Traditional-Mandarin
// @supportURL   https://github.com/vulm30/ShinyColors-enza-userscript-Traditional-Mandarin/issues
// @updateURL    https://raw.githubusercontent.com/vulm30/ShinyColors-enza-userscript-Traditional-Mandarin/main/ShinyColors-enza-userscript-Traditional-Mandarin.user.js
// @downloadURL  https://raw.githubusercontent.com/vulm30/ShinyColors-enza-userscript-Traditional-Mandarin/main/ShinyColors-enza-userscript-Traditional-Mandarin.user.js
// @match        https://shinycolors.enza.fun/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      api.interpreter.caiyunai.com
// @connect      translate.google.cn
// @connect      fanyi.baidu.com
// @connect      fonts.googleapis.com
// @connect      fonts.gstatic.com
// @connect      cdn.jsdelivr.net
// ==/UserScript==
/*
 * =========================================================================
 * 偶像大師 Shiny Colors 繁體中文化與字體增強插件
 * (ShinyColors-enza-userscript-Traditional-Mandarin)
 *
 * 專案首頁: https://github.com/vulm30/ShinyColors-enza-userscript-Traditional-Mandarin
 * 授權條款: MIT License
 *
 * 致謝與第三方開源聲明 (Credits & Acknowledgements):
 * 1. 漢化主框架與資料攔截: 原作者 biuuu (https://github.com/biuuu/ShinyColors) - MIT License
 * 2. 繁簡中文轉換詞庫與字符對照: OpenCC 開放中文轉換 (https://github.com/BYVoid/OpenCC) - Apache 2.0 License
 * 3. 預設推薦字型: justfont / jf open 粉圓 (https://justfont.com/huninn/) - SIL Open Font License 1.1
 * =========================================================================
 */
!function(){"use strict";
`;

const finalScript = header + s2tEngineCode + '\n' + mainLogic;

const dest1 = path.join(__dirname, 'ShinyColors-enza-userscript-Traditional-Mandarin.user.js');

fs.writeFileSync(dest1, finalScript, 'utf8');

console.log('Successfully compiled lightweight ShinyColors-tw.user.js!');
console.log('File size:', finalScript.length, 'characters (~', Math.round(finalScript.length / 1024), 'KB)');
