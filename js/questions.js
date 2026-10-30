
"use strict";

(() => {
  const $ = selector => document.querySelector(selector);
  const LETTERS = ["A", "B", "C", "D"];
  const STORAGE_KEY = "quizora_questions_v1";

  const screens = [
    "homeScreen",
    "quizScreen",
    "resultScreen",
    "adminScreen"
  ];

  let questions = loadQuestions();
  let quizQuestions = [];
  let currentIndex = 0;
  let score = 0;
  let correctCount = 0;
  let playerName = "Pemain";
  let timeLeft = 20;
  let timerId = null;
  let toastId = null;
  let answered = false;
  let reviewData = [];
  let currentImage = "";
  let removeCurrentImage = false;

  // MENYIAPKAN DATA SOAL
  function normalizeQuestion(q, index = 0) {
    return {
      id: q.id ?? `q-${Date.now()}-${index}`,
      category: String(q.category || "Umum"),
      level: ["Mudah", "Menengah", "Sulit"].includes(q.level)
        ? q.level
        : "Mudah",
      time: Math.max(5, Math.min(120, Number(q.time) || 20)),
      question: String(q.question || ""),
      image: typeof q.image === "string" ? q.image : "",
      options: Array.isArray(q.options)
        ? q.options.slice(0, 4).map(String)
        : ["", "", "", ""],
      correct: Math.max(0, Math.min(3, Number(q.correct) || 0)),
      explanation: String(q.explanation || "")
    };
  }

  function loadQuestions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved !== null) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          return parsed.map(normalizeQuestion);
        }
      }
    } catch (error) {
      console.error("Gagal membaca bank soal:", error);
    }

    return (window.DEFAULT_QUESTIONS || []).map(normalizeQuestion);
  }

  function saveQuestions() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(questions)
      );
      return true;
    } catch (error) {
      console.error("Gagal menyimpan soal:", error);
      showToast(
        "Penyimpanan penuh. Kurangi ukuran gambar atau ekspor cadangan."
      );
      return false;
    }
  }

  // NOTIFIKASI
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastId);

    toastId = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // ESCAPE TEKS UNTUK HTML
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  // NAVIGASI HALAMAN
  function showScreen(screenId) {
    screens.forEach(id => {
      $("#" + id).classList.toggle(
        "active",
        id === screenId
      );
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  // KATEGORI
  function updateCategories() {
    const select = $("#categorySelect");
    const previous = select.value;

    const categories = [
      ...new Set(
        questions.map(q => q.category).filter(Boolean)
      )
    ].sort();

    select.replaceChildren();

    const all = document.createElement("option");
    all.value = "Semua";
    all.textContent = "Semua kategori";
    select.appendChild(all);

    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });

    select.value = categories.includes(previous)
      ? previous
      : "Semua";

    $("#totalQuestions").textContent = questions.length;
    $("#questionCountLabel").textContent =
      `${questions.length} soal`;
  }

  // ACAK SOAL
  function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  // MEMULAI KUIS
  $("#startForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#playerName").value.trim();
    const category = $("#categorySelect").value;
    const level = $("#levelSelect").value;

    if (!name) {
      showToast("Masukkan nama pemain terlebih dahulu.");
      return;
    }

    const filtered = questions.filter(q =>
      (category === "Semua" || q.category === category) &&
      (level === "Semua" || q.level === level)
    );

    if (!filtered.length) {
      showToast("Tidak ada soal untuk pilihan tersebut.");
      return;
    }

    playerName = name;
    quizQuestions = shuffle(filtered);

    currentIndex = 0;
    score = 0;
    correctCount = 0;
    reviewData = [];

    $("#liveScore").textContent = "0";
    $("#reviewPanel").classList.add("hidden");

    showScreen("quizScreen");
    renderQuestion();
  });

  // RENDER SOAL
  function renderQuestion() {
    stopTimer();
    answered = false;

    const q = quizQuestions[currentIndex];

    if (!q) {
      finishQuiz();
      return;
    }

    $("#categoryBadge").textContent = q.category;
    $("#levelBadge").textContent = q.level;

    $("#questionCounter").textContent =
      `Pertanyaan ${currentIndex + 1} dari ${quizQuestions.length}`;

    $("#questionNumber").textContent =
      String(currentIndex + 1).padStart(2, "0");

    $("#questionText").textContent = q.question;

    const percent = Math.round(
      currentIndex / quizQuestions.length * 100
    );

    $("#progressPercent").textContent = `${percent}%`;
    $("#progressBar").style.width = `${percent}%`;

    $("#answerHint").textContent =
      "Pilih satu jawaban yang paling tepat.";

    $("#nextQuestionBtn").disabled = true;

    $("#nextQuestionBtn").textContent =
      currentIndex === quizQuestions.length - 1
        ? "Lihat hasil →"
        : "Berikutnya →";

    $("#timerBox").classList.remove("urgent");

    // TAMPILKAN GAMBAR SOAL
    const image = $("#questionImage");

    if (q.image) {
      image.src = q.image;
      image.classList.remove("hidden");
    } else {
      image.removeAttribute("src");
      image.classList.add("hidden");
    }

    // PILIHAN JAWABAN
    const grid = $("#answersGrid");
    grid.replaceChildren();

    q.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-option";

      const letter = document.createElement("span");
      letter.className = "answer-letter";
      letter.textContent = LETTERS[index];

      const text = document.createElement("span");
      text.textContent = option;

      button.append(letter, text);

      button.addEventListener("click", () => {
        chooseAnswer(index, false);
      });

      grid.appendChild(button);
    });

    // TIMER
    timeLeft = q.time;
    updateTimer();

    timerId = setInterval(() => {
      timeLeft--;
      updateTimer();

      if (timeLeft <= 0) {
        stopTimer();
        chooseAnswer(-1, true);
      }
    }, 1000);
  }

  function updateTimer() {
    $("#timerText").textContent = timeLeft;
    $("#timerBox").classList.toggle("urgent", timeLeft <= 5);
  }

  // PERIKSA JAWABAN
  function chooseAnswer(selectedIndex, timedOut) {
    if (answered) return;

    answered = true;
    stopTimer();

    const q = quizQuestions[currentIndex];
    const isCorrect = selectedIndex === Number(q.correct);

    const points = isCorrect
      ? 100 + Math.max(0, timeLeft) * 2
      : 0;

    if (isCorrect) {
      correctCount++;
      score += points;

      $("#answerHint").textContent =
        `Benar! +${points} poin. ${q.explanation}`;
    } else if (timedOut) {
      $("#answerHint").textContent =
        `Waktu habis. Jawaban benar: ${LETTERS[q.correct]}. ${q.explanation}`;
    } else {
      $("#answerHint").textContent =
        `Jawaban belum tepat. Jawaban benar: ${LETTERS[q.correct]}. ${q.explanation}`;
    }

    $("#liveScore").textContent = score;

    $("#answersGrid")
      .querySelectorAll(".answer-option")
      .forEach((button, index) => {
        button.disabled = true;

        if (index === Number(q.correct)) {
          button.classList.add("correct");
        } else if (index === selectedIndex) {
          button.classList.add("wrong");
        }
      });

    reviewData.push({
      question: q.question,
      image: q.image || "",
      options: [...q.options],
      correct: Number(q.correct),
      selected: selectedIndex,
      explanation: q.explanation,
      points
    });

    $("#nextQuestionBtn").disabled = false;
  }

  // SOAL BERIKUTNYA
  $("#nextQuestionBtn").addEventListener("click", () => {
    if (!answered) return;

    currentIndex++;

    if (currentIndex >= quizQuestions.length) {
      finishQuiz();
    } else {
      renderQuestion();
    }
  });

  // KELUAR DARI KUIS
  $("#quitQuizBtn").addEventListener("click", () => {
    if (confirm("Yakin ingin keluar dari kuis?")) {
      stopTimer();
      showScreen("homeScreen");
    }
  });

  // HASIL AKHIR
  function finishQuiz() {
    stopTimer();

    const total = quizQuestions.length;
    const accuracy = total
      ? Math.round(correctCount / total * 100)
      : 0;

    $("#progressPercent").textContent = "100%";
    $("#progressBar").style.width = "100%";

    $("#finalScore").textContent = score;
    $("#correctCount").textContent = correctCount;
    $("#wrongCount").textContent = total - correctCount;
    $("#finalAccuracy").textContent = `${accuracy}%`;

    if (accuracy >= 80) {
      $("#resultTitle").textContent = `Hebat, ${playerName}!`;
      $("#resultSubtitle").textContent =
        "Kamu menguasai materi dengan sangat baik.";
      $("#resultMedal").textContent = "🏆";
    } else if (accuracy >= 50) {
      $("#resultTitle").textContent = `Bagus, ${playerName}!`;
      $("#resultSubtitle").textContent =
        "Terus berlatih untuk mendapatkan nilai lebih tinggi.";
      $("#resultMedal").textContent = "🥈";
    } else {
      $("#resultTitle").textContent = `Tetap semangat, ${playerName}!`;
      $("#resultSubtitle").textContent =
        "Pelajari pembahasannya dan coba lagi.";
      $("#resultMedal").textContent = "🌱";
    }

    renderReview();
    showScreen("resultScreen");
  }

  // PEMBAHASAN
  function renderReview() {
    const list = $("#reviewList");
    list.replaceChildren();

    reviewData.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = "review-item";

      const title = document.createElement("h3");
      title.textContent = `${index + 1}. ${item.question}`;
      article.appendChild(title);

      if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = "Gambar soal";
        image.className = "question-image";
        article.appendChild(image);
      }

      const selected = document.createElement("p");
      selected.className =
        item.selected === item.correct ? "review-good" : "review-bad";

      selected.textContent = item.selected < 0
        ? "Jawabanmu: Tidak dijawab (waktu habis)."
        : `Jawabanmu: ${LETTERS[item.selected]}. ${item.options[item.selected]}`;

      const correct = document.createElement("p");
      correct.className = "review-good";
      correct.textContent =
        `Jawaban benar: ${LETTERS[item.correct]}. ${item.options[item.correct]}`;

      const explanation = document.createElement("p");
      explanation.textContent = `Pembahasan: ${item.explanation}`;

      const points = document.createElement("p");
      points.textContent = `Poin diperoleh: ${item.points}`;

      article.append(selected, correct, explanation, points);
      list.appendChild(article);
    });
  }

  $("#reviewBtn").addEventListener("click", () => {
    $("#reviewPanel").classList.remove("hidden");
    $("#reviewPanel").scrollIntoView({ behavior: "smooth" });
  });

  $("#hideReviewBtn").addEventListener("click", () => {
    $("#reviewPanel").classList.add("hidden");
  });

  $("#playAgainBtn").addEventListener("click", () => {
    showScreen("homeScreen");
  });

  $("#brandHome").addEventListener("click", event => {
    event.preventDefault();
    stopTimer();
    showScreen("homeScreen");
  });

  // ADMIN DEMO
  $("#openAdminBtn").addEventListener("click", () => {
    const code = prompt("Masukkan kode admin demo (1234):");

    if (code !== "1234") {
      if (code !== null) showToast("Kode admin salah.");
      return;
    }

    renderAdminList();
    resetAdminForm();
    showScreen("adminScreen");
  });

  $("#adminHomeBtn").addEventListener("click", () => {
    showScreen("homeScreen");
  });

  // FORM ADMIN
  function resetAdminForm() {
    $("#questionForm").reset();

    $("#editQuestionId").value = "";
    $("#adminTime").value = 20;

    currentImage = "";
    removeCurrentImage = false;

    $("#imagePreview").removeAttribute("src");
    $("#imagePreview").classList.add("hidden");
    $("#removeImageBtn").classList.add("hidden");
    $("#adminImage").value = "";

    $("#adminFormTitle").textContent = "Tambah soal baru";
    $("#saveQuestionBtn").textContent = "Simpan soal";
    $("#cancelEditBtn").classList.add("hidden");
  }

  $("#newQuestionBtn").addEventListener("click", () => {
    resetAdminForm();
    $("#questionForm").classList.remove("hidden");

    $("#questionForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  $("#cancelEditBtn").addEventListener("click", resetAdminForm);

  // PRATINJAU GAMBAR
  $("#adminImage").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Pilih file gambar yang valid.");
      event.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      showToast("Ukuran gambar maksimal 1 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      currentImage = reader.result;
      removeCurrentImage = false;

      $("#imagePreview").src = currentImage;
      $("#imagePreview").classList.remove("hidden");
      $("#removeImageBtn").classList.remove("hidden");
    };

    reader.onerror = () => {
      showToast("Gambar gagal dibaca.");
    };

    reader.readAsDataURL(file);
  });

  $("#removeImageBtn").addEventListener("click", () => {
    currentImage = "";
    removeCurrentImage = true;

    $("#adminImage").value = "";
    $("#imagePreview").removeAttribute("src");
    $("#imagePreview").classList.add("hidden");
    $("#removeImageBtn").classList.add("hidden");
  });

  // SIMPAN ATAU EDIT SOAL
  $("#questionForm").addEventListener("submit", event => {
    event.preventDefault();

    const editId = $("#editQuestionId").value;
    const old = editId
      ? questions.find(q => String(q.id) === editId)
      : null;

    const questionText = $("#adminQuestion").value.trim();
    const category = $("#adminCategory").value.trim();

    const options = [
      $("#optionA").value.trim(),
      $("#optionB").value.trim(),
      $("#optionC").value.trim(),
      $("#optionD").value.trim()
    ];

    const explanation = $("#adminExplanation").value.trim();
    const time = Number($("#adminTime").value);

    if (
      !questionText ||
      !category ||
      options.some(option => !option) ||
      !explanation
    ) {
      showToast("Lengkapi semua kolom terlebih dahulu.");
      return;
    }

    if (!Number.isFinite(time) || time < 5 || time > 120) {
      showToast("Waktu harus antara 5 sampai 120 detik.");
      return;
    }

    const image = removeCurrentImage
      ? ""
      : currentImage || (old ? old.image : "");

    const newQuestion = {
      id: old ? old.id : `q-${Date.now()}-${Math.random().toString(16).slice(2,7)}`,
      question: questionText,
      category,
      level: $("#adminLevel").value,
      options,
      correct: Number($("#adminCorrect").value),
      time,
      image,
      explanation
    };

    const previous = questions;

    if (old) {
      questions = questions.map(q =>
        String(q.id) === editId ? newQuestion : q
      );
    } else {
      questions.push(newQuestion);
    }

    if (!saveQuestions()) {
      questions = previous;
      return;
    }

    updateCategories();
    renderAdminList();
    resetAdminForm();
    $("#questionForm").classList.add("hidden");

    showToast(old ? "Soal berhasil diperbarui." : "Soal berhasil ditambahkan.");
  });

  // DAFTAR SOAL ADMIN
  function renderAdminList() {
    $("#questionCountLabel").textContent = `${questions.length} soal`;

    const list = $("#adminQuestionList");
    list.replaceChildren();

    if (!questions.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Belum ada soal.";
      list.appendChild(empty);
      return;
    }

    questions.forEach(q => {
      const article = document.createElement("article");
      article.className = "admin-question";

      const title = document.createElement("h3");
      title.textContent = q.question;

      const meta = document.createElement("p");
      meta.textContent =
        `${q.category} · ${q.level} · ${q.time} detik` +
        (q.image ? " · 🖼️ Ada gambar" : "");

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button secondary";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => editQuestion(q.id));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "button danger";
      del.textContent = "Hapus";
      del.addEventListener("click", () => deleteQuestion(q.id));

      actions.append(edit, del);
      article.append(title, meta, actions);
      list.appendChild(article);
    });
  }

  // EDIT SOAL
  function editQuestion(id) {
    const q = questions.find(item => String(item.id) === String(id));
    if (!q) return;

    resetAdminForm();

    $("#editQuestionId").value = q.id;
    $("#adminQuestion").value = q.question;
    $("#adminCategory").value = q.category;
    $("#adminLevel").value = q.level;

    $("#optionA").value = q.options[0] || "";
    $("#optionB").value = q.options[1] || "";
    $("#optionC").value = q.options[2] || "";
    $("#optionD").value = q.options[3] || "";

    $("#adminCorrect").value = q.correct;
    $("#adminTime").value = q.time;
    $("#adminExplanation").value = q.explanation;

    currentImage = q.image || "";
    removeCurrentImage = false;

    if (currentImage) {
      $("#imagePreview").src = currentImage;
      $("#imagePreview").classList.remove("hidden");
      $("#removeImageBtn").classList.remove("hidden");
    }

    $("#adminFormTitle").textContent = "Edit soal";
    $("#saveQuestionBtn").textContent = "Simpan perubahan";
    $("#cancelEditBtn").classList.remove("hidden");
    $("#questionForm").classList.remove("hidden");

    $("#questionForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // HAPUS SOAL
  function deleteQuestion(id) {
    const q = questions.find(item => String(item.id) === String(id));
    if (!q) return;

    if (!confirm(`Hapus soal "${q.question}"?`)) return;

    const previous = questions;
    questions = questions.filter(item => String(item.id) !== String(id));

    if (!saveQuestions()) {
      questions = previous;
      return;
    }

    updateCategories();
    renderAdminList();
    showToast("Soal berhasil dihapus.");
  }

  // EKSPOR CADANGAN
  $("#exportQuestionsBtn").addEventListener("click", () => {
    const blob = new Blob(
      [JSON.stringify(questions, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "cadangan-quizora.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // IMPOR CADANGAN
  $("#importQuestionsBtn").addEventListener("click", () => {
    $("#importFile").click();
  });

  $("#importFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      let imported;

      try {
        imported = JSON.parse(reader.result);
      } catch {
        showToast("File JSON tidak valid.");
        event.target.value = "";
        return;
      }

      const valid = Array.isArray(imported) &&
        imported.every(q =>
          q &&
          typeof q.question === "string" &&
          typeof q.category === "string" &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(option => typeof option === "string") &&
          Number.isInteger(Number(q.correct)) &&
          Number(q.correct) >= 0 &&
          Number(q.correct) <= 3 &&
          (!q.image || typeof q.image === "string")
        );

      if (!valid) {
        showToast("Format cadangan tidak sesuai.");
        event.target.value = "";
        return;
      }

      if (!confirm(`Impor ${imported.length} soal? Soal saat ini akan diganti.`)) {
        event.target.value = "";
        return;
      }

      const previous = questions;
      questions = imported.map(normalizeQuestion);

      if (!saveQuestions()) {
        questions = previous;
        event.target.value = "";
        return;
      }

      updateCategories();
      renderAdminList();
      resetAdminForm();
      $("#questionForm").classList.add("hidden");

      showToast("Cadangan soal berhasil diimpor.");
      event.target.value = "";
    };

    reader.onerror = () => {
      showToast("File gagal dibaca.");
      event.target.value = "";
    };

    reader.readAsText(file);
  });

  // PULIHKAN SOAL BAWAAN
  $("#resetQuestionsBtn").addEventListener("click", () => {
    if (!confirm("Pulihkan semua soal bawaan? Perubahan soal akan hilang.")) {
      return;
    }

    const previous = questions;

    questions = (window.DEFAULT_QUESTIONS || []).map(normalizeQuestion);

    if (!saveQuestions()) {
      questions = previous;
      return;
    }

    updateCategories();
    renderAdminList();
    resetAdminForm();
    $("#questionForm").classList.add("hidden");

    showToast("Soal bawaan berhasil dipulihkan.");
  });

  // INISIALISASI
  updateCategories();

})();
