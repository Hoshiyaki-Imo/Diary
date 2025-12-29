function doGet() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    return HtmlService.createHtmlOutput("ログインしてください");
  }

  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("日記アプリ");
}

/* ===== 保存 ===== */
function saveDiary(text) {
  if (!Session.getActiveUser().getEmail()) {
    throw new Error("Unauthorized");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = ("0" + (now.getMonth() + 1)).slice(-2);
  const filename = `Diary_${year}${month}.txt`;

  const diaryFolder = getOrCreateFolder_("Diary");
  const yearFolder = getOrCreateFolder_(String(year), diaryFolder);
  const file = getOrCreateFile_(filename, yearFolder);

  const entry =
    `【${now.toLocaleString()}】\n` +
    text + "\n" +
    "--------------------\n";

  const old = file.getBlob().getDataAsString("UTF-8");
  file.setContent(old + entry);

  return "保存しました";
}

/* ===== 存在チェック ===== */
function diaryExists(year, month) {
  const filename = `Diary_${year}${month}.txt`;
  const diaryFolder = getOrCreateFolder_("Diary");
  const yearFolder = getOrCreateFolder_(String(year), diaryFolder);
  const files = yearFolder.getFilesByName(filename);
  return files.hasNext();
}

/* ===== 読み込み ===== */
function loadDiary(year, month) {
  const filename = `Diary_${year}${month}.txt`;
  const diaryFolder = getOrCreateFolder_("Diary");
  const yearFolder = getOrCreateFolder_(String(year), diaryFolder);
  const files = yearFolder.getFilesByName(filename);

  if (!files.hasNext()) {
    return "この月の日記は存在しません";
  }
  return files.next().getBlob().getDataAsString("UTF-8");
}

/* ===== エクスポート ===== */
function exportYear(year) {
  const diaryFolder = getOrCreateFolder_("Diary");
  const yearFolder = getOrCreateFolder_(String(year), diaryFolder);

  const blobs = [];
  const files = yearFolder.getFiles();
  while (files.hasNext()) {
    blobs.push(files.next().getBlob());
  }

  if (blobs.length === 0) {
    throw new Error("その年の日記はありません");
  }

  const zip = Utilities.zip(blobs, `Diary_${year}.zip`);
  const file = DriveApp.createFile(zip);
  return file.getDownloadUrl();
}

/* ===== 補助関数 ===== */
function getOrCreateFolder_(name, parent = null) {
  const folders = parent
    ? parent.getFoldersByName(name)
    : DriveApp.getFoldersByName(name);

  if (folders.hasNext()) return folders.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function getOrCreateFile_(name, folder) {
  const files = folder.getFilesByName(name);
  if (files.hasNext()) return files.next();
  return folder.createFile(name, "", MimeType.PLAIN_TEXT);
}
