# 外部依賴盤點

**目的**：任一外部服務變更或停止時，知道會壞在哪裡、有沒有備案。

**盤點日期**：2026-08-31
**盤點方式**：`.user.js` 全文抽取所有 URL 逐一回讀使用點（不是看 `@connect` 宣告，宣告與實際呼叫不一致，見文末發現三），存活狀態以單次 HTTP HEAD 實測。
**適用版本**：`@version 1.13.8`

---

## 一、核心依賴（會直接影響能不能玩）

### 1. `www.shiny.fun` — 漢化資料來源 🔴 唯一的單點故障

| 項目 | 內容 |
|---|---|
| 抓什麼 | `/manifest.json` 與 `/data/` 底下的譯文檔 |
| 程式位置 | `const {origin: Wr} = T`，`T.origin` 預設 `https://www.shiny.fun` |
| 誰的服務 | 上游作者 biuuu，**不是我們的** |
| 存活實測 | ✅ 200 |

**壞掉會怎樣**：抓不到新譯文。但**不會立刻失效**，因為：

- `localStorage` 有兩層快取：`sczh:manifest`（清單）與 `sczh:data`（譯文本體）
- 快取的時效檢查是 `Date.now() - e.time > 60 * T.cacheTime * 1000`，而**`T.cacheTime` 在預設設定物件中不存在**（實查 `T = {origin, ai_host, hash, localHash, version, story, timeout, font1, font2, auto, bgm, transCover, dev}`，`cacheTime` 全檔只出現在這個比較式裡）。`undefined` 參與運算得 `NaN`，比較恆為 false，**所以時間過期永遠不會觸發**
- 更新改由版本比對驅動，且版本相同時走 `setTimeout(qr, 5000)` 背景刷新，不阻斷畫面

→ **實際效果是離線仍可用舊快取**。這是巧合而非設計（時效檢查其實是壞的），但結果對我們有利。
※ 上述為讀碼判定，未做斷網實測。

**備案（已內建，不必寫程式）**：Tampermonkey 選單有「**修改資料來源**」，可換成任意 URL。

已驗證這個備案真的會生效：設定讀取（檔案位置 57512）發生在 `origin` 解構（74648）**之前**，所以自訂值會被採用，不會被預設值蓋掉。

→ 若上游停站，可指向自架鏡像或社群鏡像。**建議事前備份一份 `manifest.json` 與 `data/`，否則屆時無處可指。**

### 2. `shinycolors.enza.fun` — 遊戲本體

`@match` 目標與 `@icon` 來源。遊戲收攤的話整個腳本失去意義，無備案可談。

---

## 二、譯文的三層 fallback（這三個是一條鏈，不是三個獨立功能）

🔴 **2026-08-31 更正**：本節原把 `ai.shiny.fun` 記為「LLM 即時機翻，執行時生成」。**那是錯的**，讀碼後確認它是**靜態檔主機**，提供預先生成好的 AI 譯文 CSV。原記述來自未查證的推測。

一段劇情要顯示時，程式依序嘗試：

| 層 | 來源 | 形態 | 何時用 |
|---|---|---|---|
| ① | `www.shiny.fun/data/story/<id>.csv` | **人工翻譯**，品質最好 | 一律優先 |
| ② | `ai.shiny.fun/story.json` → `/story/<t>.csv` | **預先生成的 AI 譯文靜態 CSV** | ①沒有該檔，且「機翻」設定為 on |
| ③ | `api.interpreter.caiyunai.com` | **即時翻譯**，把當下日文台詞送出去翻（4KB 分塊） | ②也沒有 |

實測（2026-08-31）：`ai.shiny.fun/story.json` ✅ 200、49,093 bytes、**索引 1,037 個劇情檔**。

### 🔴 三層其實全部吊在 `www.shiny.fun` 上

`manifest.json` 的欄位實測為：`hash, version, hashes, moduleId, cyweb_token, trans_api, language, ai_host, date`。

- **第③層的彩雲 token 來自 manifest 的 `cyweb_token`**（程式碼寫 `Gr.data.cyweb_token`，`Gr.data` 即 manifest）
- 供應商也由 manifest 決定（`Gr.data.trans_api`，實測值 `caiyun`，程式碼中只有 `"caiyun" === e` 一個分支）

→ **manifest 拿不到 = 三層全滅**，不只第①層。單點故障比原先記述更集中。

備註：manifest 帶了 `ai_host` 欄位，但這個版本的程式碼**沒有讀它**（`ai_host` 全檔 4 個出現點皆為 `T.ai_host`，無一來自 manifest）。

### 其他

| 服務 | 用途 | 壞掉會怎樣 | 備案 |
|---|---|---|---|
| `comic.shiny.fun` | 四格漫畫的中文版圖與標題（`/4ko.json`、`/4ko/`） | 顯示原版圖 | ✅ 程式有 `try/catch` 回退空 Map，不會拋錯 |

存活實測：`comic.shiny.fun/4ko.json` ✅ 200。

### 端點可用 URL hash 覆寫（未見於任何說明文件）

`F()` 會解析 `location.hash`，以 `;` 分段、`=` 分鍵值，鍵名須在 `O` 陣列中。`O = P = ["origin","ai_host","font1","font2","timeout","story","auto","bgm","dev","transCover"]`。

→ **`origin` 與 `ai_host` 都可以直接用網址覆寫**，例如在遊戲網址後接 `#ai_host=https://<自架位置>`。這是切換備援來源最快的方式，比選單更直接（選單只提供「修改資料來源」＝`origin`，沒有 `ai_host` 的入口）。
※ 此為讀碼判定，未實機驗證。

---

## 三、外觀依賴（壞了只是字型變了，文字仍可讀）

| 服務 | 用途 | 存活實測 |
|---|---|---|
| `cdn.jsdelivr.net` | jf open 粉圓 webfont（`justfont/open-huninn-font@master`） | ✅ 200 |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Zen Maru Gothic、Noto Sans TC | ✅ 200 |

**備案已內建**：`TW_FONT_FAMILY` 是一條七層的 fallback 鏈，前四層都是 `local()`（使用者自己裝的字型），CDN 掛了會依序退到 `Microsoft JhengHei`、`PingFang TC`、`sans-serif`。

→ **最穩的做法是本機安裝 jf open 粉圓**，那樣完全不碰 CDN。

---

## 四、非執行期依賴（只在開發與建置時用到）

| 依賴 | 用途 | 風險 |
|---|---|---|
| Node.js 內建 `fs`／`path` | `builder.js` 的唯一依賴 | **零 npm 套件**，沒有供應鏈風險 |
| OpenCC 字典檔 | 字典來源（人工取用後落地成 `s2t_dict.json`） | 不在執行期。上游消失也不影響已落地的字典 |
| `biuuu/ShinyColors` gh-pages 語料 | 選字判斷的證據 | 僅本機分析，不進 repo、不在執行期 |
| `raw.githubusercontent.com` | `@updateURL`／`@downloadURL` 自動更新 | 壞掉只是不會自動更新，遊戲照常 |

---

## 五、盤點時的三個發現

### 發現一：CDN 上已有 `2.1` 版字型，但程式載的是 `2.0`

`TW_FONT_FAMILY` 的前兩層寫的是 `jf open 粉圓 2.1`／`jf-openhuninn-2.1`，但 CDN 的 `url()` 指向 `jf-openhuninn-2.0.ttf`。

實測 `jf-openhuninn-2.1.ttf` 在同一路徑下**存在且回 200**。

→ 意圖是 2.1，實際載 2.0。**改一個字串即可對齊**，但那會改變畫面外觀，屬待裁示、非 bug。

### 發現二：`@connect` 宣告了兩個從未被呼叫的網域

`translate.google.cn` 與 `fanyi.baidu.com` 各只出現一次，**都在 metadata 區塊裡**，程式碼中零呼叫。

→ 殘留宣告。移除可縮小腳本的網路權限面，屬清理項、無功能影響。

### 發現三：不要用 `@connect` 當依賴清單

`@connect` 宣告的網域與實際會連的網域**兩邊都不完整**：宣告了沒在用的（發現二），實際在用的 `www.shiny.fun`／`ai.shiny.fun`／`comic.shiny.fun` 三個核心網域**反而沒有宣告**（它們走 `fetch` 而非 `GM_xmlhttpRequest`，不受 `@connect` 管）。

→ **盤點依賴一律從程式碼的實際呼叫點反查，不看宣告。**

---

## 六、下次重跑盤點的方式

```powershell
# 1. 抽出所有 URL
$t=[IO.File]::ReadAllText('ShinyColors-enza-userscript-Traditional-Mandarin.user.js')
[regex]::Matches($t,'https?://[^\s''"`)\\,;]+') | ForEach-Object { $_.Value } |
  Group-Object | Sort-Object Count -Descending

# 2. 逐一回讀使用點，判斷是實際呼叫還是註解／宣告
#    （關鍵字：fetch(、GM_xmlhttpRequest、url(、.href）

# 3. 存活實測
Invoke-WebRequest -Uri <url> -Method Head -UseBasicParsing -TimeoutSec 12
```

**判讀注意**：API 主機的根路徑回 404 是正常的，不能據此判定服務已停。
