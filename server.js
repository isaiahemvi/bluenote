const express = require('express');
const path = require('path');
const { handleQuery } = require('./chatbotLogic');
const redis = require('./valkeyClient');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
    try {
        const { query } = req.body;
        const response = await handleQuery(query);
        res.json({ response });
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