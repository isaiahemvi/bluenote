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
            
            // Calculate totals for specific categories
            const totals = {
                fuel: 0,
                food: 0,
                travel: 0,
                groceries: 0
            };

            accountTransactions.forEach(t => {
                const amt = parseFloat(t.amount);
                // Only count positive spending (not deposits which are negative)
                if (amt > 0 && totals.hasOwnProperty(t.category)) {
                    totals[t.category] += amt;
                }
            });

            // Calculate a max for scaling bars (highest category or at least 1)
            const maxSpent = Math.max(...Object.values(totals), 1);

            const card = document.createElement('div');
            card.className = 'account-card';
            card.dataset.id = acc.id;

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
                <div class="spending-graph">
                    <div class="category-bar">
                        <div class="bar-container">
                            <div class="bar-fill gas-bar" style="height: ${(totals.fuel / maxSpent) * 100}%;"></div>
                        </div>
                        <div class="category-label">Fuel</div>
                        <div class="category-amount">$${totals.fuel.toFixed(0)}</div>
                    </div>
                    <div class="category-bar">
                        <div class="bar-container">
                            <div class="bar-fill food-bar" style="height: ${(totals.food / maxSpent) * 100}%;"></div>
                        </div>
                        <div class="category-label">Food</div>
                        <div class="category-amount">$${totals.food.toFixed(0)}</div>
                    </div>
                    <div class="category-bar">
                        <div class="bar-container">
                            <div class="bar-fill travel-bar" style="height: ${(totals.travel / maxSpent) * 100}%;"></div>
                        </div>
                        <div class="category-label">Travel</div>
                        <div class="category-amount">$${totals.travel.toFixed(0)}</div>
                    </div>
                    <div class="category-bar">
                        <div class="bar-container">
                            <div class="bar-fill groceries-bar" style="height: ${(totals.groceries / maxSpent) * 100}%;"></div>
                        </div>
                        <div class="category-label">Groceries</div>
                        <div class="category-amount">$${totals.groceries.toFixed(0)}</div>
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