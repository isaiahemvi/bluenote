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

    } catch (error) {
        console.error('Error loading account details:', error);
    }
});