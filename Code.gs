/**
 * MyDiary Implementation - Complete Strict Specification Compliance
 * File Structure: MyDiary/YYYY/MM/DD.json, MyDiary/YYYY/MM/image/YYYYMMDD.png
 */

// ----------------------------------------------------------------
// Constants & Config
// ----------------------------------------------------------------
const ROOT_FOLDER_NAME = 'MyDiary';
const TIMEZONE = 'Asia/Tokyo';

// ----------------------------------------------------------------
// Web App Entry Point
// ----------------------------------------------------------------
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Diary')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ----------------------------------------------------------------
// File System Helpers
// ----------------------------------------------------------------
function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function getRootFolder() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getYearFolder(year) {
  const root = getRootFolder();
  return getOrCreateFolder(root, year.toString());
}

function getMonthFolder(year, month) {
  const yFolder = getYearFolder(year);
  const mString = ("0" + month).slice(-2);
  return getOrCreateFolder(yFolder, mString);
}

function getImageFolder(year, month) {
  const mFolder = getMonthFolder(year, month);
  return getOrCreateFolder(mFolder, 'image');
}

function getMemoFolder() {
  const root = getRootFolder();
  return getOrCreateFolder(root, 'Memo');
}

// ----------------------------------------------------------------
// Date Helpers (JST)
// ----------------------------------------------------------------
function getJstDate() {
  const now = new Date();
  return new Date(Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
}

function formatDateJST(date, format) {
  return Utilities.formatDate(date, TIMEZONE, format);
}

function getWeekday(year, month, day) {
  const date = new Date(year, parseInt(month) - 1, parseInt(day));
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return weekdays[date.getDay()];
}

// ----------------------------------------------------------------
// Diary Data Access
// ----------------------------------------------------------------
function getDiaryData(year, month, day) {
  try {
    const mFolder = getMonthFolder(year, month);
    const fname = ("0" + day).slice(-2) + ".json";
    const files = mFolder.getFilesByName(fname);
    
    if (files.hasNext()) {
      const content = files.next().getBlob().getDataAsString();
      const data = JSON.parse(content);
      
      let imageBase64 = null;
      if (data.photo) {
        const imgFolder = getImageFolder(year, month);
        const imgName = year + ("0" + month).slice(-2) + ("0" + day).slice(-2) + ".png";
        const imgFiles = imgFolder.getFilesByName(imgName);
        if (imgFiles.hasNext()) {
          const blob = imgFiles.next().getBlob();
          imageBase64 = "data:image/png;base64," + Utilities.base64Encode(blob.getBytes());
        }
      }
      
      return {
        exists: true,
        data: data,
        image: imageBase64
      };
    }
    
    return { exists: false };
  } catch (e) {
    Logger.log("getDiaryData error: " + e.message);
    return { exists: false };
  }
}

function saveDiary(data, imageBase64) {
  try {
    const mFolder = getMonthFolder(data.year, data.month);
    const fname = ("0" + data.day).slice(-2) + ".json";
    
    const now = getJstDate();
    const updateDay = now.getDate();
    
    const diaryData = {
      year: data.year,
      month: data.month,
      day: data.day,
      time: data.time,
      emotion: data.emotion,
      studyTime: data.studyTime,
      content: data.content,
      photo: data.photo,
      hateMyself: data.hateMyself || "",
      ver: 1.1,
      updateDay: updateDay
    };
    
    const files = mFolder.getFilesByName(fname);
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(JSON.stringify(diaryData));
    } else {
      mFolder.createFile(fname, JSON.stringify(diaryData));
    }
    
    if (imageBase64 && data.photo) {
      const imgFolder = getImageFolder(data.year, data.month);
      const imgName = data.year + ("0" + data.month).slice(-2) + ("0" + data.day).slice(-2) + ".png";
      
      const existingImgFiles = imgFolder.getFilesByName(imgName);
      if (existingImgFiles.hasNext()) {
        existingImgFiles.next().setTrashed(true);
      }
      
      const base64Data = imageBase64.split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', imgName);
      imgFolder.createFile(blob);
    }
    
    return { success: true };
  } catch (e) {
    Logger.log("saveDiary error: " + e.message);
    return { success: false, error: e.message };
  }
}

function checkDiaryExists(year, month, day) {
  try {
    const mFolder = getMonthFolder(year, month);
    const fname = ("0" + day).slice(-2) + ".json";
    const files = mFolder.getFilesByName(fname);
    return files.hasNext();
  } catch (e) {
    return false;
  }
}

function deleteDiary(year, month, day) {
  try {
    const mFolder = getMonthFolder(year, month);
    const fname = ("0" + day).slice(-2) + ".json";
    const files = mFolder.getFilesByName(fname);
    
    if (files.hasNext()) {
      const file = files.next();
      const data = JSON.parse(file.getBlob().getDataAsString());
      
      if (data.photo) {
        const imgFolder = getImageFolder(year, month);
        const imgName = year + ("0" + month).slice(-2) + ("0" + day).slice(-2) + ".png";
        const imgFiles = imgFolder.getFilesByName(imgName);
        if (imgFiles.hasNext()) {
          imgFiles.next().setTrashed(true);
        }
      }
      
      file.setTrashed(true);
      return { success: true };
    }
    
    return { success: false };
  } catch (e) {
    Logger.log("deleteDiary error: " + e.message);
    return { success: false, error: e.message };
  }
}

// ----------------------------------------------------------------
// Streak Calculation with Max Streak
// ----------------------------------------------------------------
function calculateStreakData(year, month, day) {
  try {
    let currentDate = new Date(year + "-" + month + "-" + day);
    let currentStreak = 0;
    let maxStreak = 0;
    let isRecordBreaking = false;
    
    // Check if today has entry
    const todayData = getDiaryData(year, month, day);
    const hasToday = todayData.exists;
    
    // Calculate current streak
    if (hasToday) {
      currentStreak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
      
      for (let i = 0; i < 3650; i++) {
        const y = currentDate.getFullYear();
        const m = ("0" + (currentDate.getMonth() + 1)).slice(-2);
        const d = ("0" + currentDate.getDate()).slice(-2);
        
        const data = getDiaryData(y, m, d);
        if (data.exists) {
          currentStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      // Today has no entry, check yesterday
      currentDate.setDate(currentDate.getDate() - 1);
      const y = currentDate.getFullYear();
      const m = ("0" + (currentDate.getMonth() + 1)).slice(-2);
      const d = ("0" + currentDate.getDate()).slice(-2);
      const yesterdayData = getDiaryData(y, m, d);
      
      if (!yesterdayData.exists) {
        // Both today and yesterday have no entry, streak is 0
        return {
          current: 0,
          max: 0,
          isRecordBreaking: false,
          hasToday: false
        };
      }
      
      // Yesterday has entry, count from yesterday
      currentStreak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
      
      for (let i = 0; i < 3650; i++) {
        const y = currentDate.getFullYear();
        const m = ("0" + (currentDate.getMonth() + 1)).slice(-2);
        const d = ("0" + currentDate.getDate()).slice(-2);
        
        const data = getDiaryData(y, m, d);
        if (data.exists) {
          currentStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
    
    // Calculate max streak by scanning all entries
    maxStreak = calculateMaxStreak();
    
    // Check if current streak is breaking record
    isRecordBreaking = (currentStreak >= maxStreak && hasToday);
    
    return {
      current: currentStreak,
      max: Math.max(currentStreak, maxStreak),
      isRecordBreaking: isRecordBreaking,
      hasToday: hasToday
    };
  } catch (e) {
    Logger.log("calculateStreakData error: " + e.message);
    return {
      current: 0,
      max: 0,
      isRecordBreaking: false,
      hasToday: false
    };
  }
}

function calculateMaxStreak() {
  try {
    const root = getRootFolder();
    const allDates = [];
    
    // Collect all diary dates
    const yearFolders = root.getFolders();
    while (yearFolders.hasNext()) {
      const yFolder = yearFolders.next();
      const yName = yFolder.getName();
      if (!/^\d{4}$/.test(yName)) continue;
      
      const monthFolders = yFolder.getFolders();
      while (monthFolders.hasNext()) {
        const mFolder = monthFolders.next();
        const mName = mFolder.getName();
        if (mName === 'image' || !/^\d{2}$/.test(mName)) continue;
        
        const files = mFolder.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          const fname = file.getName();
          if (fname.endsWith('.json') && fname !== 'monthGoal.json') {
            const day = fname.replace('.json', '');
            const dateStr = yName + '-' + mName + '-' + day;
            allDates.push(new Date(dateStr));
          }
        }
      }
    }
    
    if (allDates.length === 0) return 0;
    
    // Sort dates
    allDates.sort((a, b) => a - b);
    
    // Calculate longest streak
    let maxStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < allDates.length; i++) {
      const diff = Math.floor((allDates[i] - allDates[i-1]) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return maxStreak;
  } catch (e) {
    Logger.log("calculateMaxStreak error: " + e.message);
    return 0;
  }
}

// ----------------------------------------------------------------
// Study Data
// ----------------------------------------------------------------
function getMonthStudyData(year, month) {
  try {
    const mFolder = getMonthFolder(year, month);
    const files = mFolder.getFiles();
    
    let totalStudyTime = 0;
    const dailyData = {};
    
    while (files.hasNext()) {
      const file = files.next();
      const fname = file.getName();
      
      if (fname.endsWith('.json') && fname !== 'monthGoal.json') {
        try {
          const data = JSON.parse(file.getBlob().getDataAsString());
          const day = parseInt(data.day);
          dailyData[day] = data.studyTime || 0;
          totalStudyTime += (data.studyTime || 0);
        } catch (e) {
          Logger.log("Parse error for file: " + fname);
        }
      }
    }
    
    const goal = getMonthGoal(year, month);
    
    return {
      totalStudyTime: totalStudyTime,
      dailyData: dailyData,
      goal: goal
    };
  } catch (e) {
    Logger.log("getMonthStudyData error: " + e.message);
    return { totalStudyTime: 0, dailyData: {}, goal: 0 };
  }
}

function getYearStudyData(year) {
  try {
    const yFolder = getYearFolder(year);
    const monthlyData = {};
    
    for (let m = 1; m <= 12; m++) {
      const mStr = ("0" + m).slice(-2);
      const studyData = getMonthStudyData(year, mStr);
      monthlyData[m] = studyData.totalStudyTime;
    }
    
    return { monthlyData: monthlyData };
  } catch (e) {
    Logger.log("getYearStudyData error: " + e.message);
    return { monthlyData: {} };
  }
}

function getMonthGoal(year, month) {
  try {
    const mFolder = getMonthFolder(year, month);
    const files = mFolder.getFilesByName('monthGoal.json');
    
    if (files.hasNext()) {
      const content = files.next().getBlob().getDataAsString();
      const data = JSON.parse(content);
      return data.goal || 0;
    }
    
    return 0;
  } catch (e) {
    return 0;
  }
}

function saveMonthGoal(year, month, goal) {
  try {
    const mFolder = getMonthFolder(year, month);
    const fname = 'monthGoal.json';
    
    const files = mFolder.getFilesByName(fname);
    if (files.hasNext()) {
      const file = files.next();
      const existing = JSON.parse(file.getBlob().getDataAsString());
      if (existing.setAt) {
        return { success: false, error: 'already_set' };
      }
    }
    
    const data = {
      year: year,
      month: month,
      goal: parseInt(goal),
      setAt: getJstDate().getTime()
    };
    
    const files2 = mFolder.getFilesByName(fname);
    if (files2.hasNext()) {
      files2.next().setContent(JSON.stringify(data));
    } else {
      mFolder.createFile(fname, JSON.stringify(data));
    }
    
    return { success: true };
  } catch (e) {
    Logger.log("saveMonthGoal error: " + e.message);
    return { success: false };
  }
}

function getLastMonthTotalTime() {
  try {
    const now = getJstDate();
    let year = now.getFullYear();
    let month = now.getMonth();
    
    if (month === 0) {
      year--;
      month = 12;
    }
    
    const monthStr = ("0" + month).slice(-2);
    const studyData = getMonthStudyData(year, monthStr);
    return studyData.totalStudyTime;
  } catch (e) {
    return 0;
  }
}

// ----------------------------------------------------------------
// History Data
// ----------------------------------------------------------------
function getHistoryList(year, month) {
  try {
    const mFolder = getMonthFolder(year, month);
    const files = mFolder.getFiles();
    const list = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const fname = file.getName();
      
      if (fname.endsWith('.json') && fname !== 'monthGoal.json') {
        try {
          const data = JSON.parse(file.getBlob().getDataAsString());
          
          let imageId = null;
          if (data.photo) {
            const imgFolder = getImageFolder(year, month);
            const imgName = year + ("0" + month).slice(-2) + ("0" + data.day).slice(-2) + ".png";
            const imgFiles = imgFolder.getFilesByName(imgName);
            if (imgFiles.hasNext()) {
              imageId = imgFiles.next().getId();
            }
          }
          
          const weekday = getWeekday(data.year, data.month, data.day);
          
          list.push({
            year: data.year,
            month: data.month,
            day: data.day,
            weekday: weekday,
            time: data.time,
            updateDay: data.updateDay || data.day,
            emotion: data.emotion,
            studyTime: data.studyTime,
            content: data.content,
            hasPhoto: data.photo,
            imageId: imageId
          });
        } catch (e) {
          Logger.log("Parse error: " + fname);
        }
      }
    }
    
    list.sort((a, b) => parseInt(b.day) - parseInt(a.day));
    
    return list;
  } catch (e) {
    Logger.log("getHistoryList error: " + e.message);
    return [];
  }
}

function getImageById(imageId) {
  try {
    const file = DriveApp.getFileById(imageId);
    const blob = file.getBlob();
    return "data:image/png;base64," + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log("getImageById error: " + e.message);
    return null;
  }
}

// ----------------------------------------------------------------
// Random Diary
// ----------------------------------------------------------------
function getRandomDiaryData() {
  try {
    const root = getRootFolder();
    const yearFolders = [];
    const yIter = root.getFolders();
    
    while (yIter.hasNext()) {
      const folder = yIter.next();
      const name = folder.getName();
      if (name !== 'Memo' && /^\d{4}$/.test(name)) {
        yearFolders.push(folder);
      }
    }
    
    if (yearFolders.length === 0) {
      return { exists: false };
    }
    
    // Collect candidates with priority for entries with both text and photo
    const highPriority = [];
    const lowPriority = [];
    
    for (let attempt = 0; attempt < 20; attempt++) {
      const randomYearFolder = yearFolders[Math.floor(Math.random() * yearFolders.length)];
      const monthFolders = [];
      const mIter = randomYearFolder.getFolders();
      
      while (mIter.hasNext()) {
        const folder = mIter.next();
        if (folder.getName() !== 'image') {
          monthFolders.push(folder);
        }
      }
      
      if (monthFolders.length === 0) continue;
      
      const randomMonthFolder = monthFolders[Math.floor(Math.random() * monthFolders.length)];
      const files = randomMonthFolder.getFiles();
      const diaryFiles = [];
      
      while (files.hasNext()) {
        const file = files.next();
        const fname = file.getName();
        if (fname.endsWith('.json') && fname !== 'monthGoal.json') {
          diaryFiles.push(file);
        }
      }
      
      if (diaryFiles.length === 0) continue;
      
      const randomFile = diaryFiles[Math.floor(Math.random() * diaryFiles.length)];
      const data = JSON.parse(randomFile.getBlob().getDataAsString());
      
      if (data.content && data.photo) {
        highPriority.push(data);
      } else if (data.content || data.photo) {
        lowPriority.push(data);
      }
    }
    
    let selectedData = null;
    if (highPriority.length > 0) {
      selectedData = highPriority[Math.floor(Math.random() * highPriority.length)];
    } else if (lowPriority.length > 0) {
      selectedData = lowPriority[Math.floor(Math.random() * lowPriority.length)];
    } else {
      return { exists: false };
    }
    
    let imageBase64 = null;
    if (selectedData.photo) {
      const imgFolder = getImageFolder(selectedData.year, selectedData.month);
      const imgName = selectedData.year + ("0" + selectedData.month).slice(-2) + ("0" + selectedData.day).slice(-2) + ".png";
      const imgFiles = imgFolder.getFilesByName(imgName);
      if (imgFiles.hasNext()) {
        const blob = imgFiles.next().getBlob();
        imageBase64 = "data:image/png;base64," + Utilities.base64Encode(blob.getBytes());
      }
    }
    
    return {
      exists: true,
      data: selectedData,
      image: imageBase64
    };
  } catch (e) {
    Logger.log("getRandomDiaryData error: " + e.message);
    return { exists: false };
  }
}

// ----------------------------------------------------------------
// Memo Functions
// ----------------------------------------------------------------
function getMemoData() {
  try {
    const memoFolder = getMemoFolder();
    const files = memoFolder.getFilesByName('memo.json');
    
    if (files.hasNext()) {
      const content = files.next().getBlob().getDataAsString();
      return JSON.parse(content);
    }
    
    return { "1": "", "2": "", "3": "", "4": "", "5": "" };
  } catch (e) {
    Logger.log("getMemoData error: " + e.message);
    return { "1": "", "2": "", "3": "", "4": "", "5": "" };
  }
}

function saveMemoData(memoData) {
  try {
    const memoFolder = getMemoFolder();
    const fname = 'memo.json';
    const files = memoFolder.getFilesByName(fname);
    
    if (files.hasNext()) {
      files.next().setContent(JSON.stringify(memoData));
    } else {
      memoFolder.createFile(fname, JSON.stringify(memoData));
    }
    
    return { success: true };
  } catch (e) {
    Logger.log("saveMemoData error: " + e.message);
    return { success: false };
  }
}

// ----------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------
function getAvailableYears() {
  try {
    const root = getRootFolder();
    const folders = root.getFolders();
    const years = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      const name = folder.getName();
      if (/^\d{4}$/.test(name)) {
        years.push(parseInt(name));
      }
    }
    
    years.sort((a, b) => b - a);
    return years;
  } catch (e) {
    Logger.log("getAvailableYears error: " + e.message);
    return [];
  }
}

function getAvailableMonths(year) {
  try {
    const yFolder = getYearFolder(year);
    const folders = yFolder.getFolders();
    const months = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      const name = folder.getName();
      if (/^\d{2}$/.test(name) && name !== 'image') {
        months.push(parseInt(name));
      }
    }
    
    months.sort((a, b) => a - b);
    return months;
  } catch (e) {
    Logger.log("getAvailableMonths error: " + e.message);
    return [];
  }
}