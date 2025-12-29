const ROOT_FOLDER_NAME = "MyDiaryApp";

function doGet() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("Diary")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

/* ===== フォルダ操作補助 ===== */
function getRootFolder_() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getSubFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

/* ===== 保存機能（保存時刻の秒単位記録） ===== */
function saveDiary(dateStr, text, emotion, studyTime) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const fileName = `${dateStr}.json`;

  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year);
  const monthFolder = getSubFolder_(yearFolder, month);

  // 現在時刻を詳細に取得 (HH:mm:ss形式)
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "JST", "HH:mm:ss");

  const data = {
    date: dateStr,
    saveTime: timestamp, // 保存・更新時刻
    emotion: emotion,
    studyTime: parseInt(studyTime) || 0,
    content: text,
    updatedAt: now.toISOString()
  };

  const files = monthFolder.getFilesByName(fileName);
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(data, null, 2));
  } else {
    monthFolder.createFile(fileName, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);
  }
  return { status: "ok" };
}

/* ===== 集計機能 (日別・月別) ===== */
function getDetailedStudyStats(year, month) {
  const root = getRootFolder_();
  const yf = getSubFolder_(root, year.toString());
  
  // 日別データの初期化
  const lastDay = new Date(year, month, 0).getDate();
  const dailyData = [];
  for (let i = 1; i <= lastDay; i++) {
    dailyData.push({ day: i, time: 0, recorded: false });
  }

  // 当月の読み込み
  const mf = getSubFolder_(yf, month.toString().padStart(2, "0"));
  const files = mf.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().endsWith(".json")) {
      const json = JSON.parse(file.getBlob().getDataAsString());
      const d = parseInt(file.getName().slice(8, 10));
      if (dailyData[d - 1]) {
        dailyData[d - 1].time = json.studyTime || 0;
        dailyData[d - 1].recorded = true;
      }
    }
  }

  // 年間（月別）の読み込み
  const monthlyData = [];
  for (let m = 1; m <= 12; m++) {
    let mTotal = 0;
    const mFolder = getSubFolder_(yf, m.toString().padStart(2, "0"));
    const mFiles = mFolder.getFiles();
    while (mFiles.hasNext()) {
      const f = mFiles.next();
      if (f.getName().endsWith(".json")) {
        mTotal += JSON.parse(f.getBlob().getDataAsString()).studyTime || 0;
      }
    }
    monthlyData.push({ month: m, time: mTotal });
  }

  return { daily: dailyData, monthly: monthlyData, targetLabel: `${year}年${month}月` };
}

/* ===== 履歴リスト取得（更新時間saveTimeを含む） ===== */
function getDiaryList(year, month) {
  const root = getRootFolder_();
  const yf = getSubFolder_(root, year.toString());
  const mf = getSubFolder_(yf, month.toString().padStart(2, "0"));
  const files = mf.getFiles();
  const list = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().endsWith(".json")) {
      const json = JSON.parse(file.getBlob().getDataAsString());
      list.push({ 
        name: file.getName().replace(".json",""), 
        preview: json.content.substring(0, 20), 
        emotion: json.emotion,
        saveTime: json.saveTime || "" // 更新時間
      });
    }
  }
  // 日付の降順（新しい順）でソート
  return list.sort((a, b) => b.name.localeCompare(a.name));
}

/* ===== 履歴詳細取得 ===== */
function getDiaryContent(year, month, name) {
  const root = getRootFolder_();
  const folder = getSubFolder_(getSubFolder_(root, year.toString()), month.toString().padStart(2, "0"));
  const file = folder.getFilesByName(name + ".json").next();
  const json = JSON.parse(file.getBlob().getDataAsString());
  
  const timeInfo = json.saveTime ? `（最終更新：${json.saveTime}）` : "";
  return `【気分】${json.emotion}${timeInfo}\n【勉強】${json.studyTime}分\n\n${json.content}`;
}

/* ===== 既存の関数は維持しつつ、以下を追加・修正 ===== */

// 削除機能：指定されたファイルをゴミ箱へ移動（または完全削除）
function deleteDiary(year, month, name) {
  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year.toString());
  const monthFolder = getSubFolder_(yearFolder, month.toString().padStart(2, "0"));
  
  const files = monthFolder.getFilesByName(name + ".json");
  if (files.hasNext()) {
    const file = files.next();
    file.setTrashed(true); // 安全のためゴミ箱へ移動
    return { status: "ok" };
  }
  throw new Error("ファイルが見つかりませんでした");
}