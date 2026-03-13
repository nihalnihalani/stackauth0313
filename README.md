
# NEXUS // COGNITIVE ACCELERATOR

![Status](https://img.shields.io/badge/SYSTEM-OPERATIONAL-emerald?style=for-the-badge)
![Privacy](https://img.shields.io/badge/DATA-LOCAL_ENCRYPTED-white?style=for-the-badge)
![Engine](https://img.shields.io/badge/ENGINE-MULTI_MODEL-cyan?style=for-the-badge)

> **"Don't just study. Upload knowledge."**

**Nexus** is a specialized Neural Interface designed for students and researchers. Unlike standard chatbots, Nexus acts as a recursive learning environment. It combines multi-model orchestration, real-time schematic visualization, and a Socratic teaching engine to transform abstract confusion into structural mastery.

---

## ⚡ CORE FEATURES

### 🧠 Dual-Mode Cognition
Switch instantly between two distinct interaction protocols:
*   **DIRECT Mode (`>`)**: Standard high-speed interaction for information retrieval, coding assistance, and drafting.
*   **SOCRATIC Mode (`?`)**: A pedagogical engine. The AI **refuses** to give direct answers. Instead, it guides you through questioning, identifies gaps in your logic, validates prerequisites, and forces you to derive the solution yourself.

### 🎨 Dynamic Schematic Rendering
Nexus understands that text is often insufficient for complex systems.
*   **Auto-Visualization**: If a topic involves architecture, flows, or systems (e.g., "The Krebs Cycle", "HTTP Handshake"), the AI generates raw SVG blueprints in real-time.
*   **Interactive View**: Click any generated schematic to enter **Full-Scale Rendering Mode** for a distraction-free inspection.

### ⚔️ Compare Mode
Unsure of a result? Activate **COMPARE**.
*   Triggers two parallel inference streams simultaneously.
*   Displays results in a split-screen view.
*   Perfect for comparing code implementations, creative writing variations, or checking for hallucinations.

### 🧬 The Syllabus Engine
Turn your scattered notes into a structured curriculum.
*   **Synthesis**: The AI analyzes your saved "Neural Archives" (Notes) to build a hierarchical JSON syllabus.
*   **Gap Analysis**: As you add more notes, the syllabus dynamically updates to include new concepts.
*   **Fork-to-Learn**: Click any topic in the generated syllabus to immediately spawn a new Chat Session dedicated to mastering that specific sub-topic.

### 🎯 AI-Generated Assessment
Test your retention immediately.
*   Select any topic from your Syllabus.
*   Nexus reads your specific notes on that topic.
*   It generates a custom **Multiple Choice Assessment** to verify your understanding, complete with explanations for every answer.

### 📂 Neural Archives (Notes System)
*   **One-Click Archive**: Save any chat insight to your permanent database.
*   **Auto-Titling**: The AI analyzes the content and generates a semantic title automatically.
*   **Document Import**: Drag & drop PDFs or Images. The AI extracts the text, formats it into Markdown, and saves it to your archives.
*   **Peer Transmission (The Hive)**: Send notes to other users on the system. If the recipient exists, the knowledge is transmitted to their "Incoming" inbox.

---

## 🛠️ TECHNICAL ARCHITECTURE

### Multi-Provider Orchestration
Nexus is model-agnostic. Configure your "Neural Link" to use:
1.  **Google Gemini**: (Default) Supports *Thinking* models for deep reasoning and *Flash* for speed.
2.  **OpenAI**: GPT-4o integration.
3.  **Anthropic**: Claude 3.5 Sonnet integration.
4.  **Ollama**: Full offline support for local Llama 3 models.

### Local-First Database
*   **Zero Latency**: Powered by **AlaSQL** (In-Memory SQL Database).
*   **Privacy**: All Chat History, Notes, and Syllabus data reside **locally in your browser**. Nothing is sent to a backend server (except the AI provider).
*   **Backup & Restore**: Export your entire cognitive database to a JSON file. Restore it on any device to pick up where you left off.

### Chat Control Flow
*   **Branching/Forking**: Click "FORK" on any message to create a divergent timeline (new session) starting from that specific point.
*   **Stop & Regenerate**: Halt runaway generation instantly. Regenerate responses with a single click (respecting Compare Mode settings).

---

## 🖥️ INTERFACE AESTHETICS

Designed for deep work and low eye strain.
*   **Visual Style**: High-Contrast Monochrome / Cyberpunk / Terminal.
*   **Typography**: Monospace fonts for code-native readability.
*   **HUD Elements**: Vertical status spines, pulse animations, and minimalist controls.

---

## 🚀 GETTING STARTED

### Prerequisites
*   Node.js (v18+)
*   API Key (Google Gemini recommended for best experience)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/nexus.git
    cd nexus
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Initialize System**
    ```bash
    npm start
    ```

4.  **Connect Neural Link**
    *   Click the **Gear Icon** in the top right.
    *   Select your Provider (e.g., Google).
    *   Paste your API Key.
    *   *Optional*: Adjust the System Prompt override.

---

## 🕹️ USAGE GUIDE

1.  **Login**: Enter any username. (Data is sandboxed to this username locally).
2.  **The Prompt**:
    *   Type normally for text.
    *   Click **Paperclip** to analyze images/PDFs.
    *   Toggle **COMPARE** for dual-stream generation.
3.  **Commands**:
    *   `Visualise X`: Forces an SVG schematic generation.
    *   `Archive`: Hover over a message and click "+ ARCHIVE" to save it.
4.  **The Hive**:
    *   Open **NOTES**. Select a note. Click **TRANSMIT**. Enter a recipient's username.
    *   The recipient will see a notification in **HIVE** to accept or reject the data.

---

**Nexus** // *Upgrade your cognitive stack.*
