# 🧹 ClutterPilot — Let AI Help You Tame Digital Clutter

> 🦥 *Slow down the chaos. Organize smarter. Stay in control.*

ClutterPilot is a web-based digital clutter organizer designed to make file organization easier with a simple interface and AI-assisted suggestions powered by **Qwen 2.5 1.5B** through **Ollama**.

🔗 **Live Website:** https://clutterpilot.onrender.com  

---

## 🌟 About the Project

Digital clutter builds up over time. Files become difficult to find, folders get messy, and organizing everything becomes another task on the to-do list.

ClutterPilot explores how AI can help simplify this process by combining file organization features with AI-assisted suggestions.

🎯 **Goal:** Make digital organization easier while keeping users in control of their decisions.

## ✨ Features

- 🖥️ **Simple Web Interface** — Interact with the organizer through a web-based interface.
- 📂 **File Organization** — Features designed to help manage digital clutter.
- 🤖 **AI-Assisted Suggestions** — Uses Qwen 2.5 1.5B through Ollama in the local AI workflow.
- 🧑‍💻 **Local AI Inference** — Run the AI workflow locally with the required model and runtime installed.
- 🌱 **Open-Model Experimentation** — Explore how an open-weight AI model can support an everyday task.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| 🌐 HTML | Web page structure |
| 🎨 CSS | Styling and layout |
| ⚡ JavaScript | Frontend interactions |
| 🟢 Node.js | JavaScript runtime |
| 🚀 Express.js | Backend server |
| 🧠 Qwen 2.5 1.5B | AI model |
| 🦙 Ollama | Local model runtime |
| ☁️ Render | Hosted web deployment |

## 🧠 How the AI Works

ClutterPilot's local AI workflow uses **Qwen 2.5 1.5B**, served through Ollama. The local AI suggestions have been verified working.

⚠️ **Local vs. Hosted AI**

The public website is hosted on Render, but the hosted backend does not automatically connect to Ollama running on a developer's computer.

- ☁️ **Hosted version:** Provides the deployed web interface and the features available in that environment.
- 💻 **Local version:** Can run the Qwen-based AI suggestion workflow when Ollama and the required model are configured locally.

The hosted website should not be assumed to provide the same AI functionality as the local setup.

## 🚀 Run Locally

### 1. Prerequisites

Install the following:

- [Node.js](https://nodejs.org/)
- [Ollama](https://ollama.com/)

### 2. Clone the repository

```bash
git clone https://github.com/Veeresh23-06/ClutterPilot.git
cd ClutterPilot
```

### 3. Install dependencies

```bash
npm install
```

### 4. Download the AI model

Make sure Ollama is running, then execute:

```bash
ollama pull qwen2.5:1.5b
```

### 5. Start the application

Use the start command configured in `package.json`. If the project uses `node server.js`, run:

```bash
node server.js
```

Open the local URL shown by the application in your terminal. The default may be `http://localhost:3000`.

> 💡 If the AI suggestions do not work, check that Ollama is running, the model is installed, and the backend is configured to use the local Ollama endpoint.

## 🌍 Try ClutterPilot

- 🔗 **Live Website:** https://clutterpilot.onrender.com

Use the local setup to try the verified Qwen AI workflow.

## 🌱 Why Open Innovation?

Open-weight models give developers the opportunity to experiment, learn, and build AI-powered applications without relying entirely on closed-model APIs.

ClutterPilot is an exploration of how local AI can assist with a practical everyday problem. It also highlights the importance of understanding deployment limitations and being transparent about what works locally versus what works in a hosted environment.

## 🔮 Future Improvements

Potential areas for further development include:

- ☁️ Exploring a supported AI setup for the hosted deployment.
- 🧭 Improving organization suggestions and the user experience.
- 🧪 Expanding testing and documenting supported workflows.
- 📖 Improving setup instructions and troubleshooting guidance.

## 🤝 Contributing

Contributions, suggestions, and feedback are welcome!

1. 🍴 Fork the repository.
2. 🌿 Create a branch for your changes.
3. 🛠️ Make and test your changes.
4. 📬 Submit a pull request describing your contribution.

## 📜 License

Check the repository for its current license before reusing or redistributing the project.

---

### 🦥 ClutterPilot

**Organize smarter. Reduce digital clutter. Keep control.**

Built with 💚 using open-source tools and open-weight AI.
