// Shared Constants & Logic (Could be moved to a shared file later)
const MARKET_BEST_RATES = {
    fuel: 4,
    food: 4,
    groceries: 6,
    travel: 5,
    other: 2
};

function calculatePotentialSavings(categoryTotals, currentCashback) {
    let totalPotentialSavings = 0;
    for (const [category, spend] of Object.entries(categoryTotals)) {
        const currentRate = currentCashback[category] || 1;
        const bestRate = MARKET_BEST_RATES[category] || 2;
        if (bestRate > currentRate) {
            totalPotentialSavings += (spend * (bestRate - currentRate)) / 100;
        }
    }
    return totalPotentialSavings;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('id');

    if (!accountId) {
        window.location.href = 'dashboard.html';
        return;
    }

    const titleEl = document.getElementById('accountTitle');
    const balanceEl = document.getElementById('accountBalance');
    const transactionList = document.getElementById('transactionList');
    const pieChart = document.getElementById('pieChart');
    const pieLegend = document.getElementById('pieLegend');
    const merchantList = document.getElementById('merchantList');

    try {
        const [accRes, transRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/transactions')
        ]);

        const accounts = await accRes.json();
        const allTransactions = await transRes.json();

        const account = accounts.find(a => a.id == accountId);
        if (!account) {
            titleEl.textContent = "Account Not Found";
            return;
        }

        // 1. Update Header
        titleEl.textContent = account.name;
        balanceEl.textContent = `$${account.balance} / $${account.limit}`;

        // Filter transactions for this account
        const transactions = allTransactions.filter(t => t.account_id == accountId);

        // 2. Update Recent Transactions
        transactionList.innerHTML = '';
        transactions.slice().reverse().forEach(t => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-merchant">${t.merchant}</div>
                    <div class="transaction-date">${t.category.toUpperCase()}</div>
                </div>
                <div class="transaction-amount">$${Math.abs(parseFloat(t.amount)).toFixed(2)}</div>
            `;
            transactionList.appendChild(item);
        });

        // 3. Update Pie Chart & Legend
        const totals = {
            fuel: 0,
            food: 0,
            travel: 0,
            groceries: 0,
            other: 0
        };
        let grandTotal = 0;

        transactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (amt > 0) {
                const cat = totals.hasOwnProperty(t.category) ? t.category : 'other';
                totals[cat] += amt;
                grandTotal += amt;
            }
        });

        pieLegend.innerHTML = '';
        let conicGradient = 'conic-gradient(';
        let currentAngle = 0;
        
        const colors = {
            fuel: 'rgba(255, 200, 100, 0.9)',
            food: 'rgba(255, 140, 66, 0.9)',
            travel: 'rgba(77, 148, 255, 0.9)',
            groceries: 'rgba(46, 184, 46, 0.9)',
            other: 'rgba(179, 102, 255, 0.9)'
        };

        Object.entries(totals).forEach(([cat, amt]) => {
            if (amt > 0) {
                const percentage = (amt / grandTotal) * 100;
                conicGradient += `${colors[cat]} ${currentAngle}% ${currentAngle + percentage}%, `;
                currentAngle += percentage;

                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.innerHTML = `
                    <div class="legend-color" style="background: ${colors[cat]}"></div>
                    <span class="legend-text">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                    <span class="legend-amount">$${amt.toFixed(2)}</span>
                `;
                pieLegend.appendChild(legendItem);
            }
        });

        if (grandTotal > 0) {
            pieChart.style.background = conicGradient.slice(0, -2) + ')';
        } else {
            pieChart.style.background = 'rgba(255,255,255,0.1)';
            pieLegend.innerHTML = '<div class="legend-text">No spending data available</div>';
        }

        // 4. Update Top Merchants
        const merchants = {};
        transactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (amt > 0) {
                merchants[t.merchant] = (merchants[t.merchant] || 0) + amt;
            }
        });

        const sortedMerchants = Object.entries(merchants)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        merchantList.innerHTML = '';
        const maxMerchantSpend = sortedMerchants.length > 0 ? sortedMerchants[0][1] : 1;

        sortedMerchants.forEach(([name, amt]) => {
            const item = document.createElement('div');
            item.innerHTML = `
                <div class="merchant-item">
                    <span class="merchant-name">${name}</span>
                    <span class="merchant-amount">$${amt.toFixed(2)}</span>
                </div>
                <div class="merchant-bar">
                    <div class="merchant-bar-fill" style="width: ${(amt / maxMerchantSpend) * 100}%;"></div>
                </div>
            `;
            merchantList.appendChild(item);
        });

        // 5. Update Savings Recommendation
        const savingsCard = document.getElementById('savingsCard');
        const savingsAmount = document.getElementById('savingsAmount');
        const savingsDetails = document.getElementById('savingsDetails');
        const learnMoreBtn = document.getElementById('learnMoreBtn');

        // Calculate direct savings first for UI consistency
        const historicalSavings = calculatePotentialSavings(totals, account.cashback || {});
        savingsAmount.textContent = `$${historicalSavings.toFixed(2)}`;

        try {
            const savingsRes = await fetch('/api/recommend-savings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId })
            });

            if (savingsRes.ok) {
                const recommendation = await savingsRes.json();
                
                // Update text with Gemini's reasoning
                savingsDetails.innerHTML = `<p>${recommendation.explanation}</p>`;
                savingsCard.style.display = 'block';

                learnMoreBtn.addEventListener('click', () => {
                    const prompt = `I'm looking at my ${account.name} account and I see I could have saved $${historicalSavings.toFixed(2)} in total historical ${recommendation.category} spending by switching to a card like ${recommendation.card}. Can you explain more about how this works and what other options I have?`;
                    window.location.href = `ai-advisor.html?prompt=${encodeURIComponent(prompt)}`;
                });
            }
        } catch (err) {
            console.error('Error loading savings recommendation:', err);
        }

    } catch (error) {
        console.error('Error loading account details:', error);
    }
});