const assert = require("assert");

const BASE_URL = "http://127.0.0.1:3000";

async function runTests() {
  console.log("=== Starting ClutterPilot Senior Developer Inspection & Tests ===");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`TEST: ${name}... `);
      await fn();
      console.log("PASSED");
      passed++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Landing page route
  await test("GET / serves landing page HTML", async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes("ClutterPilot"), "HTML should contain 'ClutterPilot'");
    assert(html.includes("hero-headline"), "HTML should contain hero headline");
  });

  // 2. Workspace page route
  await test("GET /workspace serves workspace HTML", async () => {
    const res = await fetch(`${BASE_URL}/workspace`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes("ClutterPilot Workspace"), "HTML should contain 'ClutterPilot Workspace'");
    assert(html.includes("dropzone"), "HTML should contain dropzone");
    assert(html.includes("ai-inspect-modal"), "HTML should contain ai-inspect-modal");
  });

  // 3. Static assets
  await test("GET /style.css serves CSS stylesheet", async () => {
    const res = await fetch(`${BASE_URL}/style.css`);
    assert.strictEqual(res.status, 200);
    const css = await res.text();
    assert(css.includes(".ai-intelligence-card"), "CSS should include AI studio styles");
  });

  await test("GET /app.js serves workspace script", async () => {
    const res = await fetch(`${BASE_URL}/app.js`);
    assert.strictEqual(res.status, 200);
    const js = await res.text();
    assert(js.includes("initAiStudioActions"), "app.js should contain initAiStudioActions");
  });

  // 4. Health Check Endpoint
  await test("GET /api/health returns valid JSON", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert([200, 503].includes(res.status), `Unexpected status ${res.status}`);
    const data = await res.json();
    assert("ollama" in data, "Response should have 'ollama' boolean");
    assert("model" in data, "Response should have 'model' string");
    assert("modelAvailable" in data, "Response should have 'modelAvailable' boolean");
    console.log(`\n  [Health Check info: ollama=${data.ollama}, model=${data.model}, modelAvailable=${data.modelAvailable}]`);
  });

  // 5. POST /api/suggest - missing filename
  await test("POST /api/suggest without filename returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error, "Should contain error message");
  });

  // 6. POST /api/suggest - malformed JSON body
  await test("POST /api/suggest with invalid JSON returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ broken json"
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes("Invalid JSON"), "Should detect invalid JSON");
  });

  // 7. POST /api/suggest - path traversal sanitize
  await test("POST /api/suggest with path traversal sanitized", async () => {
    const res = await fetch(`${BASE_URL}/api/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "../../../../../secret/passwords.txt",
        fileType: "text/plain",
        size: 100,
        textSnippet: "My passwords"
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(!data.suggestedName.includes("../"), "Suggested name must not contain path traversal");
    assert(!data.suggestedName.includes("/"), "Suggested name must not contain slashes");
    assert(!data.suggestedName.includes("\\"), "Suggested name must not contain backslashes");
    assert(!data.category.includes("../"), "Category must not contain path traversal");
  });

  // 8. POST /api/suggest - academic assignment
  await test("POST /api/suggest analyzes academic assignment", async () => {
    const res = await fetch(`${BASE_URL}/api/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "download (4).pdf",
        fileType: "application/pdf",
        size: 14000,
        textSnippet: "CS302 Assignment 3: Advanced Graph Algorithms and Minimum Spanning Trees. Submission deadline: Oct 28. Student: Alex Morgan. Implement Kruskal and Prim algorithms."
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.suggestedName, "Must return suggestedName");
    assert(data.suggestedName.endsWith(".pdf"), "Must preserve .pdf extension");
    assert(data.category, "Must return category");
    assert(data.confidence, "Must return confidence");
    assert(Array.isArray(data.alternatives), "Must return alternatives array");
    console.log(`\n  [AI Suggestion for download (4).pdf -> '${data.suggestedName}', Category: '${data.category}', Reason: '${data.reason}']`);
  });

  // 9. POST /api/batch-suggest - validation
  await test("POST /api/batch-suggest without files returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/batch-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });

  await test("POST /api/batch-suggest with over 50 files returns 400", async () => {
    const hugeList = Array.from({ length: 51 }, (_, i) => ({ filename: `file_${i}.txt` }));
    const res = await fetch(`${BASE_URL}/api/batch-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: hugeList })
    });
    assert.strictEqual(res.status, 400);
  });

  // 10. POST /api/batch-suggest - working batch
  await test("POST /api/batch-suggest processes batch correctly", async () => {
    const res = await fetch(`${BASE_URL}/api/batch-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          { filename: "notes_final_FINAL.docx", fileType: "application/docx", size: 2000, textSnippet: "Lecture Notes on Neural Networks" },
          { filename: "IMG_2026_01.jpg", fileType: "image/jpeg", size: 500000, textSnippet: "" }
        ]
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data.suggestions), "Must return suggestions array");
    assert.strictEqual(data.suggestions.length, 2);
    assert(data.suggestions[0].suggestedName.endsWith(".docx"));
    assert(data.suggestions[1].suggestedName.endsWith(".jpg"));
  });

  // 11. Move script & privacy modal in workspace HTML
  await test("GET /workspace contains btn-download-script and privacy-modal", async () => {
    const res = await fetch(`${BASE_URL}/workspace`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes('id="btn-download-script"'), "Should contain move script button");
    assert(html.includes('id="privacy-modal"'), "Should contain privacy details modal");
  });

  // 12. Batch suggestion with malformed elements resilience
  await test("POST /api/batch-suggest with null or malformed items is resilient", async () => {
    const res = await fetch(`${BASE_URL}/api/batch-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          null,
          { filename: "valid_receipt.pdf" },
          {}
        ]
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.suggestions.length, 3);
  });

  console.log(`\n=== RESULTS: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
