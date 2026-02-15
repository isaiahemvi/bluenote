document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('accounts-container');
    const addBtn = document.querySelector('.add-account-btn');

    try {
        // Fetch both accounts and transactions
        const [accRes, transRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/transactions')
        ]);

        const accounts = await accRes.json();
        const transactions = await transRes.json();

        accounts.forEach(acc => {
            // Filter transactions for this specific account
            const accountTransactions = transactions.filter(t => t.account_id == acc.id);
            
            // Calculate totals for categories
            const totals = {
                fuel: 0,
                food: 0,
                travel: 0,
                groceries: 0,
                other: 0
            };

            let grandTotal = 0;

            accountTransactions.forEach(t => {
                const amt = parseFloat(t.amount);
                // Only count positive spending
                if (amt > 0) {
                    const cat = totals.hasOwnProperty(t.category) ? t.category : 'other';
                    totals[cat] += amt;
                    grandTotal += amt;
                }
            });

            const card = document.createElement('div');
            card.className = 'account-card';
            card.dataset.id = acc.id;

            // Generate segments HTML based on proportions
            let segmentsHtml = '';
            for (const [category, amount] of Object.entries(totals)) {
                if (amount > 0) {
                    const percentage = (amount / grandTotal) * 100;
                    // Only show text inside segment if it's large enough (e.g. > 10%)
                    const showText = percentage > 10;
                    segmentsHtml += `
                        <div class="graph-segment color-${category}" style="width: ${percentage}%">
                            <div class="segment-tooltip">${category.toUpperCase()}: $${amount.toFixed(2)}</div>
                            ${showText ? `<span class="segment-value">$${amount.toFixed(0)}</span>` : ''}
                        </div>
                    `;
                }
            }

            card.innerHTML = `
                <div class="account-header">
                    <div class="account-info">
                        <div class="account-name">${acc.name}</div>
                    </div>
                    <div class="account-balance-section">
                        <div class="account-balance">$${acc.balance} / $${acc.limit}</div>
                        <div class="account-balance-label">Spent / Limit</div>
                    </div>
                </div>
                <div class="spending-graph-container">
                    <div class="spending-graph">
                        ${segmentsHtml || '<div style="width:100%; display:flex; align-items:center; justify-content:center; color:rgba(255,200,100,0.3); font-size:0.8rem;">No Spending Data</div>'}
                    </div>
                    <div class="graph-legend">
                        <div class="legend-item"><div class="legend-color color-fuel"></div>Fuel</div>
                        <div class="legend-item"><div class="legend-color color-food"></div>Food</div>
                        <div class="legend-item"><div class="legend-color color-travel"></div>Travel</div>
                        <div class="legend-item"><div class="legend-color color-groceries"></div>Groceries</div>
                        <div class="legend-item"><div class="legend-color color-other"></div>Other</div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.account-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });

            container.insertBefore(card, addBtn);
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
    }
});