const { GoogleGenerativeAI } = require("@google/generative-ai");
const redis = require("./valkeyClient");
const { getBestCard } = require("./decisionEngine");

// Initialize Gemini client
// Ensure GEMINI_API_KEY is set in your environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Define the functions that Gemini can call
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_account_balance",
        description: "Get the balance of one or more accounts",
        parameters: {
          type: "OBJECT",
          properties: {
            account_names: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "List of account names or nicknames to check balance for"
            }
          },
          required: ["account_names"]
        }
      },
      {
        name: "check_affordability",
        description: "Check if user can afford an item and recommend best account based on cashback and balances",
        parameters: {
          type: "OBJECT",
          properties: {
            item: {
              type: "STRING",
              description: "The item the user wants to buy"
            },
            amount: {
              type: "NUMBER",
              description: "The cost of the item"
            },
            category: {
              type: "STRING",
              enum: ["fuel", "food", "groceries", "travel", "other"],
              description: "The category of the purchase"
            }
          },
          required: ["item", "amount"]
        }
      },
      {
        name: "get_market_card_recommendations",
        description: "Get the best credit cards available on the market for a specific category to compare against user cards",
        parameters: {
          type: "OBJECT",
          properties: {
            category: {
              type: "STRING",
              enum: ["fuel", "food", "groceries", "travel", "other"],
              description: "The spending category to find market-leading cards for"
            }
          },
          required: ["category"]
        }
      },
      {
        name: "get_financial_summary",
        description: "Get a summary of the user's owned credit cards and their highest spending categories from historical transaction data",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      }
    ]
  }
];

async function handleQuery(userQuery, history = []) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: tools,
    systemInstruction: "You are Bluenote AI, a professional financial advisor. You have access to the user's real financial data. When you start a session or are asked about the user's status, use 'get_financial_summary' to see what cards they own and where they spend most. Use this context to provide personalized advice. Only use the 'get_market_card_recommendations' tool if the user explicitly asks about cards on the market, better cashback options, or card comparisons."
  });

  const chat = model.startChat({
    history: history
  });

  let result = await chat.sendMessage(userQuery);
  let response = result.response;
  
  while (response.candidates[0].content.parts.some(part => part.functionCall)) {
    const parts = response.candidates[0].content.parts;
    const functionCalls = parts.filter(part => part.functionCall);
    const functionResponses = [];

    for (const callPart of functionCalls) {
      const functionCall = callPart.functionCall;
      let functionResponse;

      if (functionCall.name === "get_account_balance") {
        functionResponse = await getAccountBalance(functionCall.args.account_names);
      } else if (functionCall.name === "check_affordability") {
        functionResponse = await checkAffordability(
          functionCall.args.item,
          functionCall.args.amount,
          functionCall.args.category
        );
      } else if (functionCall.name === "get_market_card_recommendations") {
        functionResponse = await getMarketCardRecommendations(functionCall.args.category);
      } else if (functionCall.name === "get_financial_summary") {
        functionResponse = await getFinancialSummary();
      }
      
      functionResponses.push({
        functionResponse: {
          name: functionCall.name,
          response: functionResponse
        }
      });
    }

    result = await chat.sendMessage(functionResponses);
    response = result.response;
  }
  
  const finalHistory = await chat.getHistory();
  return { text: response.text(), updatedHistory: finalHistory };
}

module.exports = { handleQuery };

// Your Valkey interaction functions (implement these)
async function getAccountBalance(accountNames) {
  const results = {};
  // In a real app, we might search for IDs, but for this hackathon we'll scan keys
  const keys = await redis.keys('account:*');
  for (const key of keys) {
    const data = await redis.get(key);
    const acc = JSON.parse(data);
    if (accountNames.some(name =>
      acc.name.toLowerCase().includes(name.toLowerCase()) ||
      (acc.nickname && acc.nickname.toLowerCase().includes(name.toLowerCase()))
    )) {
      results[acc.name] = `$${acc.balance}`;
    }
  }
  return results;
}

async function checkAffordability(item, amount, category = "other") {
  const keys = await redis.keys('account:*');
  const accounts = [];
  for (const key of keys) {
    const data = await redis.get(key);
    accounts.push(JSON.parse(data));
  }

  const bestCard = getBestCard(accounts, category, amount);

  if (bestCard.message) {
    return {
      can_afford: false,
      message: "You don't have enough available credit on any single card for this purchase."
    };
  }
  
  return {
    can_afford: true,
    recommended_account: bestCard.name,
    cashback_rate: `${bestCard.rate}%`,
    available_after: `$${bestCard.available - amount}`,
    reason: `The ${bestCard.name} offers the best cashback (${bestCard.rate}%) for ${category} and has sufficient credit.`
  };
}

async function getFinancialSummary() {
  const accountKeys = await redis.keys('account:*');
  const accounts = [];
  for (const key of accountKeys) {
    const data = await redis.get(key);
    accounts.push(JSON.parse(data));
  }

  const transactionsData = await redis.get('transactions:list');
  const transactions = JSON.parse(transactionsData || '[]');

  const spendingByCategory = {};
  transactions.forEach(t => {
    const amt = parseFloat(t.amount);
    if (amt > 0) {
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + amt;
    }
  });

  return {
    owned_cards: accounts.map(a => ({ name: a.name, limit: a.limit, balance: a.balance })),
    spending_breakdown: spendingByCategory,
    top_category: Object.entries(spendingByCategory).sort((a,b) => b[1] - a[1])[0]?.[0] || 'none'
  };
}

async function getMarketCardRecommendations(category = "other") {
  const marketCards = {
    fuel: [
      { name: "Blue Cash Preferred", cashback: "3%", note: "No annual fee for first year" },
      { name: "Costco Anywhere Visa", cashback: "4%", note: "Requires Costco membership" }
    ],
    food: [
      { name: "American Express Gold", cashback: "4x Points", note: "Best for dining worldwide" },
      { name: "Capital One SavorOne", cashback: "3%", note: "No annual fee" }
    ],
    groceries: [
      { name: "Blue Cash Preferred", cashback: "6%", note: "Up to $6,000 per year" },
      { name: "Amex Gold", cashback: "4x Points", note: "On up to $25k spend" }
    ],
    travel: [
      { name: "Chase Sapphire Reserve", cashback: "3x Points", note: "Includes $300 travel credit" },
      { name: "Capital One Venture X", cashback: "2x Miles", note: "Best value luxury travel" }
    ],
    other: [
      { name: "Citi Double Cash", cashback: "2%", note: "1% when you buy, 1% when you pay" },
      { name: "Chase Freedom Unlimited", cashback: "1.5%", note: "Good for all-around spend" }
    ]
  };

  return {
    category: category,
    top_market_cards: marketCards[category] || marketCards.other
  };
}

// Example usage
async function main() {
  const answer = await handleQuery("Can I afford a $50 gas purchase?");
  console.log(answer);
}

main();