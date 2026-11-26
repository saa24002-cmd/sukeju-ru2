import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Firebase 初期化
const firebaseConfig = {
  apiKey: "AIzaSyAG6FL2hUvcecTgGgxRTdj71VU_PPbxUZY",
  authDomain: "sukeju-ru-1bae9.firebaseapp.com",
  projectId: "sukeju-ru-1bae9",
  storageBucket: "sukeju-ru-1bae9.firebasestorage.app",
  messagingSenderId: "691416091911",
  appId: "1:691416091911:web:6007ac477b6300926309a2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM要素の取得
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");
const userInfo = document.getElementById("user-info");
const userPhoto = document.getElementById("user-photo");
const userName = document.getElementById("user-name");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const scheduleForm = document.getElementById("schedule-form");
const formTitle = document.getElementById("form-title");
const editIdInput = document.getElementById("edit-id");
const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const categoryInput = document.getElementById("category");
const memoInput = document.getElementById("memo");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const mySchedulesList = document.getElementById("my-schedules-list");
const myCountSpan = document.getElementById("my-count");
const filterBtns = document.querySelectorAll(".filter-btn");

let currentUser = null;
let unsubscribeSchedules = null;
let mySchedulesCache = [];
let currentFilter = "all";

// 初期日付を今日に設定
dateInput.valueAsDate = new Date();

// ログイン処理
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("ログインエラー:", error);
    alert("ログインに失敗しました。\n" + error.message);
  }
});

// ログアウト処理
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("ログアウトエラー:", error);
  }
});

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userInfo.classList.remove("hidden");
    userName.textContent = user.displayName || "ユーザー";

    if (user.photoURL) {
      userPhoto.src = user.photoURL;
      userPhoto.classList.remove("hidden");
    } else {
      userPhoto.classList.add("hidden");
    }

    subscribeToMySchedules(user.uid);
  } else {
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    userInfo.classList.add("hidden");
    if (unsubscribeSchedules) unsubscribeSchedules();
  }
});

// フィルターボタン切り替え
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderMySchedules(mySchedulesCache);
  });
});

// フォーム送信（新規作成 & 更新）
scheduleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const title = titleInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;
  const category = categoryInput.value;
  const memo = memoInput.value.trim();
  const editId = editIdInput.value;

  submitBtn.disabled = true;

  try {
    if (editId) {
      // 既存データの更新
      const docRef = doc(db, "schedules", editId);
      await updateDoc(docRef, {
        title,
        date,
        time,
        category,
        memo,
        updatedAt: serverTimestamp()
      });
      resetForm();
    } else {
      // 新規データの保存
      await addDoc(collection(db, "schedules"), {
        uid: currentUser.uid,
        title,
        date,
        time,
        category,
        memo,
        isCompleted: false,
        createdAt: serverTimestamp()
      });
      resetForm();
    }
  } catch (error) {
    console.error("保存エラー:", error);
    alert("データの保存に失敗しました。\n" + error.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// 編集キャンセル
cancelEditBtn.addEventListener("click", resetForm);

function resetForm() {
  editIdInput.value = "";
  titleInput.value = "";
  dateInput.valueAsDate = new Date();
  timeInput.value = "";
  categoryInput.value = "勉強・課題";
  memoInput.value = "";
  formTitle.textContent = "✏️ 新しい予定を追加";
  submitBtn.textContent = "予定を保存する";
  cancelEditBtn.classList.add("hidden");
}

// 自分のデータだけをリアルタイム取得
function subscribeToMySchedules(uid) {
  const q = query(collection(db, "schedules"), where("uid", "==", uid));

  unsubscribeSchedules = onSnapshot(q, (snapshot) => {
    const items = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    mySchedulesCache = items;
    renderMySchedules(items);
  }, (error) => {
    console.error("データ取得エラー:", error);
    mySchedulesList.innerHTML = `<p class="empty-msg">データの読み込みに失敗しました（Firestoreのルールを確認してください）</p>`;
  });
}

// 自分のスケジュールを描画（日時順）
function renderMySchedules(items) {
  let filteredItems = [...items].sort((a, b) => {
    const dtA = `${a.date} ${a.time || "23:59"}`;
    const dtB = `${b.date} ${b.time || "23:59"}`;
    return dtA.localeCompare(dtB);
  });

  if (currentFilter === "active") {
    filteredItems = filteredItems.filter((item) => !item.isCompleted);
  } else if (currentFilter === "completed") {
    filteredItems = filteredItems.filter((item) => item.isCompleted);
  }

  myCountSpan.textContent = filteredItems.length;

  if (filteredItems.length === 0) {
    mySchedulesList.innerHTML = `<p class="empty-msg">表示する予定がありません。</p>`;
    return;
  }

  mySchedulesList.innerHTML = "";
  filteredItems.forEach((item) => {
    const el = document.createElement("div");
    el.className = `schedule-item ${item.isCompleted ? "completed" : ""}`;
    const timeText = item.time ? ` ${item.time}` : "";

    el.innerHTML = `
      <div class="schedule-header">
        <div class="title-wrap">
          <input type="checkbox" class="complete-check" ${item.isCompleted ? "checked" : ""} title="完了にする">
          <span class="schedule-title">${escapeHTML(item.title)}</span>
          <span class="category-badge">${escapeHTML(item.category)}</span>
        </div>
        <span class="schedule-datetime">🗓 ${escapeHTML(item.date)}${escapeHTML(timeText)}</span>
      </div>
      ${item.memo ? `<p class="schedule-memo">${escapeHTML(item.memo)}</p>` : ""}
      <div class="schedule-footer">
        <span>${item.isCompleted ? "✅ 完了済み" : "⏳ 予定中"}</span>
        <div class="schedule-actions">
          <button class="btn btn-sm btn-edit">編集</button>
          <button class="btn btn-sm btn-delete">削除</button>
        </div>
      </div>
    `;

    // 完了チェック切り替え
    el.querySelector(".complete-check").addEventListener("change", async (e) => {
      try {
        await updateDoc(doc(db, "schedules", item.id), {
          isCompleted: e.target.checked
        });
      } catch (error) {
        alert("更新に失敗しました: " + error.message);
      }
    });

    // 編集ボタン
    el.querySelector(".btn-edit").addEventListener("click", () => {
      editIdInput.value = item.id;
      titleInput.value = item.title;
      dateInput.value = item.date;
      timeInput.value = item.time || "";
      categoryInput.value = item.category;
      memoInput.value = item.memo || "";
      formTitle.textContent = "✏️ 予定を編集する";
      submitBtn.textContent = "更新を保存する";
      cancelEditBtn.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // 削除ボタン
    el.querySelector(".btn-delete").addEventListener("click", async () => {
      if (confirm(`「${item.title}」を削除しますか？`)) {
        try {
          await deleteDoc(doc(db, "schedules", item.id));
        } catch (error) {
          alert("削除に失敗しました: " + error.message);
        }
      }
    });

    mySchedulesList.appendChild(el);
  });
}

// XSS対策用エスケープ関数
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[match];
  });
}
