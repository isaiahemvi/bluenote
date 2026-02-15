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
        
        // 1. Get account data (including current cashback rates)
        const accountRaw = await redis.get(`account:${accountId}`);
        if (!accountRaw) return res.status(404).json({ error: 'Account not found' });
        const account = JSON.parse(accountRaw);

        // 2. Get transactions for this account
        const transactionsRaw = await redis.get('transactions:list');
        const allTransactions = JSON.parse(transactionsRaw || '[]');
        const transactions = allTransactions.filter(t => t.account_id == accountId);

        // 3. Analyze spending by category
        const spendingByCategory = {};
        transactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (amt > 0) {
                spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + amt;
            }
        });

        // 4. Find top category
        const topCategory = Object.entries(spendingByCategory).sort((a,b) => b[1] - a[1])[0]?.[0] || 'other';
        const topSpend = spendingByCategory[topCategory] || 0;

        // 5. Query Gemini for a recommendation and explanation
        const { handleQuery } = require('./chatbotLogic');
        const currentRate = account.cashback[topCategory] || 1;
        const prompt = `Based on this real financial data for credit card "${account.name}":
        Category: "${topCategory}"
        User's Current Rate for this category: ${currentRate}%
        Total Spending in this category: $${topSpend.toFixed(2)}
        
        Task:
        1. Suggest a real-world credit card (e.g. Amex Gold, Chase Freedom, etc.) that has a HIGHER cashback rate for "${topCategory}".
        2. Calculate the historical savings: (New Rate % - Old Rate %) * Total Spending.
        3. Write a short, professional 2-sentence explanation of this specific benefit.
        
        Return ONLY valid JSON: {"amount": number, "card": string, "category": string, "explanation": string, "suggestedRate": number}`;
        
        const { text } = await handleQuery(prompt);
        const jsonMatch = text.match(/\{.*\}/s);
        const recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : {
            amount: topSpend * 0.02,
            card: "Citi Double Cash",
            category: topCategory,
            explanation: `Switching to a higher cashback card for ${topCategory} could have saved you significantly.`
        };

        res.json(recommendation);
    } catch (error) {
        console.error('Savings recommendation error:', error);
        res.status(500).json({ error: 'Failed to generate recommendation' });
    }
});

/**
 * Optimal location for database interaction logic.
 * This function parses form data into the exact schema used in accountsList.json
 * and established by seedData.js.
 */
async function saveAccountToValkey(accountData) {
    // 1. Determine next unique ID (find max current ID + 1)
    const keys = await redis.keys('account:*');
    let nextId = 1;
    if (keys.length > 0) {
        const ids = keys.map(k => parseInt(k.split(':')[1]));
        nextId = Math.max(...ids) + 1;
    }

    // 2. Map form fields to the specific schema required by the app
    // cardName -> name
    // creditLimit -> limit (integer)
    // balance -> balance (float)
    // nickname -> nickname
    const newAccount = {
        id: nextId,
        name: String(accountData.cardName),
        limit: parseInt(accountData.creditLimit),
        balance: parseFloat(accountData.balance),
        nickname: String(accountData.nickname || ""),
        cashback: {
            fuel: parseFloat(accountData.cashbackFuel),
            food: parseFloat(accountData.cashbackFood),
            groceries: parseFloat(accountData.cashbackGroceries),
            travel: parseFloat(accountData.cashbackTravel),
            other: parseFloat(accountData.cashbackOther)
        }
    };

    // 3. Store to Valkey using the established key format
    const key = `account:${newAccount.id}`;
    await redis.set(key, JSON.stringify(newAccount));
    
    console.log(`Successfully saved new account: ${key}`);
    return newAccount;
}

app.post('/api/chat', async (req, res) => {
    try {
        const { query, sessionId } = req.body;
        const historyKey = `chat:history:${sessionId || 'default'}`;
        const historyRaw = await redis.get(historyKey);
        let history = JSON.parse(historyRaw || '[]');
        const { text, updatedHistory } = await handleQuery(query, history);
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

app.post('/api/accounts', async (req, res) => {
    try {
        const newAccount = await saveAccountToValkey(req.body);
        res.status(201).json(newAccount);
    } catch (error) {
        console.error('Add account API error:', error);
        res.status(500).json({ error: 'Failed to add account' });
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
});