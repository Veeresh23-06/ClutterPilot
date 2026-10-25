/**
 * ClutterPilot — Landing Page Scripts
 * Handles theme, live health check, FAQ accordions, and privacy modal.
 */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initFaqAccordion();
    initPrivacyModal();
    checkLocalHealth();

    // Health check heartbeat
    setInterval(checkLocalHealth, 15000);
  });

  async function checkLocalHealth() {
    const statusPill = $("model-status");
    if (!statusPill) return;

    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        const online = data.ollama && data.modelAvailable;
        const model = data.model || "qwen2.5:1.5b";

        if (online) {
          statusPill.innerHTML = `
            <span class="status-dot online"></span>
            <span class="status-text">Ollama: ${model}</span>
          `;
          statusPill.title = "Local Ollama AI online at 127.0.0.1:11434";
        } else {
          statusPill.innerHTML = `
            <span class="status-dot checking"></span>
            <span class="status-text">${model} (Model offline)</span>
          `;
          statusPill.title = "Ollama running but model missing. Fallback heuristics ready.";
        }
      } else {
        throw new Error("Ollama offline");
      }
    } catch {
      statusPill.innerHTML = `
        <span class="status-dot offline"></span>
        <span class="status-text">Local AI Offline (Rule Mode)</span>
      `;
      statusPill.title = "Ollama is not running. Smart rule-based organization active.";
    }
  }

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

  function initPrivacyModal() {
    const privacyModal = $("privacy-modal");
    const openPrivacyBtn = $("btn-open-privacy-modal");
    const closePrivacyBtn = $("btn-close-privacy-modal");
    const closePrivacyBottom = $("btn-close-privacy-bottom");

    if (privacyModal) {
      // Close on backdrop click
      privacyModal.addEventListener("click", (e) => {
        const rect = privacyModal.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) privacyModal.close();
      });
    }

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

})();
