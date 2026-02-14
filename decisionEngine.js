function getBestCard(accounts, category, amount) {
  let best = null;

  accounts.forEach(acc => {
    const rate = acc.cashback[category] || acc.cashback.other;
    const available = acc.limit - acc.balance;

    if (available >= amount) {
      if (!best || rate > best.rate) {
        best = {
          name: acc.name,
          rate,
          available
        };
      }
    }
  });

  return best || { message: "No eligible card" };
}

module.exports = { getBestCard };