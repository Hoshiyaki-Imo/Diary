/* ===== 設定 ===== */
const ROOT_FOLDER_NAME = "Diary";

/* ===== Webアプリ入口 ===== */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Diary");
}

/* ===== 日記保存 ===== */
function saveDiary(dateStr, text) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = dateStr; // YYYY-MM-DD

  const root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  const yearFolder = getOrCreateFolder_(root, year);
  const monthFolder = getOrCreateFolder_(yearFolder, month);

  const fileName = `${day}.txt`;
  const files = monthFolder.getFilesByName(fileName);

  if (files.hasNext()) {
    // 上書き
    const file = files.next();
    file.setContent(text);
    return { status: "overwrite" };
  } else {
    // 新規作成
    monthFolder.createFile(fileName, text, MimeType.PLAIN_TEXT);
    const streakInfo = getStreakInfo_(dateStr);
    return { status: "new", streak: streakInfo.streak };

  }
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
    const content = file.getBlob().getDataAsString();
    result.push({
      name: file.getName(),
      preview: content.substring(0, 40)
    });
  }

  // 日付順に並び替え
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
  if (!files.hasNext()) return "";

  return files.next().getBlob().getDataAsString();
}

/* ===== フォルダ取得／作成ユーティリティ ===== */
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

function getStreakInfo_(dateStr) {
  const root = getRootFolder_();
  if (!root) return { streak: 1 };

  let streak = 0;
  let current = new Date(dateStr);

  while (true) {
    const y = current.getFullYear().toString();
    const m = (current.getMonth() + 1).toString().padStart(2, "0");
    const d = current.toISOString().slice(0, 10);

    const yearFolder = getSubFolder_(root, y);
    if (!yearFolder) break;

    const monthFolder = getSubFolder_(yearFolder, m);
    if (!monthFolder) break;

    const files = monthFolder.getFilesByName(`${d}.txt`);
    if (!files.hasNext()) break;

    streak++;
    current.setDate(current.getDate() - 1);
  }

  return { streak };
}
