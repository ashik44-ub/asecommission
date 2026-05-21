# CommisSync — Commission System Dashboard

A full-stack, premium-designed **Sales Commission Calculation & Tracking System** built with Express.js, MongoDB Atlas, and Vanilla JavaScript.

---

## ✨ Features

- 📊 **Real-time Commission Calculator** with live invoice summary
- 🗄️ **MongoDB Atlas** database for cloud-persistent records
- 💾 **LocalStorage Fallback** when the database is offline
- 📈 **Chart.js Analytics** with dual-axis bar charts and doughnut breakdowns
- 🌙 **Dark / Light Mode** toggle with persistent preference
- 📤 **CSV Export** and **Printable Slips**
- 🔍 **Search & Filter** across all historical records
- 📱 **Responsive Design** for mobile and desktop

---

## 📐 Commission Rules

### Collection-Based Commission

| Total Collection | Rate | Bonus |
|-----------------|------|-------|
| < Tk. 1,15,000 | 0% | — |
| Tk. 1,15,000 – < Tk. 1,50,000 | 1.75% | + Tk. 750 |
| Tk. 1,50,000 – < Tk. 2,00,000 | 2.00% | + Tk. 1,000 |
| Tk. 2,00,000 – < Tk. 3,00,000 | 2.25% | + Tk. 1,250 |
| Tk. 3,00,000 – < Tk. 4,00,000 | 2.50% | + Tk. 1,500 |
| Tk. 4,00,000 – < Tk. 5,00,000 | 2.75% | + Tk. 1,750 |
| Tk. 5,00,000 – < Tk. 7,00,000 | 3.00% | + Tk. 2,000 |
| ≥ Tk. 7,00,000 | 3.25% | + Tk. 2,500 |

### Service & TDS/VDS Per-Transaction Commission

| Payment Amount | Commission |
|---------------|-----------|
| ≤ Tk. 1,000 | Tk. 0 |
| > Tk. 1,000 – ≤ Tk. 3,000 | Tk. 150 |
| > Tk. 3,000 – ≤ Tk. 6,000 | Tk. 300 |
| > Tk. 6,000 – ≤ Tk. 15,000 | Tk. 400 |
| > Tk. 15,000 | Tk. 500 |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js v18+
- npm
- MongoDB Atlas account

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/commission.git
   cd commission
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your MongoDB Atlas connection string.

4. **Start the server**
   ```bash
   npm start
   ```
   Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## ☁️ Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo in [Vercel](https://vercel.com).
3. Add `MONGODB_URI` in **Vercel > Settings > Environment Variables**.
4. Deploy!

> **Important:** Also add your Vercel server IP to the MongoDB Atlas IP Whitelist (`0.0.0.0/0` for all IPs, or specific Vercel IPs).

---

## 🗂️ Project Structure

```
commission/
├── frontend/             # Frontend client assets
│   ├── index.html        # Main dashboard page
│   ├── style.css         # Custom premium CSS styles
│   └── app.js            # Client-side calculator and charts logic
├── backend/              # Backend server environment
│   ├── api/
│   │   └── index.js      # Express application and API routes
│   └── server.js         # Local server startup runner
├── vercel.json           # Vercel serverless routing configuration
├── package.json          # Node dependencies and orchestrator scripts
├── .env.example          # Template for local environment configuration
└── .gitignore            # Git exclusions
```

---

## 🔐 Security Note

**Never commit your `.env` file.** It is excluded via `.gitignore`. Always use `.env.example` as a template.
