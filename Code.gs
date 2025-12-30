const ROOT_FOLDER_NAME = "MyDiaryApp";

function doGet() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("DIARY")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

/* ===== フォルダ操作補助（一意性を厳格に担保する修正版） ===== */
function getRootFolder_() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  // 複数ある場合は最初の一つを使い、なければ作成
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getSubFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  // 指定された親フォルダ直下にある同名フォルダを確認
  // 既存の11や12が複数ある問題に対し、最初に見つかったものに集約させる
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

/* ===== 保存機能（既存のタイムスタンプ・画像処理ロジックを完全維持） ===== */
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
    content: text,
    emotion: emotion,
    studyTime: studyTime || 0,
    image: imageData, // base64
    updatedAt: timestamp
  };

  const files = monthFolder.getFilesByName(fileName);
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(data));
  } else {
    monthFolder.createFile(fileName, JSON.stringify(data), MimeType.PLAIN_TEXT);
  }
  return { status: "ok" };
}

/* ===== 取得機能（完全維持） ===== */
function getDiaryContent(year, month, name) {
  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year.toString());
  const monthFolder = getSubFolder_(yearFolder, month.toString().padStart(2, "0"));
  const files = monthFolder.getFilesByName(name + ".json");
  if (!files.hasNext()) return null;
  return JSON.parse(files.next().getBlob().getDataAsString());
}

/* ===== 削除機能（完全維持） ===== */
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

/* ===== 履歴リスト取得（既存のプレビュー生成・ソートロジックを維持） ===== */
function getDiaryList(year, month) {
  const root = getRootFolder_();
  const yf = getSubFolder_(root, year ? year.toString() : new Date().getFullYear().toString());
  const mf = getSubFolder_(yf, month ? month.toString().padStart(2, "0") : (new Date().getMonth()+1).toString().padStart(2, "0"));
  const files = mf.getFiles();
  const list = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().endsWith(".json")) {
      const json = JSON.parse(file.getBlob().getDataAsString());
      list.push({ 
        name: file.getName().replace(".json",""),
        preview: json.content ? json.content.substring(0, 30) : "",
        emotion: json.emotion || "normal",
        hasImage: !!json.image
      });
    }
  }
  return list.sort((a, b) => b.name.localeCompare(a.name));
}

/* ===== 学習統計機能（既存の高度な配列生成ロジックを完全維持） ===== */
function getDetailedStudyStats(year, month) {
  const list = getDiaryList(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // 日別データの生成
  const daily = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    const found = list.find(x => x.name === dStr);
    if (found) {
      const detail = getDiaryContent(year, month, dStr);
      daily.push({ day: i, time: parseInt(detail.studyTime) || 0 });
    } else {
      daily.push({ day: i, time: 0 });
    }
  }

  // 月別データの生成（年推移用ロジックを維持）
  const monthly = [];
  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year.toString());
  for (let m = 1; m <= 12; m++) {
    let monthTotal = 0;
    const mStr = m.toString().padStart(2, "0");
    const mf = yearFolder.getFoldersByName(mStr);
    if (mf.hasNext()) {
      const files = mf.next().getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if (f.getName().endsWith(".json")) {
          const json = JSON.parse(f.getBlob().getDataAsString());
          monthTotal += (parseInt(json.studyTime) || 0);
        }
      }
    }
    monthly.push({ month: m, time: monthTotal });
  }

  return { daily: daily, monthly: monthly };
}

/* ===== 【新設】目標管理（スプレッドシート連携・指示内容） ===== */
/**
 * スプレッドシートの "Goals" シートから目標データを取得
 */
function getGoalsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let goalSheet = ss.getSheetByName("Goals");
  if (!goalSheet) return [];

  const data = goalSheet.getDataRange().getValues();
  // ヘッダーを除いたデータをオブジェクト配列化
  return data.slice(1).map(row => ({
    type: row[0],      // 'monthly' or 'yearly'
    content: row[1],   // 目標内容
    locked: row[2],    // ロック状態 (true/false)
    updatedAt: row[3]  // 更新日時
  }));
}

/**
 * スプレッドシートに目標を保存・更新
 */
function saveGoalToSheet(type, content, locked) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let goalSheet = ss.getSheetByName("Goals");
  
  // シートがない場合は作成しヘッダーを付与
  if (!goalSheet) {
    goalSheet = ss.insertSheet("Goals");
    goalSheet.appendRow(["type", "content", "locked", "updated_at"]);
  }
  
  const data = goalSheet.getDataRange().getValues();
  let rowIdx = -1;
  
  // 既存のタイプ（今月/年間）があるか探索
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === type) {
      rowIdx = i + 1;
      break;
    }
  }
  
  const now = new Date();
  if (rowIdx > 0) {
    // 既存行の更新
    goalSheet.getRange(rowIdx, 2, 1, 3).setValues([[content, locked, now]]);
  } else {
    // 新規行の追加
    goalSheet.appendRow([type, content, locked, now]);
  }
  return { status: "ok" };
}

/* ===== その他補助機能（必要に応じて維持） ===== */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ドライブ上の設定ファイルを取得または作成する内部関数
 */
function getGoalFile_() {
  const fileName = "goals_data.json";
  const files = DriveApp.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next();
  }
  // ファイルがなければ初期状態で作成
  return DriveApp.createFile(fileName, JSON.stringify({}), MimeType.PLAIN_TEXT);
}

function getYearlyGoal() {
  const file = getGoalFile_();
  const data = JSON.parse(file.getContent());
  return data['yearly'] || null;
}

function getGoalFromSheet(type) {
  const file = getGoalFile_();
  const data = JSON.parse(file.getContent());
  return data[type] || null;
}

function saveGoalToSheet(type, content, locked) {
  const file = getGoalFile_();
  const data = JSON.parse(file.getContent());
  
  data[type] = {
    type: type,
    content: content,
    locked: locked,
    updatedAt: new Date().toISOString()
  };
  
  file.setContent(JSON.stringify(data));
  return { status: "ok" };
}