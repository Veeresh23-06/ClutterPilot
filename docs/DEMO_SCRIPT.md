# ClutterPilot — 3-Minute Video / Live Demonstration Script

> **Goal**: Present ClutterPilot as an elegant, dependable, privacy-first software product that solves file clutter on personal computers without risking personal documents.

---

## Video Outline & Timing (Total: 3 Minutes)

| Time | Section | Key Visual | Talking Points |
|---|---|---|---|
| **0:00 – 0:35** | **The Problem & Product Identity** | Landing page hero with Before & After visual card | Explain the mess of modern Downloads folders; highlight why cloud AI tools are dangerous for sensitive personal files. |
| **0:35 – 1:00** | **The Standalone Solution** | Landing page value props, Privacy Center & FAQs | Introduce ClutterPilot; emphasize 100% on-device AI with Ollama and zero cloud exposure. |
| **1:00 – 1:35** | **File Selection & Clutter Audit** | Click "Get Started" &rarr; `/workspace` &rarr; "Use Sample Files" | Show drag-and-drop, instant SHA-256 duplicate detection, and the 5-metric clutter audit report. |
| **1:35 – 2:20** | **AI Review & Fine-Grained Control** | Step 4 AI Review Table | Watch the local Qwen model suggest clear names and categories; demonstrate editing a row and bulk approving. |
| **2:20 – 3:00** | **Safe ZIP Export & Ephemeral Reset** | Step 5 Tree Preview & Download | Download the organized ZIP; verify original files are untouched; demonstrate "Reset Workspace" clearing RAM. |

---

## Detailed Narration Script

### [0:00 – 0:35] The Problem & Introduction
*(Screen: ClutterPilot Landing Page at `http://127.0.0.1:3000`)*

> "If you look into your Downloads or Desktop folder right now, chances are you'll find filenames like `download (4).pdf`, `IMG_2026_01.jpg`, `notes_final_FINAL.docx`, and duplicate documents scattered everywhere.
>
> But organizing them manually takes hours. And uploading your tax forms, medical receipts, college grades, or private photos to cloud-based AI tools is a massive privacy risk.
>
> That's why we built **ClutterPilot**: your files are a mess, but fixing them shouldn't be another task—and it definitely shouldn't risk your privacy."

---

### [0:35 – 1:00] Product Architecture & Values
*(Screen: Scroll through Landing Page Value Props, Features, and Privacy Center)*

> "ClutterPilot is a standalone, local-first file organization application. 
> 
> Everything runs right on your computer. When you tap **Get Started**, ClutterPilot opens a dedicated workspace that pairs directly with your on-device Ollama model—in our case, `qwen2.5:1.5b`. 
>
> There are no subscription fees, no cloud databases, and zero tracking. Not a single byte of your files ever leaves your computer."

---

### [1:00 – 1:35] Live Workspace & Instant Audit
*(Screen: Click "Get Started" &rarr; `/workspace` &rarr; Click "Use Sample Files")*

> "Let's tap **Get Started** to open our dedicated workspace.
>
> You can drag and drop your actual files or an entire folder. To see it in action without personal files, we'll click **Use Sample Files**.
>
> Notice what happens instantaneously: the browser reads the files in temporary memory and calculates cryptographic SHA-256 hashes.
>
> In seconds, we get our **File Clutter Report**:
> - We have 10 files across 4 formats.
> - Exactly 3 duplicate files were caught by their cryptographic hash.
> - 5 files have generic or cryptic names like `download (4)` and `document_001`."

---

### [1:35 – 2:20] Smart AI Suggestions & User Control
*(Screen: Click "Start AI Analysis" &rarr; Step 4 AI Suggestions Review)*

> "Now let's click **Start AI Analysis**.
>
> The local Express server sends bounded snippets exclusively to our local Ollama instance on `127.0.0.1:11434`.
>
> Look at the suggestions appearing in real time:
> - `download (4).pdf` was analyzed and recognized as our graph algorithms course assignment, renamed to `CS302_Assignment_3.pdf` and filed under `Documents / Assignments`.
> - `document_001.pdf` was recognized as a `Q3 Budget Report.pdf` and sorted into `Receipts`.
> - Photos and screenshots are automatically categorized with confidence scores.
>
> Most importantly, you maintain complete control. You can toggle approval on any item, edit the suggested filename or target folder with the pencil icon, or bulk approve and skip items."

---

### [2:20 – 3:00] Safe Export & Workspace Reset
*(Screen: Click "Preview Organized Structure" &rarr; Step 5 &rarr; Click "Download Organized Files")*

> "Once we're happy, we click **Preview Organized Structure**.
>
> ClutterPilot presents an interactive tree view of our new hierarchy: `Documents/Assignments`, `Receipts`, `Images/Personal`, and `Lecture Notes`.
>
> When we click **Download Organized Files (.ZIP)**, the entire folder structure is compiled in browser RAM using JSZip and downloaded instantly.
>
> **Your original files on disk remain 100% untouched.**
>
> And when you're done, clicking **Reset Workspace** immediately wipes all file references and memory buffers. No files or history are ever retained on this website.
>
> That's ClutterPilot: intelligent, local-AI file organization with zero privacy compromises. Download it, run it locally, and reclaim your digital space."
