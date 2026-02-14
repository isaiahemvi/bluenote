const fs = require("fs");
const csv = require("csv-parser");
const redis = require("./valkeyClient");

// ---------- LOAD ACCOUNTS ----------
async function loadAccounts() {
  try {
    const raw = fs.readFileSync("accountsList.json");
    const accounts = JSON.parse(raw);

    for (const acc of accounts) {
      const key = `account:${acc.id}`;

      await redis.set(key, JSON.stringify(acc));
      console.log(`Stored ${key}`);
    }

    console.log("Accounts loaded.\n");
  } catch (err) {
    console.error("Account load error:", err);
  }
}

// ---------- LOAD TRANSACTIONS ----------
async function loadTransactions() {
  return new Promise((resolve, reject) => {
    const transactions = [];

    fs.createReadStream("transactionHistory.csv")
      .pipe(csv())
      .on("data", (row) => {
        transactions.push(row);
      })
      .on("end", async () => {
        try {
          // store entire list for hackathon speed
          await redis.set(
            "transactions:list",
            JSON.stringify(transactions)
          );

          console.log("Transactions loaded.\n");
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject);
  });
}

// ---------- MAIN ----------
async function seed() {
  try {
    await loadAccounts();
    await loadTransactions();

    console.log("SEED COMPLETE");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
