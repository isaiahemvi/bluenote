const { GoogleGenAI } = require("@google/genai");
const redis = require("./valkeyClient");
const { getBestCard } = require("./decisionEngine");

// Initialize Gemini client
// Ensure GEMINI_API_KEY is set in your environment
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

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
      }
    ]
  }
];

async function handleQuery(userQuery) {
  const chat = ai.models.startChat({
    model: "gemini-2.0-flash-exp",
    tools: tools,
  });

  let result = await chat.sendMessage(userQuery);
  let response = result.response;
  
  // Handle function calls
  // In gemini-2.0-flash-exp, function calls are in response.candidates[0].content.parts
  while (response.candidates[0].content.parts.some(part => part.functionCall)) {
    const part = response.candidates[0].content.parts.find(part => part.functionCall);
    const functionCall = part.functionCall;
    
    // Call your actual functions here that interact with Valkey
    let functionResponse;
    if (functionCall.name === "get_account_balance") {
      functionResponse = await getAccountBalance(functionCall.args.account_names);
    } else if (functionCall.name === "check_affordability") {
      functionResponse = await checkAffordability(
        functionCall.args.item,
        functionCall.args.amount,
        functionCall.args.category
      );
    }
    
    // Send function result back to Gemini
    result = await chat.sendMessage([{
      functionResponse: {
        name: functionCall.name,
        response: functionResponse
      }
    }]);
    response = result.response;
  }
  
  return response.text();
}

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

// Example usage
async function main() {
  const answer = await handleQuery("Can I afford a $50 gas purchase?");
  console.log(answer);
}

main();