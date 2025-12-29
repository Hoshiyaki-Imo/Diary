/* ===== 設定 ===== */
const ROOT_FOLDER_NAME = "Diary";

/* ===== Webアプリ入口 ===== */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Diary");
}

/* ===== 日記保存（感情・振り返り対応） ===== */
function saveDiary(dateStr, text, emotion) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const fileName = `${dateStr}.txt`;

  const root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  const yearFolder = getOrCreateFolder_(root, year);
  const monthFolder = getOrCreateFolder_(yearFolder, month);

  // 1行目に感情、2行目以降に本文を保存
  const fullContent = `【感情：${emotion}】\n${text}`;

  const files = monthFolder.getFilesByName(fileName);
  let isNewFile = !files.hasNext();

  if (!isNewFile) {
    files.next().setContent(fullContent);
  } else {
    monthFolder.createFile(fileName, fullContent, MimeType.PLAIN_TEXT);
  }

  const streakInfo = getCurrentStreak_();
  const stats = getMonthlyStatsForDate_(year, month);
  if (isNewFile && stats.count === 0) stats.count = 1;

  // 7日前の日記を取得
  const prevDate = new Date(date);
  prevDate.setDate(date.getDate() - 7);
  const pastDiary = getDiaryContentByDate_(prevDate);

  return { 
    status: isNewFile ? "new" : "overwrite", 
    streak: streakInfo.streak,
    monthStats: stats,
    pastDiary: pastDiary 
  };
}

/* 特定の日付から日記を検索するヘルパー */
function getDiaryContentByDate_(dateObj) {
  const y = dateObj.getFullYear().toString();
  const m = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const d = dateObj.toISOString().slice(0, 10);
  
  const root = getRootFolder_();
  if (!root) return null;
  const yf = getSubFolder_(root, y);
  if (!yf) return null;
  const mf = getSubFolder_(yf, m);
  if (!mf) return null;
  
  const files = mf.getFilesByName(`${d}.txt`);
  if (files.hasNext()) {
    return { date: d, content: files.next().getBlob().getDataAsString() };
  }
  return null;
}

/* ===== 月別一覧取得 ===== */
function getDiaryList(year, month) {
  const root = getRootFolder_();
  if (!root) return [];
  const yearFolder = getSubFolder_(root, year);
  if (!yearFolder) return [];
  const monthFolder = getSubFolder_(yearFolder, month);
  if (!monthFolder) return [];

  const files = monthFolder.getFiles();
  const result = [];
  while (files.hasNext()) {
    const file = files.next();
    result.push({
      name: file.getName(),
      preview: file.getBlob().getDataAsString().substring(0, 40)
    });
  }
  // 日付順
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

/* ===== 内容取得 ===== */
function getDiaryContent(year, month, fileName) {
  const root = getRootFolder_();
  if (!root) return "";
  const yearFolder = getSubFolder_(root, year);
  if (!yearFolder) return "";
  const monthFolder = getSubFolder_(yearFolder, month);
  if (!monthFolder) return "";
  const files = monthFolder.getFilesByName(fileName);
  return files.hasNext() ? files.next().getBlob().getDataAsString() : "";
}

/* HTML側から呼び出される統計取得関数 */
function getMonthlyStats(year, month) {
  if (!year || !month) {
    const now = new Date();
    year = String(now.getFullYear());
    month = String(now.getMonth() + 1).padStart(2, "0");
  }
  return getMonthlyStatsForDate_(year, month);
}

/* 指定月の統計計算 */
function getMonthlyStatsForDate_(year, month) {
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const root = getRootFolder_();
  if (!root) return { count: 0, daysInMonth: daysInMonth };
  
  const yearFolder = getSubFolder_(root, year);
  if (!yearFolder) return { count: 0, daysInMonth: daysInMonth };
  
  const monthFolder = getSubFolder_(yearFolder, month);
  if (!monthFolder) return { count: 0, daysInMonth: daysInMonth };

  // フォルダ内のファイルを数える
  const files = monthFolder.getFiles();
  let count = 0;
  while (files.hasNext()) {
    files.next();
    count++;
  }

  return { count: count, daysInMonth: daysInMonth };
}


/* ===== ユーティリティ ===== */
function getRootFolder_() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : null;
}
function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}
function getSubFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : null;
}

/* ===== 連続記録計算（最新版） ===== */
function getCurrentStreak_() {
  const root = getRootFolder_();
  if (!root) return { streak: 0 };

  // 「今日」または「昨日」を起点にする
  // これにより、昨日分を今日書いても記録がつながる
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  // 今日書いているかチェック
  if (checkFileExists_(root, today)) {
    return calculateStreakFrom_(root, today);
  } 
  // 今日書いてないけど、昨日はあるかチェック（継続中扱い）
  else if (checkFileExists_(root, yesterday)) {
    return calculateStreakFrom_(root, yesterday);
  }
  
  // どちらもなければ0日
  return { streak: 0 };
}

// 指定日から過去へ遡ってカウントする関数
function calculateStreakFrom_(root, startDate) {
  let streak = 0;
  let current = new Date(startDate);

  while (true) {
    if (checkFileExists_(root, current)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }
  return { streak };
}

// 特定の日付のファイルがあるか確認するヘルパー
function checkFileExists_(root, dateObj) {
  const y = dateObj.getFullYear().toString();
  const m = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const d = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD

  const yearFolder = getSubFolder_(root, y);
  if (!yearFolder) return false;

  const monthFolder = getSubFolder_(yearFolder, m);
  if (!monthFolder) return false;

  const files = monthFolder.getFilesByName(`${d}.txt`);
  return files.hasNext();
}