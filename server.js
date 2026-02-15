require('dotenv').config();
const express = require('express');
const path = require('path');
const { handleQuery } = require('./chatbotLogic');
const redis = require('./valkeyClient');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/recommend-savings', async (req, res) => {
    try {
        const { accountId } = req.body;
        const accountRaw = await redis.get(`account:${accountId}`);
        if (!accountRaw) return res.status(404).json({ error: 'Account not found' });
        const account = JSON.parse(accountRaw);

        const transactionsRaw = await redis.get('transactions:list');
        const allTransactions = JSON.parse(transactionsRaw || '[]');
        const transactions = allTransactions.filter(t => t.account_id == accountId);

        const spendingByCategory = {};
        transactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (amt > 0) {
                spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + amt;
            }
        });

        const topCategory = Object.entries(spendingByCategory).sort((a,b) => b[1] - a[1])[0]?.[0] || 'other';
        const topSpend = spendingByCategory[topCategory] || 0;

        const currentRate = account.cashback[topCategory] || 1;
        const prompt = `You are a financial analysis bot.
        Account: "${account.name}"
        Top Category: "${topCategory}"
        Current Cashback Rate: ${currentRate}%
        Total Spending: $${topSpend.toFixed(2)}
        
        Task:
        1. Suggest ONE real credit card that has a HIGHER cashback rate for "${topCategory}".
        2. Calculate total historical savings: (Suggested Rate % - Current Rate %) * Total Spending.
        3. Write a short explanation (2 sentences max) for the UI.
        
        Return ONLY valid JSON: {"amount": number, "card": string, "category": string, "explanation": string, "suggestedRate": number}`;
        
        const { text } = await handleQuery(prompt);
        const jsonMatch = text.match(/\{.*\}/s);
        const recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : {
            amount: topSpend * 0.02,
            card: "Citi Double Cash",
            category: topCategory,
            explanation: `Switching to a higher cashback card for ${topCategory} would have saved you money over your history.`
        };

        res.json(recommendation);
    } catch (error) {
        console.error('Savings recommendation error:', error);
        res.status(500).json({ error: 'Failed to generate recommendation' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { query, sessionId } = req.body;
        
        // 1. Get History from Valkey
        const historyKey = `chat:history:${sessionId || 'default'}`;
        const historyRaw = await redis.get(historyKey);
        let history = JSON.parse(historyRaw || '[]');

        // 2. Handle Query with History
        const { text, updatedHistory } = await handleQuery(query, history);

        // 3. Save Updated History (last 20 parts to stay within limits)
        await redis.set(historyKey, JSON.stringify(updatedHistory.slice(-20)), 'EX', 3600);

        res.json({ response: text });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ response: 'Sorry, I encountered an error processing that request.' });
    }
});

app.get('/api/accounts', async (req, res) => {
    try {
        const keys = await redis.keys('account:*');
        const accounts = [];
        for (const key of keys) {
            const data = await redis.get(key);
            accounts.push(JSON.parse(data));
        }
        res.json(accounts);
    } catch (error) {
        console.error('Fetch accounts error:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const data = await redis.get('transactions:list');
        res.json(JSON.parse(data || '[]'));
    } catch (error) {
        console.error('Fetch transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

app.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
    console.log('Ensure GEMINI_API_KEY is exported in your terminal.');
});