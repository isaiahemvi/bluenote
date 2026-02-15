# Bluenote – AI Credit Card & Budget Optimizer

Bluenote is an AI-powered personal finance assistant that helps users manage credit cards, track spending, and optimize cashback rewards. Instead of only logging expenses, Bluenote actively recommends **which card to use**, **whether a purchase is affordable**, and **how to maximize rewards** using real transaction data and AI reasoning.

---

## Core Idea

Managing multiple credit cards through spreadsheets or memory often leads to poor accountability and missed rewards. Bluenote replaces passive tracking with **active financial guidance** through a conversational AI interface and real-time analytics.

---

## Key Features

- **AI Financial Advisor Chatbot**
  - Ask: *“Can I afford this?”* or *“Which card should I use for gas?”*
  - Uses live balances, limits, and cashback categories.
- **Credit Card Optimization**
  - Automatically selects the best card per spending category.
- **Spending Visualization**
  - Category and account-based charts.
- **Savings / Missed Rewards Analysis**
  - Estimates potential cashback losses from suboptimal card usage.
- **High-Performance Data Retrieval**
  - Sub-millisecond lookups using Valkey.

---

## Technology Stack

### Backend
- **Node.js** – JavaScript runtime for server logic.
- **Express.js** – Lightweight API framework.
- **Valkey (Redis-compatible)** – In-memory key-value database for:
  - Account data  
  - Transaction history  
  - Chat session memory  
- **Google Gemini API** – Generative AI for:
  - Natural-language financial advice  
  - Function calling with grounded data  
- **ioredis** – Valkey client library.
- **dotenv** – Environment variable management.
- **csv-parser** – Transaction ingestion.

### Frontend
- **Vanilla JavaScript**
- **HTML5 / CSS3**
- Dynamic charts and stylized cyber-noir visual effects.

### Infrastructure
- **Docker** – Runs the Valkey database in an isolated container.

---

## Project Structure (Simplified)

/public
├── index.html
├── dashboard.js
├── styles.css

server.js
chatbotLogic.js
decisionEngine.js
valkeyClient.js
seedData.js
accountsList.json
transactionHistory.csv


---

## Setup & Run Instructions

### 1. Install Prerequisites
- Node.js (v18+ recommended)
- Docker

Verify installations:
```bash
node -v
docker --version
2. Start Valkey Database (Docker)
docker run -d \
  --name valkey-server \
  -p 6379:6379 \
  valkey/valkey
This launches the in-memory database on port 6379.

3. Install Dependencies
npm install
4. Environment Variables
Create a .env file in the project root:

GEMINI_API_KEY=your_api_key_here
5. Seed Initial Data
node seedData.js
Loads accounts and transaction history into Valkey.

6. Start Server
node server.js
Server runs on http://localhost:3000

Usage
Open the browser at http://localhost:3000

Add or edit credit card accounts.

Ask the chatbot questions such as:

“Can I afford a $200 flight?”

“Which card should I use for groceries?”

“Where am I spending the most?”

Current Limitations
Manual data entry / CSV ingestion only.

Hardcoded spending categories.

Prototype-level security (no MFA or encrypted PII).

Future Improvements
Transaction editing & automation

TLS encryption

Multi-user support with ACLs

Bank API integrations

Asset bundling / build pipeline optimization

Bluenote transforms passive budgeting into active financial decision-making.