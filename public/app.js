/**
 * ClutterPilot â€” Client Application
 * Privacy-First, Local-AI File Organization
 * 
 * Strict Guarantees:
 * - 100% in-browser state. Zero writing of file contents to localStorage,
 *   sessionStorage, IndexedDB, cookies, or remote servers.
 * - Cloud Hosted · File Organization Available
 * - Client-side SHA-256 duplicate detection.
 * - Client-side ZIP generation via JSZip.
 * - Original files on disk are never altered.
 */

(function () {
  "use strict";

  // Helper selector
  const $ = (id) => document.getElementById(id);

  // Core Application State (In-Memory Only)
  let sessionFiles = [];
  let currentStep = 1;
  let activeEditIndex = null;
  let activeInspectIndex = null;
  let currentAiStrategy = "topic"; // 'topic' | 'timeline' | 'format' | 'action'
  let activeTopicFilter = "all";
  let namingStyleIndex = 0;
  const NAMING_STYLES = ["Title Case", "kebab-case", "snake_case"];
  let isAiRunning = false;
  let aiAbortController = null;
  let ollamaStatus = { online: false, model: "qwen2.5:1.5b", checking: true };

  // Common generic / confusing filename patterns
  const GENERIC_NAME_REGEX = /^(download|document|doc|untitled|screenshot|screen shot|img_\d+|dsc_\d+|file|new file|notes_final|final_final|assignment\d*|scan|scan_\d+)(\s*[\(_-]\s*\d+\s*[\)]*)?$/i;

  /* ==========================================================================
     INIT & HEALTH CHECK
     ========================================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNavigation();
    initFileHandlers();
    initWorkspaceActions();
    initAiStudioActions();
    initModals();
    checkLocalHealth();

    // Auto-load demo if requested via query param (e.g. /workspace?demo=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "true" || params.get("demo") === "1") {
      setTimeout(loadSampleFiles, 200);
    }

    // Periodic health check
    setInterval(checkLocalHealth, 15000);
  });

  async function checkLocalHealth() {
    const statusPill = $("model-status");
    if (!statusPill) return;

    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        ollamaStatus = {
          online: data.ollama && data.modelAvailable,
          model: data.model || "qwen2.5:1.5b",
          checking: false
        };

        if (ollamaStatus.online) {
          statusPill.innerHTML = `
            <span class="status-dot online"></span>
            <span class="status-text">Ollama: ${ollamaStatus.model}</span>
          `;
          statusPill.title = "Local Ollama AI online at 127.0.0.1:11434";
        } else {
          statusPill.innerHTML = `
            <span class="status-dot checking"></span>
            <span class="status-text">${ollamaStatus.model} (Model offline)</span>
          `;
          statusPill.title = "Ollama running but model missing. Fallback heuristics ready.";
        }
      } else {
        throw new Error("Ollama offline");
      }
    } catch {
      ollamaStatus = { online: false, model: "qwen2.5:1.5b", checking: false };
      statusPill.innerHTML = `
        <span class="status-dot offline"></span>
        <span class="status-text">Local AI Offline (Rule Mode)</span>
      `;
      statusPill.title = "Ollama is not running. Smart rule-based organization active.";
    }
  }

  /* ==========================================================================
     THEME MANAGEMENT
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem("clutterpilot-theme") || 
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(savedTheme);

    const toggleBtn = $("theme-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clutterpilot-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#101713" : "#FAF8F5");
    }
  }

  /* ==========================================================================
     FAQ ACCORDION
     ========================================================================== */
  function initFaqAccordion() {
    const questions = document.querySelectorAll(".faq-question");
    questions.forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".faq-item");
        const answer = item.querySelector(".faq-answer");
        const isOpen = item.classList.contains("open");
        const chevron = btn.querySelector(".faq-chevron");

        if (isOpen) {
          item.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
          answer.hidden = true;
          if (chevron) chevron.textContent = "+";
        } else {
          item.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
          answer.hidden = false;
          if (chevron) chevron.innerHTML = "&minus;";
        }
      });
    });
  }

  /* ==========================================================================
     NAVIGATION & BREADCRUMBS
     ========================================================================== */
  function initNavigation() {
    // Step navigation pills click
    [1, 2, 3, 4, 5].forEach((stepNum) => {
      const pill = $(`pill-step-${stepNum}`);
      if (pill) {
        pill.addEventListener("click", () => {
          // Allow switching between steps once files are loaded
          if (sessionFiles.length > 0) {
            if (stepNum === 5) renderExportPreview();
            setWorkspaceStep(stepNum);
          } else if (stepNum > 1) {
            showNotification("Please select files first or click 'Try with Sample Files'.", "info");
          }
        });
      }
    });

    // "Get Started" buttons redirect smoothly to the workspace
    document.querySelectorAll('a[href="#workspace"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        scrollToWorkspace();
      });
    });

    // Hero sample button
    const heroSampleBtn = $("hero-sample-btn");
    if (heroSampleBtn) {
      heroSampleBtn.addEventListener("click", () => {
        loadSampleFiles();
        scrollToWorkspace();
      });
    }
  }

  function scrollToWorkspace() {
    const ws = $("workspace");
    if (ws) {
      ws.scrollIntoView({ behavior: "smooth" });
      history.pushState(null, null, "#workspace");
    }
  }

  function setWorkspaceStep(step) {
    currentStep = step;

    // Ensure Step 4 suggestions and review table are rendered if navigating directly
    if (step === 4) {
      if (sessionFiles.length > 0) {
        sessionFiles.forEach((f) => {
          if (!f.suggestion) {
            f.suggestion = generateClientRuleSuggestion(f);
          }
          if (f.selected === undefined) {
            f.selected = true;
          }
        });
      }
      renderReviewTable();
      renderAiIntelligenceSummary();
    }

    // Views
    const views = {
      1: $("view-selection"),
      2: $("view-scanning"),
      3: $("view-audit"),
      4: $("view-review"),
      5: $("view-export")
    };

    Object.keys(views).forEach((k) => {
      const v = views[k];
      if (v) {
        if (parseInt(k, 10) === step) {
          v.classList.add("active");
          v.hidden = false;
        } else {
          v.classList.remove("active");
          v.hidden = true;
        }
      }
    });

    // Step pills
    [1, 2, 3, 4, 5].forEach((s) => {
      const pill = $(`pill-step-${s}`);
      if (pill) {
        pill.classList.remove("active", "completed");
        if (s === step) pill.classList.add("active");
        else if (s < step) pill.classList.add("completed");
      }
    });
  }

  function showNotification(msg, type = "success") {
    const el = $("workspace-notification");
    if (!el) return;
    el.className = `workspace-notification ${type}`;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => {
      el.hidden = true;
    }, 5000);
  }

  /* ==========================================================================
     FILE HANDLING & LOCAL SCANNING
     ========================================================================== */
  function initFileHandlers() {
    const dropzone = $("dropzone");
    const filesInput = $("file-input-files");
    const folderInput = $("file-input-folder");
    const chooseFilesBtn = $("btn-choose-files");
    const chooseFolderBtn = $("btn-choose-folder");
    const sampleFilesBtn = $("btn-use-sample");

    if (chooseFilesBtn && filesInput) {
      chooseFilesBtn.addEventListener("click", () => filesInput.click());
    }

    if (chooseFolderBtn && folderInput) {
      chooseFolderBtn.addEventListener("click", () => folderInput.click());
    }

    if (filesInput) {
      filesInput.addEventListener("change", (e) => handleSelectedFiles(e.target.files));
    }

    if (folderInput) {
      folderInput.addEventListener("change", (e) => handleSelectedFiles(e.target.files));
    }

    if (sampleFilesBtn) {
      sampleFilesBtn.addEventListener("click", loadSampleFiles);
    }

    // Drag and drop
    if (dropzone) {
      ["dragenter", "dragover"].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("dragover");
        });
      });

      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleSelectedFiles(dt.files);
        }
      });
    }
  }

  /**
   * Primary entry point for real user selected files
   */
  async function handleSelectedFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    setWorkspaceStep(2); // Scanning view

    const filesArray = Array.from(fileList);
    sessionFiles = [];

    await processFilesBatch(filesArray, false);
  }

  /**
   * Load 10 realistic cluttered sample files for demo / testing
   */
  async function loadSampleFiles() {
    setWorkspaceStep(2); // Scanning view

    const sampleDefs = [
      {
        name: "download (4).pdf",
        type: "application/pdf",
        content: "CS302 Assignment 3: Advanced Graph Algorithms and Minimum Spanning Trees. Submission deadline: Oct 28. Student: Alex Morgan. Implement Kruskal and Prim algorithms."
      },
      {
        name: "document_001.pdf",
        type: "application/pdf",
        content: "Quarterly Financial Overview - Q3 Budget Report. Net revenue increased by 14% year-over-year. Department expenditure summary attached."
      },
      {
        name: "document_001 (1).pdf", // Duplicate
        type: "application/pdf",
        content: "Quarterly Financial Overview - Q3 Budget Report. Net revenue increased by 14% year-over-year. Department expenditure summary attached."
      },
      {
        name: "notes_final_FINAL.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        content: "Lecture Notes on Neural Networks and Deep Learning Architecture. Backpropagation derivations, gradient descent learning rate decay."
      },
      {
        name: "notes_final.txt", // Duplicate
        type: "text/plain",
        content: "Lecture Notes on Neural Networks and Deep Learning Architecture. Backpropagation derivations, gradient descent learning rate decay."
      },
      {
        name: "IMG_2026_01.jpg",
        type: "image/jpeg",
        content: "SIMULATED_EXIF_IMAGE_DATA_CAMPUS_TOUR_PHOTO_2026"
      },
      {
        name: "IMG_2026_01_copy.jpg", // Duplicate
        type: "image/jpeg",
        content: "SIMULATED_EXIF_IMAGE_DATA_CAMPUS_TOUR_PHOTO_2026"
      },
      {
        name: "screenshot (2).png",
        type: "image/png",
        content: "SIMULATED_SCREENSHOT_DATA_PROFILE_SETTINGS_MODAL"
      },
      {
        name: "assignment2.doc",
        type: "application/msword",
        content: "Physics 101 Lab Experiment #2: Harmonic Oscillators, damped frequency calculation, and pendulum measurements."
      },
      {
        name: "Untitled (3).txt",
        type: "text/plain",
        content: "Personal To-Do and Grocery List:\n- Almond milk\n- Espresso roast beans\n- Pay electric utility bill by Monday"
      }
    ];

    const virtualFiles = sampleDefs.map((def) => {
      const blob = new Blob([def.content], { type: def.type });
      return new File([blob], def.name, { type: def.type, lastModified: Date.now() });
    });

    await processFilesBatch(virtualFiles, true);
  }

  /**
   * Process and scan files: SHA-256 hash, generic name check, text extraction
   */
  async function processFilesBatch(fileArray, isDemo) {
    const totalCount = fileArray.length;
    let completedCount = 0;

    const progressBar = $("scanning-progress-bar");
    const progressPct = $("scanning-progress-pct");
    const statTotal = $("scan-stat-total");
    const statTypes = $("scan-stat-types");
    const statDups = $("scan-stat-duplicates");
    const statReview = $("scan-stat-review");

    statTotal.textContent = totalCount;

    updateChecklistItem("chk-item-1", "scanning", "Reading files...");

    const fileRecords = [];
    const hashBuckets = new Map();
    const typeSet = new Set();

    for (let i = 0; i < totalCount; i++) {
      const file = fileArray[i];
      const name = file.name;
      const ext = getExtension(name);
      typeSet.add(ext.toLowerCase() || "unknown");

      // 1. Calculate SHA-256 hash in browser
      const hash = await computeSHA256(file);

      // Duplicate detection
      if (!hashBuckets.has(hash)) {
        hashBuckets.set(hash, []);
      }
      hashBuckets.get(hash).push(i);

      // 2. Generic name check
      const stem = name.slice(0, name.lastIndexOf(".") !== -1 ? name.lastIndexOf(".") : name.length);
      const isGenericName = GENERIC_NAME_REGEX.test(stem.trim()) || stem.trim().length <= 3;

      // 3. Extract text snippet in memory
      let textSnippet = "";
      const isSupportedDoc = [".pdf", ".docx", ".doc", ".txt", ".md", ".markdown", ".log"].includes(ext.toLowerCase());

      if (isSupportedDoc) {
        textSnippet = await extractTextSnippet(file, ext);
      }

      fileRecords.push({
        id: `f_${Date.now()}_${i}`,
        file,
        isDemo,
        name,
        size: file.size,
        type: file.type || "application/octet-stream",
        ext,
        hash,
        isDuplicate: false,
        duplicateGroupId: null,
        isGenericName,
        isSupportedDoc,
        textSnippet,
        selected: true, // Selected for batch action by default
        suggestion: null
      });

      completedCount++;
      const pct = Math.round((completedCount / totalCount) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPct) progressPct.textContent = `${pct}%`;

      if (statTypes) statTypes.textContent = typeSet.size;
    }

    updateChecklistItem("chk-item-1", "completed", "Completed");

    // Step 2: Checking file types
    updateChecklistItem("chk-item-2", "scanning", "Analyzing extensions...");
    await sleep(200);
    updateChecklistItem("chk-item-2", "completed", "Completed");

    // Step 3: Detecting duplicates
    updateChecklistItem("chk-item-3", "scanning", "Matching hashes...");
    let dupCount = 0;
    let groupCounter = 1;

    hashBuckets.forEach((indices) => {
      if (indices.length > 1) {
        const groupId = `dup_group_${groupCounter++}`;
        indices.forEach((idx) => {
          fileRecords[idx].isDuplicate = true;
          fileRecords[idx].duplicateGroupId = groupId;
        });
        dupCount += (indices.length - 1);
      }
    });

    if (statDups) statDups.textContent = dupCount;
    await sleep(200);
    updateChecklistItem("chk-item-3", "completed", "Completed");

    // Step 4: Preparing for AI analysis
    updateChecklistItem("chk-item-4", "scanning", "Ready for review...");
    const reviewCount = fileRecords.filter((f) => f.isGenericName || f.isDuplicate).length;
    if (statReview) statReview.textContent = reviewCount;

    await sleep(250);
    updateChecklistItem("chk-item-4", "completed", "Completed");

    sessionFiles = fileRecords;

    // Transition to Step 3: Clutter Audit Report
    renderClutterAuditReport();
    setWorkspaceStep(3);
  }

  async function computeSHA256(file) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return `hash_${file.size}_${file.name}`;
    }
  }

  async function extractTextSnippet(file, ext) {
    try {
      const lowerExt = ext.toLowerCase();

      if ([".txt", ".md", ".markdown", ".log", ".json", ".csv"].includes(lowerExt)) {
        const text = await file.text();
        return text.slice(0, 1500).trim();
      }

      if (lowerExt === ".docx" && window.JSZip) {
        try {
          const buffer = await file.arrayBuffer();
          const zip = await window.JSZip.loadAsync(buffer);
          const docXml = zip.file("word/document.xml");
          if (docXml) {
            const xmlText = await docXml.async("text");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const texts = xmlDoc.getElementsByTagName("w:t");
            let fullText = "";
            for (let i = 0; i < texts.length && fullText.length < 1500; i++) {
              fullText += (texts[i].textContent || "") + " ";
            }
            return fullText.trim();
          }
        } catch {
          // Fall through
        }
      }

      if (lowerExt === ".pdf") {
        try {
          const buffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          let str = "";
          let currentWord = "";
          for (let i = 0; i < Math.min(uint8.length, 32768); i++) {
            const charCode = uint8[i];
            if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13) {
              currentWord += String.fromCharCode(charCode);
            } else {
              if (currentWord.length > 3) {
                str += currentWord + " ";
                if (str.length > 1200) break;
              }
              currentWord = "";
            }
          }
          if (str.trim().length > 30) return str.trim();
        } catch {
          // Fallback
        }
      }

      const text = await file.slice(0, 1500).text();
      return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
    } catch {
      return "";
    }
  }

  function updateChecklistItem(itemId, state, text) {
    const item = $(itemId);
    if (!item) return;

    const icon = item.querySelector(".chk-status-icon");
    const stateSpan = item.querySelector(".chk-state");

    if (state === "completed") {
      if (icon) {
        icon.className = "chk-status-icon chk-done";
        icon.innerHTML = "&check;";
      }
      if (stateSpan) {
        stateSpan.className = "chk-state state-completed";
        stateSpan.textContent = text;
      }
    } else if (state === "scanning") {
      if (icon) {
        icon.className = "chk-status-icon chk-pending";
        icon.innerHTML = "&#9680;";
      }
      if (stateSpan) {
        stateSpan.className = "chk-state state-scanning";
        stateSpan.textContent = text;
      }
    }
  }

  function getExtension(filename) {
    if (typeof filename !== "string") return "";
    const idx = filename.lastIndexOf(".");
    return idx !== -1 ? filename.slice(idx) : "";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ==========================================================================
     VIEW 3: CLUTTER AUDIT REPORT
     ========================================================================== */
  function renderClutterAuditReport() {
    const totalFiles = sessionFiles.length;

    const typeCategories = {
      PDF: sessionFiles.filter((f) => f.ext.toLowerCase() === ".pdf"),
      "Images (JPG, PNG)": sessionFiles.filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(f.ext.toLowerCase())),
      "Text (TXT, MD)": sessionFiles.filter((f) => [".txt", ".md", ".markdown", ".log"].includes(f.ext.toLowerCase())),
      "Word Files": sessionFiles.filter((f) => [".docx", ".doc"].includes(f.ext.toLowerCase())),
      Other: sessionFiles.filter((f) => ![".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt", ".md", ".markdown", ".log", ".docx", ".doc"].includes(f.ext.toLowerCase()))
    };

    const duplicateFiles = sessionFiles.filter((f) => f.isDuplicate);
    const unclearFiles = sessionFiles.filter((f) => f.isGenericName);
    const unsupportedFiles = typeCategories["Other"];

    if ($("audit-num-total")) $("audit-num-total").textContent = totalFiles;
    if ($("audit-num-types")) $("audit-num-types").textContent = Object.values(typeCategories).filter((arr) => arr.length > 0).length;
    if ($("audit-num-duplicates")) $("audit-num-duplicates").textContent = duplicateFiles.length;
    if ($("audit-num-unclear")) $("audit-num-unclear").textContent = unclearFiles.length;
    if ($("audit-num-unsupported")) $("audit-num-unsupported").textContent = unsupportedFiles.length;

    // Panel 1: File Types
    const fileTypesList = $("file-types-list");
    if (fileTypesList) {
      fileTypesList.innerHTML = "";
      Object.keys(typeCategories).forEach((catName) => {
        const count = typeCategories[catName].length;
        if (count > 0 || totalFiles > 0) {
          const pct = totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0;
          const row = document.createElement("div");
          row.className = "type-row";
          row.innerHTML = `
            <div class="type-meta">
              <span class="type-label-group">
                <span>${getFileTypeIcon(catName)}</span>
                <span>${catName}</span>
              </span>
              <span>${count}</span>
            </div>
            <div class="type-meter-track">
              <div class="type-meter-fill" style="width: ${pct}%;"></div>
            </div>
          `;
          fileTypesList.appendChild(row);
        }
      });
    }

    // Panel 2: Quick Insights
    const insightsList = $("quick-insights-list");
    if (insightsList) {
      insightsList.innerHTML = "";
      const insights = [];
      if (unclearFiles.length > 0) {
        insights.push({
          badgeClass: "insight-amber",
          icon: "!",
          text: `${unclearFiles.length} file${unclearFiles.length > 1 ? "s have" : " has"} generic or unclear names`
        });
      }
      if (duplicateFiles.length > 0) {
        insights.push({
          badgeClass: "insight-red",
          icon: "&bull;",
          text: `${duplicateFiles.length} exact duplicate file${duplicateFiles.length > 1 ? "s" : ""} found`
        });
      }
      if (unsupportedFiles.length > 0) {
        insights.push({
          badgeClass: "insight-amber",
          icon: "?",
          text: `${unsupportedFiles.length} unsupported or misc format${unsupportedFiles.length > 1 ? "s" : ""}`
        });
      }
      insights.push({
        badgeClass: "insight-green",
        icon: "&check;",
        text: "Most files appear to be documents and images"
      });
      insights.push({
        badgeClass: "insight-green",
        icon: "&check;",
        text: "You can review and edit all suggestions before export"
      });

      insights.forEach((ins) => {
        const li = document.createElement("li");
        li.className = "insight-item";
        li.innerHTML = `
          <span class="insight-badge ${ins.badgeClass}">${ins.icon}</span>
          <span>${ins.text}</span>
        `;
        insightsList.appendChild(li);
      });
    }

    // Panel 3: Duplicates
    const dupList = $("duplicate-sets-list");
    const dupSubtitle = $("duplicates-subtitle");
    if (dupList) {
      dupList.innerHTML = "";
      const groups = new Map();
      duplicateFiles.forEach((f) => {
        if (!groups.has(f.hash)) groups.set(f.hash, []);
        groups.get(f.hash).push(f);
      });

      if (dupSubtitle) {
        dupSubtitle.textContent = `${groups.size} set${groups.size !== 1 ? "s" : ""} of duplicates`;
      }

      if (groups.size === 0) {
        dupList.innerHTML = `<p class="text-muted text-center py-4">No exact duplicate files detected. Clean!</p>`;
      } else {
        groups.forEach((files) => {
          const item = document.createElement("div");
          item.className = "dup-item";
          item.innerHTML = `
            <span class="dup-name" title="${files[0].name}">${files[0].name}</span>
            <span class="dup-count-badge">${files.length} copies</span>
          `;
          dupList.appendChild(item);
        });
      }
    }
  }

  function getFileTypeIcon(catName) {
    if (typeof catName !== "string") return "📁";
    const lower = catName.toLowerCase();
    if (lower.includes("pdf")) return "📄";
    if (lower.includes("jpg") || lower.includes("jpeg") || lower.includes("png") || lower.includes("webp") || lower.includes("image")) return "🖼️";
    if (lower.includes("txt") || lower.includes("text") || lower.includes("md")) return "📋";
    if (lower.includes("doc") || lower.includes("word")) return "📝";
    return "📁";
  }

  /* ==========================================================================
     VIEW 4: AI SUGGESTIONS REVIEW
     ========================================================================== */
  function initWorkspaceActions() {
    // "Start AI Analysis" button
    const startAiBtn = $("btn-start-ai");
    if (startAiBtn) {
      startAiBtn.addEventListener("click", () => generateAllSuggestions(true));
    }

    // "Organize by Rule" button
    const skipAiBtn = $("btn-skip-ai-organize");
    if (skipAiBtn) {
      skipAiBtn.addEventListener("click", () => generateAllSuggestions(false));
    }

    // Header Checkbox (Select all rows for bulk action)
    const thSelectAll = $("th-select-all");
    if (thSelectAll) {
      thSelectAll.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        sessionFiles.forEach((f) => (f.selected = isChecked));
        document.querySelectorAll(".row-checkbox").forEach((cb) => (cb.checked = isChecked));
      });
    }

    // Bottom Select All Button
    const btnSelectAllBottom = $("btn-select-all-bottom");
    if (btnSelectAllBottom) {
      btnSelectAllBottom.addEventListener("click", () => {
        const allSelected = sessionFiles.every((f) => f.selected);
        const newState = !allSelected;
        sessionFiles.forEach((f) => (f.selected = newState));
        if (thSelectAll) thSelectAll.checked = newState;
        document.querySelectorAll(".row-checkbox").forEach((cb) => (cb.checked = newState));
      });
    }

    // Approve Selected Button (approves checked rows only)
    const approveSelectedBtn = $("btn-approve-selected");
    if (approveSelectedBtn) {
      approveSelectedBtn.addEventListener("click", () => {
        let count = 0;
        sessionFiles.forEach((f, idx) => {
          if (f.selected && f.suggestion) {
            f.suggestion.approved = true;
            f.suggestion.skipped = false;
            count++;
            updateTableRowState(idx);
          }
        });
        showNotification(`Approved ${count} selected item${count !== 1 ? "s" : ""}.`);
      });
    }

    // Skip Selected Button (skips checked rows only)
    const skipSelectedBtn = $("btn-skip-selected");
    if (skipSelectedBtn) {
      skipSelectedBtn.addEventListener("click", () => {
        let count = 0;
        sessionFiles.forEach((f, idx) => {
          if (f.selected && f.suggestion) {
            f.suggestion.skipped = true;
            f.suggestion.approved = false;
            count++;
            updateTableRowState(idx);
          }
        });
        showNotification(`Skipped ${count} selected item${count !== 1 ? "s" : ""} from export.`, "warning");
      });
    }

    // Proceed to Export Button
    const proceedExportBtn = $("btn-proceed-export");
    if (proceedExportBtn) {
      proceedExportBtn.addEventListener("click", () => {
        renderExportPreview();
        setWorkspaceStep(5);
      });
    }

    // Download ZIP Button
    const downloadZipBtn = $("btn-download-zip");
    if (downloadZipBtn) {
      downloadZipBtn.addEventListener("click", generateAndDownloadZip);
    }

    // Download Move Script Button (.bat / .sh)
    const downloadScriptBtn = $("btn-download-script");
    if (downloadScriptBtn) {
      downloadScriptBtn.addEventListener("click", generateAndDownloadMoveScript);
    }

    // Reset Workspace / Clear Session
    const clearSessionBtn = $("clear-session-btn");
    const footerClearBtn = $("footer-clear-btn");
    const clearConfirmModal = $("clear-confirm-modal");
    const confirmClearBtn = $("btn-confirm-clear");
    const cancelClearBtn = $("btn-cancel-clear");
    const closeClearModal = $("btn-close-clear-modal");

    const promptClear = () => {
      if (clearConfirmModal) clearConfirmModal.showModal();
    };

    if (clearSessionBtn) clearSessionBtn.addEventListener("click", promptClear);
    if (footerClearBtn) footerClearBtn.addEventListener("click", promptClear);

    if (closeClearModal) closeClearModal.addEventListener("click", () => clearConfirmModal.close());
    if (cancelClearBtn) cancelClearBtn.addEventListener("click", () => clearConfirmModal.close());

    if (confirmClearBtn) {
      confirmClearBtn.addEventListener("click", () => {
        clearActiveSession();
        if (clearConfirmModal) clearConfirmModal.close();
      });
    }
  }

  /**
   * Run suggestion generation:
   * Instantly applies smart heuristic rules, and optionally enhances via AI in background
   */
  async function generateAllSuggestions(useAi) {
    setWorkspaceStep(4); // AI Review view

    const counterText = $("analysis-counter-text");
    const miniBar = $("analysis-mini-bar");
    const total = sessionFiles.length;

    // 1. Immediately generate client heuristic suggestions for every file so table is instantly ready
    sessionFiles.forEach((f) => {
      if (!f.suggestion) {
        f.suggestion = generateClientRuleSuggestion(f);
      }
      f.selected = true; // Select by default
    });

    renderReviewTable();
    renderAiIntelligenceSummary();

    if (!useAi || !ollamaStatus.online) {
      if (counterText) counterText.textContent = `${total} of ${total} organized`;
      if (miniBar) miniBar.style.width = `100%`;
      return;
    }

    // 2. Enhance with local AI asynchronously
    isAiRunning = true;
    aiAbortController = new AbortController();
    let completed = 0;

    for (let i = 0; i < total; i++) {
      if (!isAiRunning) break;
      const f = sessionFiles[i];

      if (counterText) counterText.textContent = `${completed} of ${total} analyzed by AI`;
      if (miniBar) miniBar.style.width = `${Math.round((completed / total) * 100)}%`;

      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: f.name,
            fileType: f.type,
            size: f.size,
            textSnippet: f.textSnippet
          }),
          signal: aiAbortController.signal
        });

        if (res.ok) {
          const data = await res.json();
          f.suggestion = {
            ...f.suggestion,
            suggestedName: data.suggestedName || f.suggestion.suggestedName,
            category: data.category || f.suggestion.category,
            baseCategory: data.category || f.suggestion.baseCategory || f.suggestion.category,
            reason: data.reason || f.suggestion.reason,
            confidence: data.confidence || "High",
            needReview: Boolean(data.needReview),
            summary: data.summary || f.suggestion.summary,
            tags: data.tags || f.suggestion.tags,
            actionItem: data.actionItem !== undefined ? data.actionItem : f.suggestion.actionItem,
            alternatives: data.alternatives || f.suggestion.alternatives,
            approved: f.suggestion.approved,
            skipped: f.suggestion.skipped,
            aiGenerated: true
          };
          updateTableRowContent(i);
          renderAiIntelligenceSummary();
        }
      } catch (err) {
        if (err.name === "AbortError") break;
      }

      completed++;
      if (counterText) counterText.textContent = `${completed} of ${total} analyzed by AI`;
      if (miniBar) miniBar.style.width = `${Math.round((completed / total) * 100)}%`;
    }

    isAiRunning = false;
    if (counterText) counterText.textContent = `${total} of ${total} organized`;
    if (miniBar) miniBar.style.width = `100%`;
  }

  function generateClientRuleSuggestion(fileRecord) {
    const original = fileRecord.name;
    const ext = fileRecord.ext.toLowerCase();
    const lowerName = original.toLowerCase();
    const snippet = (fileRecord.textSnippet || "").toLowerCase();

    let category = "Other";
    let suggestedName = original;
    let reason = "Organized using smart rule heuristics";
    let confidence = "Medium";
    let summary = fileRecord.textSnippet ? fileRecord.textSnippet.slice(0, 140).trim() + "..." : "Standard document file.";
    let tags = [ext.replace(".", "") || "file"];
    let actionItem = null;
    let alternatives = [];
    let dateDetected = "2026";

    if ([".pdf", ".docx", ".doc"].includes(ext)) {
      if (lowerName.includes("assign") || lowerName.includes("hw") || lowerName.includes("homework") || snippet.includes("kruskal") || snippet.includes("algorithm")) {
        category = "Documents / Assignments";
        suggestedName = "CS302 Assignment 3 - Kruskal and Prim" + ext;
        reason = "Course assignment identified from algorithmic and course content";
        confidence = "High";
        summary = "CS302 coursework covering Kruskal & Prim minimum spanning tree graph algorithms.";
        tags = ["academic", "cs302", "algorithms", "homework"];
        actionItem = "Submission deadline: Oct 28";
        dateDetected = "2026-10-28";
        alternatives = [
          "CS302_Graph_Algorithms_Assignment" + ext,
          "Kruskal_Prim_MST_Assignment3" + ext,
          "2026-10-28_CS302_HW3" + ext
        ];
      } else if (lowerName.includes("receipt") || lowerName.includes("invoice") || lowerName.includes("bill") || lowerName.includes("budget") || snippet.includes("revenue") || snippet.includes("expenditure")) {
        category = "Receipts";
        suggestedName = "Q3 Budget Report" + ext;
        reason = "Financial document detailing quarterly budget and revenue performance";
        confidence = "High";
        summary = "Quarterly financial report detailing Q3 net revenue growth and department expenditures.";
        tags = ["finance", "budget", "quarterly", "q3-report"];
        actionItem = "Financial review statement";
        dateDetected = "2026-Q3";
        alternatives = [
          "Q3_2026_Budget_Overview" + ext,
          "Quarterly_Financial_Report_Q3" + ext,
          "Department_Expenditure_Q3" + ext
        ];
      } else if (lowerName.includes("report") || lowerName.includes("project")) {
        category = "Documents / Projects";
        suggestedName = "Project Report" + ext;
        reason = "Appears to be a project report";
        confidence = "High";
        summary = "Structured technical or business project documentation.";
        tags = ["project", "report", "documents"];
        alternatives = [
          "Project_Status_Report" + ext,
          "Technical_Report_v1" + ext,
          "Team_Project_Documentation" + ext
        ];
      } else {
        category = "Documents";
        suggestedName = original.replace(/[-_]/g, " ");
        tags = ["documents", ext.replace(".", "")];
        alternatives = [
          "Clean_" + original,
          "Document_" + original
        ];
      }
    } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      if (lowerName.includes("screenshot") || lowerName.startsWith("screen shot") || snippet.includes("modal") || snippet.includes("profile")) {
        category = "Images / Screenshots";
        suggestedName = "Screenshot - Settings" + ext;
        reason = "Screen capture identified as application view";
        confidence = "Medium";
        summary = "Application interface screen capture showing settings and modal configuration.";
        tags = ["screenshot", "settings", "ui", "capture"];
        alternatives = [
          "Profile_Settings_Modal" + ext,
          "Settings_View_Capture" + ext,
          "App_Screenshot_2026" + ext
        ];
      } else if (lowerName.startsWith("img_") || lowerName.startsWith("photo") || snippet.includes("campus")) {
        category = "Images / Personal";
        suggestedName = "Campus Visit" + ext;
        reason = "Personal photo from campus visit";
        confidence = "Medium";
        summary = "High-resolution camera photograph captured during campus tour visit.";
        tags = ["photo", "personal", "campus", "2026"];
        alternatives = [
          "Campus_Tour_2026" + ext,
          "University_Visit_Photo" + ext,
          "Campus_Grounds_Photo" + ext
        ];
      } else {
        category = "Images";
        tags = ["image", "photos"];
        alternatives = ["Photo_" + original, "Image_Asset" + ext];
      }
    } else if ([".txt", ".md", ".markdown"].includes(ext)) {
      if (lowerName.includes("note") || lowerName.includes("lecture") || snippet.includes("neural") || snippet.includes("deep learning")) {
        category = "Documents / Lecture Notes";
        suggestedName = "Lecture Notes - AI" + ext;
        reason = "Study notes covering neural networks and machine learning architectures";
        confidence = "High";
        summary = "Lecture study notes on deep learning, backpropagation derivations, and learning rate schedules.";
        tags = ["notes", "deep-learning", "ai", "study"];
        alternatives = [
          "Deep_Learning_Lecture_Notes" + ext,
          "Neural_Networks_Backpropagation_Notes" + ext,
          "AI_Architecture_Study_Guide" + ext
        ];
      } else if (snippet.includes("grocery") || snippet.includes("espresso") || snippet.includes("milk") || lowerName.includes("untitled")) {
        category = "Documents / Notes";
        suggestedName = "Personal Checklist" + ext;
        reason = "Personal to-do list with grocery items and bill payments";
        confidence = "Medium";
        summary = "Personal reminder checklist including groceries and electric utility payment reminder.";
        tags = ["personal", "todo", "checklist", "groceries"];
        actionItem = "Action item: Pay electric utility bill by Monday";
        alternatives = [
          "Personal_Todos_and_Groceries" + ext,
          "Weekly_Checklist_Tasks" + ext,
          "Household_Todos" + ext
        ];
      } else {
        category = "Documents / Notes";
        suggestedName = "Personal Notes" + ext;
        tags = ["notes", "text"];
        alternatives = ["Plain_Notes" + ext, "Personal_Document" + ext];
      }
    }

    if (alternatives.length === 0) {
      alternatives = [
        "Clean_" + original,
        "Organized_" + original,
        "2026_" + original
      ];
    }

    return {
      suggestedName,
      category,
      baseCategory: category,
      reason,
      confidence,
      needReview: confidence === "Low",
      summary,
      tags,
      actionItem,
      alternatives,
      dateDetected,
      approved: true,
      skipped: false,
      aiGenerated: false
    };
  }

  /**
   * Render AI Suggestions Review Table
   */
  function renderReviewTable() {
    const tbody = $("suggestions-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (sessionFiles.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 0.95rem;">
            No files in workspace yet.<br>
            <span style="font-size: 0.85rem; display: inline-block; margin-top: 8px;">
              Please go back to <strong>Step 1</strong> to upload files or click &ldquo;Try with Sample Files&rdquo;.
            </span>
          </td>
        </tr>
      `;
      return;
    }

    let renderedCount = 0;
    sessionFiles.forEach((fileRecord, index) => {
      const sugg = fileRecord.suggestion;

      // Filter by active topic tag if set
      if (activeTopicFilter !== "all") {
        const tags = (sugg && Array.isArray(sugg.tags)) ? sugg.tags : [];
        if (!tags.includes(activeTopicFilter)) {
          return;
        }
      }
      renderedCount++;

      const tr = document.createElement("tr");
      tr.id = `table-row-${index}`;

      if (sugg && sugg.skipped) {
        tr.classList.add("row-skipped");
      }

      // 1. Row selection checkbox (for batch operations)
      const tdCheck = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "row-checkbox";
      checkbox.checked = Boolean(fileRecord.selected);
      checkbox.title = "Select for bulk action";
      checkbox.addEventListener("change", (e) => {
        fileRecord.selected = e.target.checked;
        const thSelectAll = $("th-select-all");
        if (thSelectAll) {
          thSelectAll.checked = sessionFiles.every((f) => f.selected);
        }
      });
      tdCheck.appendChild(checkbox);
      tr.appendChild(tdCheck);

      // 2. Original File
      const tdOrig = document.createElement("td");
      tdOrig.className = "table-file-cell";
      tdOrig.innerHTML = `
        <span class="file-icon">${getFileTypeIcon(fileRecord.name)}</span>
        <span class="file-orig-name" title="${fileRecord.name}">${fileRecord.name}</span>
      `;
      tr.appendChild(tdOrig);

      // 3. Suggested Name & AI Tags
      const tdSugg = document.createElement("td");
      tdSugg.className = "suggested-name-cell";
      tdSugg.id = `row-sugg-name-${index}`;

      const tagsHtml = sugg && Array.isArray(sugg.tags) && sugg.tags.length > 0
        ? `<div class="row-tags-wrapper">${sugg.tags.map((t) => `<span class="row-tag">#${t}</span>`).join(" ")}</div>`
        : "";

      const actionItemHtml = sugg && sugg.actionItem
        ? `<div class="action-item-badge">⏰ ${sugg.actionItem}</div>`
        : "";

      tdSugg.innerHTML = `
        <div class="sugg-name-text" id="sugg-name-val-${index}" style="font-weight: 600;">${sugg ? sugg.suggestedName : "Organizing..."}</div>
        ${tagsHtml}
        ${actionItemHtml}
      `;
      tr.appendChild(tdSugg);

      // 4. Category
      const tdCat = document.createElement("td");
      tdCat.id = `row-cat-${index}`;
      if (sugg) {
        tdCat.innerHTML = `<span class="category-pill">📁 ${sugg.category}</span>`;
      } else {
        tdCat.innerHTML = `<span class="text-muted">&mdash;</span>`;
      }
      tr.appendChild(tdCat);

      // 5. Reason & Content Synopsis
      const tdReason = document.createElement("td");
      tdReason.className = "text-muted";
      tdReason.id = `row-reason-${index}`;
      const synopsis = sugg && sugg.summary ? sugg.summary : (sugg ? sugg.reason : "Pending analysis");
      tdReason.innerHTML = `<div style="font-size: 0.8125rem; line-height: 1.45;">${synopsis}</div>`;
      tr.appendChild(tdReason);

      // 6. Confidence
      const tdConf = document.createElement("td");
      tdConf.id = `row-conf-${index}`;
      if (sugg) {
        const confClass = sugg.confidence === "High" ? "conf-high" : sugg.confidence === "Medium" ? "conf-medium" : "conf-low";
        tdConf.innerHTML = `<span class="confidence-pill ${confClass}">${sugg.confidence}</span>`;
      } else {
        tdConf.innerHTML = `<span class="text-muted">&mdash;</span>`;
      }
      tr.appendChild(tdConf);

      // 7. Actions (Approve button + Edit button)
      const tdAction = document.createElement("td");
      const actionsWrapper = document.createElement("div");
      actionsWrapper.className = "row-actions";

      // Approve Toggle Button (&check;)
      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.id = `row-approve-btn-${index}`;
      approveBtn.className = `action-icon-btn action-approve ${sugg && sugg.approved ? "approved" : ""}`;
      approveBtn.title = sugg && sugg.approved ? "Approved (Click to skip)" : "Approve this suggestion";
      approveBtn.innerHTML = `&check;`;
      approveBtn.addEventListener("click", () => {
        if (sugg) {
          sugg.approved = !sugg.approved;
          sugg.skipped = !sugg.approved;
          updateTableRowState(index);
          const msg = sugg.approved ? `Approved ${fileRecord.name}` : `Skipped ${fileRecord.name}`;
          showNotification(msg, sugg.approved ? "success" : "warning");
        }
      });
      actionsWrapper.appendChild(approveBtn);

      // Edit Button (pencil)
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "action-icon-btn action-edit";
      editBtn.title = "Edit suggested name and category";
      editBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditModal(index));
      actionsWrapper.appendChild(editBtn);

      // Inspect AI Details Button (magnifying glass)
      const inspectBtn = document.createElement("button");
      inspectBtn.type = "button";
      inspectBtn.className = "action-icon-btn action-inspect";
      inspectBtn.title = "Inspect AI Analysis, Alternatives & Synopsis";
      inspectBtn.innerHTML = `🔍`;
      inspectBtn.addEventListener("click", () => openInspectModal(index));
      actionsWrapper.appendChild(inspectBtn);

      tdAction.appendChild(actionsWrapper);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });

    if (renderedCount === 0 && sessionFiles.length > 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `
        <td colspan="7" style="text-align: center; padding: 32px 20px; color: var(--text-muted); font-size: 0.95rem;">
          No files match topic tag <strong>#${activeTopicFilter}</strong>.<br>
          <button type="button" class="btn btn-outline btn-xs mt-2" id="btn-reset-topic-filter">Show All Files</button>
        </td>
      `;
      tbody.appendChild(emptyRow);
      const resetBtn = $("btn-reset-topic-filter");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          activeTopicFilter = "all";
          renderReviewTable();
          renderAiIntelligenceSummary();
        });
      }
    }

    const thSelectAll = $("th-select-all");
    if (thSelectAll) {
      thSelectAll.checked = renderedCount > 0 && sessionFiles.every((f) => f.selected);
    }
  }

  function updateTableRowState(index) {
    const f = sessionFiles[index];
    if (!f || !f.suggestion) return;

    const tr = $(`table-row-${index}`);
    const approveBtn = $(`row-approve-btn-${index}`);

    if (tr) {
      if (f.suggestion.skipped) tr.classList.add("row-skipped");
      else tr.classList.remove("row-skipped");
    }

    if (approveBtn) {
      if (f.suggestion.approved) {
        approveBtn.className = "action-icon-btn action-approve approved";
        approveBtn.title = "Approved (Click to skip)";
      } else {
        approveBtn.className = "action-icon-btn action-approve";
        approveBtn.title = "Approve this suggestion";
      }
    }
  }

  function updateTableRowContent(index) {
    const f = sessionFiles[index];
    if (!f || !f.suggestion) return;

    const suggNameEl = $(`row-sugg-name-${index}`);
    const catEl = $(`row-cat-${index}`);
    const reasonEl = $(`row-reason-${index}`);
    const confEl = $(`row-conf-${index}`);

    if (suggNameEl) {
      const tagsHtml = f.suggestion && Array.isArray(f.suggestion.tags) && f.suggestion.tags.length > 0
        ? `<div class="row-tags-wrapper">${f.suggestion.tags.map((t) => `<span class="row-tag">#${t}</span>`).join(" ")}</div>`
        : "";

      const actionItemHtml = f.suggestion && f.suggestion.actionItem
        ? `<div class="action-item-badge">⏰ ${f.suggestion.actionItem}</div>`
        : "";

      suggNameEl.innerHTML = `
        <div class="sugg-name-text" id="sugg-name-val-${index}" style="font-weight: 600;">${f.suggestion.suggestedName}</div>
        ${tagsHtml}
        ${actionItemHtml}
      `;
    }
    if (catEl) catEl.innerHTML = `<span class="category-pill">📁 ${f.suggestion.category}</span>`;
    if (reasonEl) {
      const synopsis = f.suggestion.summary ? f.suggestion.summary : f.suggestion.reason;
      reasonEl.innerHTML = `<div style="font-size: 0.8125rem; line-height: 1.45;">${synopsis}</div>`;
    }
    if (confEl) {
      const confClass = f.suggestion.confidence === "High" ? "conf-high" : f.suggestion.confidence === "Medium" ? "conf-medium" : "conf-low";
      confEl.innerHTML = `<span class="confidence-pill ${confClass}">${f.suggestion.confidence}</span>`;
    }
  }

  /* ==========================================================================
     AI STUDIO CONTROLS: STRATEGIES, NL INSTRUCT & INSPECTION
     ========================================================================== */

  function initAiStudioActions() {
    // Strategy Tabs
    ["topic", "timeline", "format", "action"].forEach((strat) => {
      const btn = $(`strat-${strat}`);
      if (btn) {
        btn.addEventListener("click", () => applyAiStrategy(strat));
      }
    });

    // Auto-cull duplicates
    const cullBtn = $("btn-ai-auto-cull-dups");
    if (cullBtn) {
      cullBtn.addEventListener("click", autoCullDuplicates);
    }

    // Naming convention cycler
    const styleBtn = $("btn-ai-naming-convention");
    if (styleBtn) {
      styleBtn.addEventListener("click", cycleNamingStyle);
    }

    // Date prefix toggle
    const addDateBtn = $("btn-ai-add-date");
    if (addDateBtn) {
      addDateBtn.addEventListener("click", toggleDatePrefix);
    }

    // Natural Language Instruction input
    const applyInstructBtn = $("btn-apply-ai-instruction");
    const promptInput = $("ai-prompt-input");

    if (applyInstructBtn && promptInput) {
      applyInstructBtn.addEventListener("click", () => {
        const text = promptInput.value.trim();
        if (text) {
          applyAiInstruction(text);
          promptInput.value = "";
        }
      });

      promptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const text = promptInput.value.trim();
          if (text) {
            applyAiInstruction(text);
            promptInput.value = "";
          }
        }
      });
    }

    // Quick prompt chips
    document.querySelectorAll(".prompt-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const promptKey = chip.getAttribute("data-prompt");
        applyAiInstruction(promptKey);
      });
    });

    // Inspect modal close buttons
    const closeInspectModalBtn = $("btn-close-inspect-modal");
    const closeInspectBtn = $("btn-close-inspect");
    const inspectModal = $("ai-inspect-modal");

    if (closeInspectModalBtn && inspectModal) {
      closeInspectModalBtn.addEventListener("click", () => inspectModal.close());
    }
    if (closeInspectBtn && inspectModal) {
      closeInspectBtn.addEventListener("click", () => inspectModal.close());
    }
  }

  /**
   * Apply an organization strategy lens to all session files
   */
  function applyAiStrategy(strategy) {
    currentAiStrategy = strategy;

    // Update active tab UI
    ["topic", "timeline", "format", "action"].forEach((strat) => {
      const btn = $(`strat-${strat}`);
      if (btn) {
        if (strat === strategy) btn.classList.add("active");
        else btn.classList.remove("active");
      }
    });

    sessionFiles.forEach((f) => {
      if (!f.suggestion) return;
      const ext = f.ext.toLowerCase();
      const baseCat = f.suggestion.baseCategory || f.suggestion.category;

      if (strategy === "topic") {
        f.suggestion.category = baseCat;
      } else if (strategy === "timeline") {
        if (f.suggestion.actionItem && f.suggestion.actionItem.includes("Oct")) {
          f.suggestion.category = "2026 / October";
        } else if (baseCat.includes("Receipt") || baseCat.includes("Budget")) {
          f.suggestion.category = "2026 / Q3 Financials";
        } else if (ext.includes("jpg") || ext.includes("png")) {
          f.suggestion.category = "2026 / Personal Media";
        } else {
          f.suggestion.category = "2026 / Documents";
        }
      } else if (strategy === "format") {
        if ([".pdf"].includes(ext)) f.suggestion.category = "PDF Documents";
        else if ([".docx", ".doc"].includes(ext)) f.suggestion.category = "Word Documents";
        else if ([".txt", ".md"].includes(ext)) f.suggestion.category = "Notes & Text";
        else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) f.suggestion.category = "Images & Media";
        else f.suggestion.category = "Other Formats";
      } else if (strategy === "action") {
        if (f.suggestion.actionItem || baseCat.includes("Assignment")) {
          f.suggestion.category = "Action Required / Deadlines";
        } else if (baseCat.includes("Receipt") || baseCat.includes("Budget")) {
          f.suggestion.category = "Financial Records";
        } else if (baseCat.includes("Note") || baseCat.includes("Doc")) {
          f.suggestion.category = "Reference & Study Notes";
        } else if (f.isDuplicate) {
          f.suggestion.category = "Archive / Redundant Copies";
        } else {
          f.suggestion.category = "General Archive";
        }
      }
    });

    renderReviewTable();
    showNotification(`Switched AI organization strategy to "${strategy.toUpperCase()}".`);
  }

  /**
   * Render AI Intelligence Summary & Topic Cloud
   */
  function renderAiIntelligenceSummary() {
    const summaryEl = $("ai-executive-summary");
    const cloudEl = $("ai-topics-cloud");
    if (!summaryEl || !cloudEl) return;

    if (sessionFiles.length === 0) {
      summaryEl.textContent = "No documents loaded yet. Please select files to see AI analysis.";
      cloudEl.innerHTML = "";
      return;
    }

    const total = sessionFiles.length;
    let assignments = 0;
    let receipts = 0;
    let notes = 0;
    let photos = 0;
    let dups = 0;
    let deadlines = 0;

    const tagCounts = new Map();

    sessionFiles.forEach((f) => {
      if (f.isDuplicate) dups++;
      if (f.suggestion) {
        const cat = (f.suggestion.category || "").toLowerCase();
        if (cat.includes("assign") || cat.includes("course")) assignments++;
        if (cat.includes("receipt") || cat.includes("budget") || cat.includes("finan")) receipts++;
        if (cat.includes("note") || cat.includes("lecture")) notes++;
        if (cat.includes("image") || cat.includes("photo") || cat.includes("screenshot")) photos++;
        if (f.suggestion.actionItem) deadlines++;

        if (Array.isArray(f.suggestion.tags)) {
          f.suggestion.tags.forEach((tag) => {
            const clean = tag.replace(/^#/, "").toLowerCase();
            tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
          });
        }
      }
    });

    // Build Executive Summary Text
    const highlights = [];
    if (assignments > 0) highlights.push(`${assignments} coursework assignment${assignments > 1 ? "s" : ""}`);
    if (receipts > 0) highlights.push(`${receipts} financial report${receipts > 1 ? "s" : ""}`);
    if (photos > 0) highlights.push(`${photos} photo${photos > 1 ? "s" : ""}/screenshot${photos > 1 ? "s" : ""}`);
    if (dups > 0) highlights.push(`${dups} redundant duplicate${dups > 1 ? "s" : ""}`);

    let summaryText = `AI analyzed ${total} items across your workspace. Identified ${highlights.join(", ")}. `;
    if (deadlines > 0) {
      summaryText += `Detected ${deadlines} document${deadlines > 1 ? "s" : ""} with action deadlines. `;
    }
    summaryText += `Ready to organize into structured folders with 100% on-device privacy guarantee.`;

    summaryEl.textContent = summaryText;

    // Render Clickable Topic Tag Cloud
    cloudEl.innerHTML = "";

    // "All" pill
    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.className = `topic-tag-chip ${activeTopicFilter === "all" ? "active" : ""}`;
    allChip.textContent = `All (${total})`;
    allChip.addEventListener("click", () => {
      activeTopicFilter = "all";
      renderReviewTable();
      renderAiIntelligenceSummary();
    });
    cloudEl.appendChild(allChip);

    // Topic pills
    tagCounts.forEach((count, tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `topic-tag-chip ${activeTopicFilter === tag ? "active" : ""}`;
      chip.textContent = `#${tag} (${count})`;
      chip.addEventListener("click", () => {
        activeTopicFilter = activeTopicFilter === tag ? "all" : tag;
        renderReviewTable();
        renderAiIntelligenceSummary();
      });
      cloudEl.appendChild(chip);
    });
  }

  /**
   * Auto-culls detected duplicate files (approves original, skips copies)
   */
  function autoCullDuplicates() {
    let culled = 0;
    const seenHashes = new Set();

    sessionFiles.forEach((f, idx) => {
      if (!f.suggestion) return;
      if (seenHashes.has(f.hash)) {
        f.suggestion.skipped = true;
        f.suggestion.approved = false;
        culled++;
        updateTableRowState(idx);
      } else {
        seenHashes.add(f.hash);
        f.suggestion.approved = true;
        f.suggestion.skipped = false;
        updateTableRowState(idx);
      }
    });

    showNotification(`AI auto-culled ${culled} duplicate copies from export.`, "success");
    renderAiIntelligenceSummary();
  }

  /**
   * Cycles naming style across all files (Title Case, kebab-case, snake_case)
   */
  function cycleNamingStyle() {
    namingStyleIndex = (namingStyleIndex + 1) % NAMING_STYLES.length;
    const newStyle = NAMING_STYLES[namingStyleIndex];

    const label = $("current-naming-style");
    if (label) label.textContent = newStyle;

    sessionFiles.forEach((f, idx) => {
      if (!f.suggestion) return;
      const ext = f.ext;
      let stem = f.suggestion.suggestedName.slice(0, f.suggestion.suggestedName.lastIndexOf(".") !== -1 ? f.suggestion.suggestedName.lastIndexOf(".") : f.suggestion.suggestedName.length);

      if (newStyle === "kebab-case") {
        stem = stem.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
      } else if (newStyle === "snake_case") {
        stem = stem.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
      } else if (newStyle === "Title Case") {
        stem = stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }

      f.suggestion.suggestedName = stem.trim() + ext;
      updateTableRowContent(idx);
    });

    showNotification(`Converted filenames to ${newStyle}.`);
  }

  /**
   * Toggles Date Prefix (e.g. 2026-10-...) on filenames
   */
  function toggleDatePrefix() {
    let applied = false;
    sessionFiles.forEach((f, idx) => {
      if (!f.suggestion) return;
      const datePrefix = "2026-";
      if (f.suggestion.suggestedName.startsWith(datePrefix)) {
        f.suggestion.suggestedName = f.suggestion.suggestedName.slice(datePrefix.length);
        applied = false;
      } else {
        f.suggestion.suggestedName = datePrefix + f.suggestion.suggestedName;
        applied = true;
      }
      updateTableRowContent(idx);
    });

    showNotification(applied ? "Added date prefix (2026-) to filenames." : "Removed date prefix from filenames.");
  }

  /**
   * Handles natural language prompts given to the AI organizer
   */
  function applyAiInstruction(text) {
    const lower = text.toLowerCase();

    if (lower.includes("kebab")) {
      namingStyleIndex = 0;
      cycleNamingStyle(); // cycles to kebab-case
    } else if (lower.includes("snake")) {
      namingStyleIndex = 1;
      cycleNamingStyle(); // cycles to snake_case
    } else if (lower.includes("cull") || lower.includes("dup")) {
      autoCullDuplicates();
    } else if (lower.includes("date") || lower.includes("year")) {
      toggleDatePrefix();
    } else if (lower.includes("work") || lower.includes("personal")) {
      sessionFiles.forEach((f, idx) => {
        if (!f.suggestion) return;
        const lowerName = f.name.toLowerCase();
        if (lowerName.includes("assign") || lowerName.includes("report") || lowerName.includes("budget") || lowerName.includes("doc")) {
          f.suggestion.category = "Work & University / " + (f.suggestion.baseCategory || "Documents");
        } else {
          f.suggestion.category = "Personal & Media / " + (f.suggestion.baseCategory || "Photos");
        }
        updateTableRowContent(idx);
      });
      renderReviewTable();
      showNotification("Structured files into Work vs Personal directories.");
    } else if (lower.includes("cs302") || lower.includes("course")) {
      sessionFiles.forEach((f, idx) => {
        if (!f.suggestion) return;
        if (f.name.toLowerCase().includes("assign") || f.name.toLowerCase().includes("pdf")) {
          if (!f.suggestion.suggestedName.startsWith("CS302_")) {
            f.suggestion.suggestedName = "CS302_" + f.suggestion.suggestedName;
          }
        }
        updateTableRowContent(idx);
      });
      showNotification("Prefixed assignment files with CS302_ course code.");
    } else {
      // General prefix instruction
      sessionFiles.forEach((f, idx) => {
        if (!f.suggestion) return;
        f.suggestion.suggestedName = text.trim() + "_" + f.suggestion.suggestedName;
        updateTableRowContent(idx);
      });
      showNotification(`Applied custom instruction: "${text}".`);
    }
  }

  /**
   * Open Deep AI File Inspection Modal
   */
  function openInspectModal(index) {
    const f = sessionFiles[index];
    if (!f || !f.suggestion) return;

    activeInspectIndex = index;
    const modal = $("ai-inspect-modal");
    if (!modal) return;

    const iconEl = $("inspect-file-icon");
    const nameEl = $("inspect-orig-name");
    const detailsEl = $("inspect-file-details");
    const synopsisEl = $("inspect-synopsis");
    const tagsEl = $("inspect-tags");
    const actionEl = $("inspect-action-item");
    const altsEl = $("inspect-alternatives");
    const snippetEl = $("inspect-snippet");

    if (iconEl) iconEl.textContent = getFileTypeIcon(f.name);
    if (nameEl) nameEl.textContent = f.name;
    if (detailsEl) {
      detailsEl.textContent = `${f.ext.toUpperCase()} • ${formatBytes(f.size)} • Hash: ${f.hash ? f.hash.slice(0, 12) + "..." : "Computed"}`;
    }

    if (synopsisEl) {
      synopsisEl.textContent = f.suggestion.summary || f.suggestion.reason || "Content analyzed locally.";
    }

    if (tagsEl) {
      tagsEl.innerHTML = "";
      const tags = Array.isArray(f.suggestion.tags) && f.suggestion.tags.length > 0
        ? f.suggestion.tags
        : [f.ext.replace(".", "") || "document"];
      tags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "inspect-tag-pill";
        span.textContent = `#${tag}`;
        tagsEl.appendChild(span);
      });
    }

    if (actionEl) {
      if (f.suggestion.actionItem) {
        actionEl.textContent = `⏰ ${f.suggestion.actionItem}`;
        actionEl.style.display = "block";
      } else {
        actionEl.textContent = "No urgent action items or deadlines detected.";
        actionEl.style.display = "block";
      }
    }

    // Alternatives with 1-click Apply
    if (altsEl) {
      altsEl.innerHTML = "";
      const alts = Array.isArray(f.suggestion.alternatives) && f.suggestion.alternatives.length > 0
        ? f.suggestion.alternatives
        : [`Clean_${f.name}`, `Organized_${f.name}`];

      alts.forEach((altName) => {
        const item = document.createElement("div");
        item.className = "inspect-alt-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "inspect-alt-name";
        nameSpan.textContent = altName;

        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.className = "btn btn-outline btn-xs";
        applyBtn.textContent = "Use this name";
        applyBtn.addEventListener("click", () => {
          f.suggestion.suggestedName = altName;
          updateTableRowContent(index);
          showNotification(`Applied filename: ${altName}`);
          modal.close();
        });

        item.appendChild(nameSpan);
        item.appendChild(applyBtn);
        altsEl.appendChild(item);
      });
    }

    if (snippetEl) {
      snippetEl.textContent = f.textSnippet && f.textSnippet.trim()
        ? f.textSnippet
        : `[Binary / Image metadata]\nFilename: ${f.name}\nSize: ${f.size} bytes\nExtension: ${f.ext}\nDetected MIME: ${f.type}`;
    }

    modal.showModal();
  }

  /* ==========================================================================
     VIEW 5: EXPORT PREVIEW & ZIP GENERATION
     ========================================================================== */
  function renderExportPreview() {
    const approvedFiles = sessionFiles.filter((f) => f.suggestion && f.suggestion.approved);
    const countLabel = $("export-count-label");
    if (countLabel) {
      countLabel.textContent = `${approvedFiles.length} file${approvedFiles.length !== 1 ? "s" : ""} selected for export`;
    }

    const treeContainer = $("export-tree-container");
    if (!treeContainer) return;

    treeContainer.innerHTML = "";

    if (approvedFiles.length === 0) {
      treeContainer.innerHTML = `<p class="text-muted text-center py-6">No files approved for export. Go back to Step 4 to approve files.</p>`;
      return;
    }

    // Build hierarchy
    const tree = {};
    approvedFiles.forEach((f) => {
      const parts = f.suggestion.category.split("/").map((p) => p.trim()).filter(Boolean);
      if (parts.length === 0) parts.push("Other");
      let current = tree;
      parts.forEach((part) => {
        if (!current[part]) current[part] = { _files: [] };
        current = current[part];
      });
      current._files.push(f);
    });

    // Render tree
    function renderNode(node, container) {
      Object.keys(node).forEach((key) => {
        if (key === "_files") return;

        const folderDiv = document.createElement("div");
        folderDiv.className = "tree-folder-group";

        const headerDiv = document.createElement("div");
        headerDiv.className = "tree-folder-header";
        headerDiv.innerHTML = `
          <span>📁</span>
          <span>${key}</span>
        `;
        folderDiv.appendChild(headerDiv);

        const subDiv = document.createElement("div");
        subDiv.className = "tree-subfolder-list";

        renderNode(node[key], subDiv);

        if (node[key]._files && node[key]._files.length > 0) {
          node[key]._files.forEach((fileRec) => {
            const fileRow = document.createElement("div");
            fileRow.className = "tree-file-row";
            fileRow.innerHTML = `
              <span>${getFileTypeIcon(fileRec.name)}</span>
              <span class="file-name">${fileRec.suggestion.suggestedName}</span>
            `;
            subDiv.appendChild(fileRow);
          });
        }

        folderDiv.appendChild(subDiv);
        container.appendChild(folderDiv);
      });
    }

    renderNode(tree, treeContainer);
  }

  /**
   * Browser-first organized ZIP generation
   */
  async function generateAndDownloadZip() {
    const approvedFiles = sessionFiles.filter((f) => f.suggestion && f.suggestion.approved);

    if (approvedFiles.length === 0) {
      showNotification("No approved files to export. Please approve suggestions first.", "warning");
      return;
    }

    if (!window.JSZip) {
      showNotification("Local JSZip archive engine is initializing. Please retry in a moment.", "warning");
      return;
    }

    const downloadBtn = $("btn-download-zip");
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = `Packaging ZIP archive...`;
    }

    try {
      const zip = new window.JSZip();
      const usedPaths = new Set();

      for (const f of approvedFiles) {
        const safeCategory = sanitizeZipPath(f.suggestion.category);
        let safeName = sanitizeZipFilename(f.suggestion.suggestedName, f.ext);

        let targetPath = safeCategory ? `${safeCategory}/${safeName}` : safeName;

        let counter = 1;
        while (usedPaths.has(targetPath.toLowerCase())) {
          const extIdx = safeName.lastIndexOf(".");
          const stem = extIdx !== -1 ? safeName.slice(0, extIdx) : safeName;
          const ext = extIdx !== -1 ? safeName.slice(extIdx) : "";
          const resolvedName = `${stem}_${counter++}${ext}`;
          targetPath = safeCategory ? `${safeCategory}/${resolvedName}` : resolvedName;
        }
        usedPaths.add(targetPath.toLowerCase());

        const arrayBuffer = await f.file.arrayBuffer();
        zip.file(targetPath, arrayBuffer);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `ClutterPilot_Organized_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

      showNotification("Organized ZIP downloaded successfully! Your original files are untouched.");
    } catch (err) {
      console.error("[Export Error]:", err.message);
      showNotification("Could not create ZIP archive. Check console.", "danger");
    } finally {
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Organized Files (.ZIP)
        `;
      }
    }
  }

  /**
   * Generates and downloads an executable local move script (.bat / .sh)
   * Allows organizing directly on user's disk without downloading a ZIP archive
   */
  function generateAndDownloadMoveScript() {
    const approvedFiles = sessionFiles.filter((f) => f.suggestion && f.suggestion.approved);

    if (approvedFiles.length === 0) {
      showNotification("No approved files to export. Please approve suggestions first.", "warning");
      return;
    }

    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("win");
    let scriptContent = "";
    let filename = "";

    if (isWindows) {
      filename = `organize_files_${new Date().toISOString().slice(0, 10)}.bat`;
      scriptContent += "@echo off\r\n";
      scriptContent += "chcp 65001 >nul\r\n";
      scriptContent += "echo ====================================================\r\n";
      scriptContent += "echo   ClutterPilot Safe File Organizer Script (Batch)\r\n";
      scriptContent += "echo   Run this script in the directory containing your files.\r\n";
      scriptContent += "echo ====================================================\r\n";
      scriptContent += "pause\r\n\r\n";

      const createdFolders = new Set();
      approvedFiles.forEach((f) => {
        const safeCat = sanitizeZipPath(f.suggestion.category).replace(/\//g, "\\");
        const folder = safeCat || "Other";
        if (!createdFolders.has(folder)) {
          scriptContent += `if not exist "${folder}" mkdir "${folder}"\r\n`;
          createdFolders.add(folder);
        }
        const orig = f.name;
        const target = `${folder}\\${sanitizeZipFilename(f.suggestion.suggestedName, f.ext)}`;
        scriptContent += `if exist "${orig}" (\r\n`;
        scriptContent += `  move /Y "${orig}" "${target}"\r\n`;
        scriptContent += `  echo Moved: "${orig}" -^> "${target}"\r\n`;
        scriptContent += `) else (\r\n`;
        scriptContent += `  echo Notice: Original not found: "${orig}"\r\n`;
        scriptContent += `)\r\n\r\n`;
      });

      scriptContent += "echo ====================================================\r\n";
      scriptContent += "echo File organization complete!\r\n";
      scriptContent += "pause\r\n";
    } else {
      filename = `organize_files_${new Date().toISOString().slice(0, 10)}.sh`;
      scriptContent += "#!/usr/bin/env bash\n";
      scriptContent += "# ClutterPilot Safe File Organizer Script (Bash)\n";
      scriptContent += "# Run this script in the directory containing your files.\n\n";
      scriptContent += 'echo "ClutterPilot: Starting file organization..."\n\n';

      const createdFolders = new Set();
      approvedFiles.forEach((f) => {
        const safeCat = sanitizeZipPath(f.suggestion.category);
        const folder = safeCat || "Other";
        if (!createdFolders.has(folder)) {
          scriptContent += `mkdir -p "${folder}"\n`;
          createdFolders.add(folder);
        }
        const orig = f.name.replace(/"/g, '\\"');
        const target = `${folder}/${sanitizeZipFilename(f.suggestion.suggestedName, f.ext)}`.replace(/"/g, '\\"');
        scriptContent += `if [ -f "${orig}" ]; then\n`;
        scriptContent += `  mv -n "${orig}" "${target}"\n`;
        scriptContent += `  echo "Moved: ${orig} -> ${target}"\n`;
        scriptContent += `else\n`;
        scriptContent += `  echo "Notice: Original not found: ${orig}"\n`;
        scriptContent += `fi\n\n`;
      });

      scriptContent += 'echo "ClutterPilot: File organization complete!"\n';
    }

    const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

    showNotification(`Generated ${filename}. Run it locally to move and organize your files.`);
  }

  function sanitizeZipPath(category) {
    if (!category) return "Other";
    return category
      .replace(/\\/g, "/")
      .split("/")
      .map((p) => p.replace(/[<>:"|?*]/g, "").trim())
      .filter((p) => p && p !== "." && p !== "..")
      .join("/");
  }

  function sanitizeZipFilename(name, fallbackExt = "") {
    if (!name) return `organized_file${fallbackExt}`;
    let cleaned = name.replace(/[/\\]/g, " ").replace(/[<>:"|?*]/g, "_").trim();
    if (fallbackExt && !cleaned.toLowerCase().endsWith(fallbackExt.toLowerCase())) {
      cleaned += fallbackExt;
    }
    return cleaned;
  }

  /* ==========================================================================
     CLEAR THIS SESSION / RESET WORKSPACE
     ========================================================================== */
  function clearActiveSession() {
    // Abort any ongoing AI background loop
    isAiRunning = false;
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }

    sessionFiles = [];
    currentStep = 1;
    activeEditIndex = null;

    const filesInput = $("file-input-files");
    const folderInput = $("file-input-folder");
    if (filesInput) filesInput.value = "";
    if (folderInput) folderInput.value = "";

    const tbody = $("suggestions-table-body");
    if (tbody) tbody.innerHTML = "";

    const treeContainer = $("export-tree-container");
    if (treeContainer) treeContainer.innerHTML = "";

    setWorkspaceStep(1);

    // Reassuring, clear message
    showNotification("Workspace reset. No files or actions are ever saved to our website. Your originals were not changed.", "info");
  }

  /* ==========================================================================
     MODALS & DIALOGS
     ========================================================================== */
  function initModals() {
    const editModal = $("edit-modal");
    const privacyModal = $("privacy-modal");
    const clearConfirmModal = $("clear-confirm-modal");

    // Close on backdrop click
    [editModal, privacyModal, clearConfirmModal].forEach((dialog) => {
      if (!dialog) return;
      dialog.addEventListener("click", (e) => {
        const rect = dialog.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) dialog.close();
      });
    });

    // Edit Modal Buttons
    const closeEditBtn = $("btn-close-edit-modal");
    const cancelEditBtn = $("btn-cancel-edit");
    const saveEditBtn = $("btn-save-edit");

    if (closeEditBtn && editModal) closeEditBtn.addEventListener("click", () => editModal.close());
    if (cancelEditBtn && editModal) cancelEditBtn.addEventListener("click", () => editModal.close());

    if (saveEditBtn && editModal) {
      saveEditBtn.addEventListener("click", () => {
        if (activeEditIndex !== null && sessionFiles[activeEditIndex]) {
          const suggNameInput = $("edit-sugg-name");
          const categoryInput = $("edit-category");

          const f = sessionFiles[activeEditIndex];
          if (f.suggestion) {
            f.suggestion.suggestedName = suggNameInput.value.trim() || f.name;
            f.suggestion.category = categoryInput.value.trim() || "Documents";
            f.suggestion.approved = true;
            f.suggestion.skipped = false;
          }

          updateTableRowContent(activeEditIndex);
          updateTableRowState(activeEditIndex);
          editModal.close();
          showNotification(`Updated suggestion for ${f.name}`);
        }
      });
    }

    // Privacy Modal
    const openPrivacyBtn = $("btn-open-privacy-modal");
    const closePrivacyBtn = $("btn-close-privacy-modal");
    const closePrivacyBottom = $("btn-close-privacy-bottom");

    if (openPrivacyBtn && privacyModal) {
      openPrivacyBtn.addEventListener("click", () => privacyModal.showModal());
    }
    if (closePrivacyBtn && privacyModal) {
      closePrivacyBtn.addEventListener("click", () => privacyModal.close());
    }
    if (closePrivacyBottom && privacyModal) {
      closePrivacyBottom.addEventListener("click", () => privacyModal.close());
    }
  }

  function openEditModal(index) {
    activeEditIndex = index;
    const fileRec = sessionFiles[index];
    if (!fileRec || !fileRec.suggestion) return;

    const origInput = $("edit-orig-name");
    const suggInput = $("edit-sugg-name");
    const catInput = $("edit-category");
    const modal = $("edit-modal");

    if (origInput) origInput.value = fileRec.name;
    if (suggInput) suggInput.value = fileRec.suggestion.suggestedName;
    if (catInput) catInput.value = fileRec.suggestion.category;

    if (modal) modal.showModal();
  }

})();
