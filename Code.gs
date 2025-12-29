function doGet() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    return HtmlService.createHtmlOutput("ログインしてください");
  }

  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("日記");
}

function saveDiary(text) {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error("未認証ユーザー");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = ("0" + (now.getMonth() + 1)).slice(-2);
  const filename = `Diary_${year}${month}.txt`;

  // ① Diary フォルダ取得 or 作成
  const diaryFolder = getOrCreateFolder_("Diary");

  // ② 年フォルダ取得 or 作成
  const yearFolder = getOrCreateFolder_(String(year), diaryFolder);

  // ③ 月ファイル取得 or 作成
  const file = getOrCreateFile_(filename, yearFolder);

  // ④ 追記
  const timestamp = now.toLocaleString();
  const content =
    `【${timestamp}】\n` +
    text + "\n" +
    "--------------------\n";

  file.setContent(file.getBlob().getDataAsString("UTF-8") + content);

  return "保存完了";
}

function getOrCreateFolder_(name, parentFolder = null) {
  const folders = parentFolder
    ? parentFolder.getFoldersByName(name)
    : DriveApp.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder
    ? parentFolder.createFolder(name)
    : DriveApp.createFolder(name);
}

function getOrCreateFile_(name, folder) {
  const files = folder.getFilesByName(name);

  if (files.hasNext()) {
    return files.next();
  }

  return folder.createFile(name, "", MimeType.PLAIN_TEXT);
}
