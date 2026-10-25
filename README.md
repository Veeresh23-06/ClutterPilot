# ClutterPilot

**Your files are a mess. Fixing them shouldn't be another task.**

ClutterPilot is a privacy-focused digital clutter organizer designed to help people review disorganized files, understand their contents, and get AI-assisted suggestions for more meaningful filenames and categories.

It uses a local AI model through Ollama, making local inference a core part of the project rather than relying on a hosted AI service.

## Why ClutterPilot?

Downloads, documents, notes, and other files can quickly become difficult to manage. Manually opening and renaming every file takes time and effort.

ClutterPilot aims to make this process easier by combining a file audit with local AI suggestions and a human-reviewed organization workflow.

## Features

- **File clutter audit:** Review selected files and their available metadata.
- **Local AI assistance:** Use an open-weight model through Ollama to help interpret supported file content and suggest useful filenames or categories.
- **Human-controlled review:** Review suggestions and edit, approve, or skip them before exporting.
- **Organized export:** Export the approved results as a ZIP package, where supported by the current implementation.
- **Privacy-conscious design:** Designed to use a locally running AI model rather than a hosted AI API.
- **Simple web interface:** Interact with the workflow through a browser-based interface.

*Feature availability depends on the current implementation. Please verify each feature in the running application before treating it as complete.*

## Technology Stack

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- Ollama
- Qwen 2.5 1.5B

## How It Works

1. Open ClutterPilot locally in your browser.
2. Select the files you want to review.
3. Run the file audit.
4. Request AI-assisted suggestions for supported files.
5. Review and edit the suggested names or categories.
6. Approve the changes you want to keep.
7. Export the reviewed organization results, where supported.

ClutterPilot is intended to keep the user in control. Suggestions should be reviewed before they are used.

## Requirements

Before running the application, install:

- [Node.js](https://nodejs.org/)
- [Ollama](https://ollama.com/)

The Qwen model used by this project is `qwen2.5:1.5b`.

## Installation and Setup

### 1. Clone the repository

Replace `YOUR-GITHUB-USERNAME` with your GitHub username.

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/ClutterPilot.git
cd ClutterPilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Download the local AI model

```bash
ollama pull qwen2.5:1.5b
```

Make sure Ollama is running and the model is available before using AI-assisted features.

### 4. Start the application

From the project root, run:

```bash
node server.js
```

If your `package.json` defines a start script, you can use `npm start` instead.

### 5. Open the application







## Privacy and File Safety

ClutterPilot is designed around local AI processing, with Ollama running on the user's machine.

Before using sensitive files, review the application's code and network behavior to verify exactly what file data is processed and where it is sent. Do not assume that all data remains local merely because a local model is used.

Always review the suggested changes before exporting. Keep backups of important files and verify that the application does not modify originals unexpectedly.

## Project Status

ClutterPilot is an evolving project. Features, supported file types, reliability, and setup instructions may change as development continues.

Bug reports and constructive feedback are welcome.

## Contributing

Contributions that improve usability, accessibility, reliability, documentation, and local AI integration are welcome.

1. Fork the repository.
2. Create a branch for your changes.
3. Make and test your changes.
4. Submit a pull request describing what you changed.

Please do not commit credentials, private files, or personal data.

## License

This project is licensed under the MIT License. See the [`LICENSE`](LICENSE) file for details.
