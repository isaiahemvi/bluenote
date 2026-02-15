const express = require('express');
const path = require('path');
const { handleQuery } = require('./chatbotLogic');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('.'));

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

app.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
    console.log('Ensure GEMINI_API_KEY is exported in your terminal.');
});