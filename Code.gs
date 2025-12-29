/* ===== 設定 ===== */
const ROOT_FOLDER_NAME = "Diary";

/* ===== Webアプリ入口 ===== */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Diary");
}

/* ===== 日記保存（統計ロジック修正版） ===== */
function saveDiary(dateStr, text) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const fileName = `${dateStr}.txt`;

  const root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  const yearFolder = getOrCreateFolder_(root, year);
  const monthFolder = getOrCreateFolder_(yearFolder, month);

  const files = monthFolder.getFilesByName(fileName);
  let isNewFile = !files.hasNext(); // ファイルが存在しなければ新規

  if (!isNewFile) {
    // すでにファイルがある場合は内容を更新（上書き）
    const file = files.next();
    file.setContent(text);
  } else {
    // ない場合は新しく作成
    monthFolder.createFile(fileName, text, MimeType.PLAIN_TEXT);
  }

  // 最新の連続記録を計算
  const streakInfo = getCurrentStreak_();

  // その月の最新の統計（ファイル数）を取得
  const stats = getMonthlyStatsForDate_(year, month);
  
  // 【ここが重要】ドライブの反映ラグ対策
  // 新規作成した直後は countFilesInFolder_ がまだ 0 を返すことがあるため、
  // 新規保存(isNewFile=true)なら、最低でも 1 以上のカウントを保証して返します。
  if (isNewFile && stats.count === 0) {
    stats.count = 1;
  }

  return { 
    status: isNewFile ? "new" : "overwrite", 
    streak: streakInfo.streak,
    monthStats: stats 
  };
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