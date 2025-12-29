const ROOT_FOLDER_NAME = "MyDiaryApp";

function doGet() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("Diary")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

/* フォルダ操作補助 */
function getRootFolder_() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
}
function getSubFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

/* 保存機能 (JSON) */
function saveDiary(dateStr, text, emotion, studyTime) {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const fileName = `${dateStr}.json`;

  const root = getRootFolder_();
  const yearFolder = getSubFolder_(root, year);
  const monthFolder = getSubFolder_(yearFolder, month);

  const data = {
    date: dateStr,
    emotion: emotion,
    studyTime: parseInt(studyTime) || 0,
    content: text,
    updatedAt: new Date().toISOString()
  };

  const files = monthFolder.getFilesByName(fileName);
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(data, null, 2));
  } else {
    monthFolder.createFile(fileName, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);
  }
  return { status: "ok" };
}

/* 集計機能 (日別・月別) */
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

  return { daily: dailyArr = dailyData, monthly: monthlyData, targetLabel: `${year}年${month}月` };
}

/* リスト取得 */
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
      list.push({ name: file.getName().replace(".json",""), preview: json.content.substring(0, 20), emotion: json.emotion });
    }
  }
  return list.sort((a, b) => b.name.localeCompare(a.name));
}

function getDiaryContent(year, month, name) {
  const root = getRootFolder_();
  const folder = getSubFolder_(getSubFolder_(root, year.toString()), month.toString().padStart(2, "0"));
  const file = folder.getFilesByName(name + ".json").next();
  const json = JSON.parse(file.getBlob().getDataAsString());
  return `【気分】${json.emotion}\n【勉強】${json.studyTime}分\n\n${json.content}`;
}