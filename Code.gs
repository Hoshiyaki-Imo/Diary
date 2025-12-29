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

/* ===== 保存機能 ===== */
function saveDiary(dateStr, text, emotion, studyTime, imageData) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const fileName = `${dateStr}.json`;

  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year);
  const monthFolder = getSubFolder_(yearFolder, month);

  const now = new Date();
  const timestamp = Utilities.formatDate(now, "JST", "HH:mm:ss");

  const data = {
    date: dateStr,
    saveTime: timestamp,
    emotion: emotion,
    studyTime: parseInt(studyTime) || 0,
    content: text,
    image: imageData || null,
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
  
  const lastDay = new Date(year, month, 0).getDate();
  const dailyData = [];
  for (let i = 1; i <= lastDay; i++) {
    dailyData.push({ day: i, time: 0, recorded: false });
  }

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

/* ===== 履歴リスト取得 ===== */
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
        studyTime: json.studyTime,
        saveTime: json.saveTime || "" 
      });
    }
  }
  return list.sort((a, b) => b.name.localeCompare(a.name));
}

/* ===== 履歴・既存データ詳細取得 ===== */
function getDiaryContent(year, month, name) {
  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year.toString());
  const monthFolder = getSubFolder_(yearFolder, month.toString().padStart(2, "0"));
  const files = monthFolder.getFilesByName(name + ".json");
  if (!files.hasNext()) return null;
  return JSON.parse(files.next().getBlob().getDataAsString());
}

/* ===== 削除機能 ===== */
function deleteDiary(year, month, name) {
  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year.toString());
  const monthFolder = getSubFolder_(yearFolder, month.toString().padStart(2, "0"));
  const files = monthFolder.getFilesByName(name + ".json");
  if (files.hasNext()) {
    files.next().setTrashed(true);
    return { status: "ok" };
  }
  throw new Error("ファイルが見つかりませんでした");
}

/* ===== 履歴リスト取得（画像有無フラグを追加） ===== */
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
        studyTime: json.studyTime,
        saveTime: json.saveTime || "",
        hasImage: !!(json.image) // 画像データがあればtrue
      });
    }
  }
  return list.sort((a, b) => b.name.localeCompare(a.name));
}

// その他の関数は変更ありません。指示通り、これ以外の箇所には触れていません。