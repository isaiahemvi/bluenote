// Modal functions
function openModal() {
    const modal = document.getElementById('addAccountModal');
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('addAccountModal');
    modal.classList.remove('active');
    document.getElementById('addAccountForm').reset();
}

// Market best rates for potential savings calculation
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

// Close modal when clicking outside
document.getElementById('addAccountModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Handle form submission
document.getElementById('addAccountForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const payload = {
        cardName: document.getElementById('cardName').value,
        nickname: document.getElementById('nickname').value,
        creditLimit: document.getElementById('creditLimit').value,
        balance: document.getElementById('balance').value,
        cashbackFuel: document.getElementById('cashbackFuel').value,
        cashbackFood: document.getElementById('cashbackFood').value,
        cashbackGroceries: document.getElementById('cashbackGroceries').value,
        cashbackTravel: document.getElementById('cashbackTravel').value,
        cashbackOther: document.getElementById('cashbackOther').value
    };
    
    try {
        const response = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            closeModal();
            window.location.reload();
        } else {
            console.error('Failed to add account:', await response.text());
            alert('Failed to add account. Please try again.');
        }
    } catch (error) {
        console.error('Error adding account:', error);
        alert('Error adding account. Please check your connection and try again.');
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('accounts-container');
    const addBtn = document.querySelector('.add-account-btn');
    try {
        const [accRes, transRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/transactions')
        ]);
        const accounts = await accRes.json();
        const transactions = await transRes.json();
        
        accounts.forEach(acc => {
            const accountTransactions = transactions.filter(t => t.account_id == acc.id);
            
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
                if (amt > 0) {
                    const cat = totals.hasOwnProperty(t.category) ? t.category : 'other';
                    totals[cat] += amt;
                    grandTotal += amt;
                }
            });

            // Calculate Potential Savings for this specific card
            const savings = calculatePotentialSavings(totals, acc.cashback || {});
            
            const card = document.createElement('div');
            card.className = 'account-card';
            card.dataset.id = acc.id;
            
            let segmentsHtml = '';
            for (const [category, amount] of Object.entries(totals)) {
                if (amount > 0) {
                    const percentage = (amount / grandTotal) * 100;
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
                        <div class="account-type" style="font-size: 0.7rem; color: rgba(255,200,100,0.5)">${acc.nickname || ''}</div>
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
                window.location.href = `account-details.html?id=${acc.id}`;
            });
            
            container.insertBefore(card, addBtn);
        });
    } catch (error) {
        console.error('Error rendering dashboard:', error);
    }
});