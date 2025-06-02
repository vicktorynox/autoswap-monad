require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const readline = require("readline");
const displayHeader = require("../src/displayHeader.js");
displayHeader();

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

// Method IDs for the contract functions
const METHOD_IDS = {
  deposit: "0xd0e30db0",   // deposit()
  withdraw: "0x2e1a7d4d"   // withdraw(uint256)
};

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  WMON_CONTRACT,
  [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function balanceOf(address) public view returns (uint256)"
  ],
  wallet
);

// UI Elements
const divider = "=".repeat(60).yellow;

// DIFFERENT GAS LIMITS FOR WRAP AND UNWRAP
const GAS_LIMITS = {
  wrap: {
    min: 28000,   // Wrap requires lower gas
    max: 30000
  },
  unwrap: {
    min: 39000,   // Unwrap requires higher gas
    max: 40000
  }
};

// Fixed Gas Fees Configuration
const BASE_GAS_PRICE = ethers.utils.parseUnits('50', 'gwei');
const MAX_GAS_PRICE = ethers.utils.parseUnits('66.5', 'gwei');
const MAX_PRIORITY_FEE = ethers.utils.parseUnits('1', 'gwei');

function getRandomAmount() {
  const min = 0.005;
  const max = 0.015;
  const randomAmount = Math.random() * (max - min) + min;
  return ethers.utils.parseEther(randomAmount.toFixed(4));
}

function getRandomDelay() {
  const minDelay = 5 * 1000;   // 15 seconds
  const maxDelay = 25 * 1000;   // 25 seconds
  return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
}

function getRandomGasLimit(type) {
  // Select gas range based on transaction type
  const range = GAS_LIMITS[type];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

async function getGasParams() {
  try {
    return {
      maxFeePerGas: MAX_GAS_PRICE,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE,
      type: 2
    };
  } catch (error) {
    console.error("❌ Error fetching gas data:".red, error);
    return {
      maxFeePerGas: BASE_GAS_PRICE,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE,
      type: 2
    };
  }
}

async function getBalances() {
  try {
    const monBalance = await provider.getBalance(wallet.address);
    const wmonBalance = await contract.balanceOf(wallet.address);
    
    return {
      mon: ethers.utils.formatEther(monBalance),
      wmon: ethers.utils.formatEther(wmonBalance)
    };
  } catch (error) {
    console.error("❌ Error fetching balances:".red, error);
    return { mon: "0", wmon: "0" };
  }
}

async function displayBalances() {
  const balances = await getBalances();
  console.log(divider);
  console.log("💰 Current Balances:".bold);
  console.log(`MON: ${balances.mon.substring(0, 8)}`.green);
  console.log(`WMON: ${balances.wmon.substring(0, 8)}`.blue);
  console.log(divider);
}

async function wrapMON(amount) {
  try {
    // Validate balance before transaction
    const balances = await getBalances();
    const amountEth = Number(ethers.utils.formatEther(amount));
    
    if (Number(balances.mon) < amountEth) {
      throw new Error(`Insufficient MON balance. Needed: ${amountEth.toFixed(6)} MON, Available: ${Number(balances.mon).toFixed(6)} MON`);
    }

    console.log(divider);
    console.log(`🔄 Wrapping ${ethers.utils.formatEther(amount)} MON to WMON...`.magenta.bold);
    console.log(`📝 Method ID: ${METHOD_IDS.deposit}`.dim);
    
    // USE WRAP-SPECIFIC GAS LIMIT
    const gasLimit = getRandomGasLimit('wrap');
    const gasParams = await getGasParams();
    
    console.log(`⛽ Gas Configuration:`.bold);
    console.log(`- Gas Limit: ${gasLimit} (wrap range)`);
    console.log(`- Max Fee: ${ethers.utils.formatUnits(MAX_GAS_PRICE, 'gwei')} Gwei`.dim);
    
    const tx = await contract.deposit({ 
      value: amount, 
      gasLimit,
      ...gasParams
    });
    
    console.log(`⏳ Transaction sent: ${EXPLORER_URL}${tx.hash}`.yellow);
    console.log(`🔍 Raw data: ${tx.data}`.dim);
    console.log("⌛ Waiting for confirmation...".dim);
    
    const receipt = await tx.wait();
    console.log("✅ Wrap MON → WMON successful".green.bold);
    console.log(`🔗 Block: ${receipt.blockNumber} | Gas used: ${receipt.gasUsed.toString()}`.dim);
    console.log(`⛽ Effective gas price: ${ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei')} Gwei`.dim);
    
    await displayBalances();
    return true;
  } catch (error) {
    console.error("❌ Error wrapping MON:".red.bold, error.message);
    if (error.transaction) {
      console.log(`🔍 Transaction hash: ${EXPLORER_URL}${error.transaction.hash}`.dim);
    }
    return false;
  }
}

async function unwrapMON(amount) {
  try {
    // Validate balance before transaction
    const balances = await getBalances();
    const amountEth = Number(ethers.utils.formatEther(amount));
    
    if (Number(balances.wmon) < amountEth) {
      throw new Error(`Insufficient WMON balance. Needed: ${amountEth.toFixed(6)} WMON, Available: ${Number(balances.wmon).toFixed(6)} WMON`);
    }

    console.log(divider);
    console.log(`🔄 Unwrapping ${ethers.utils.formatEther(amount)} WMON to MON...`.magenta.bold);
    console.log(`📝 Method ID: ${METHOD_IDS.withdraw}`.dim);
    
    // USE UNWRAP-SPECIFIC GAS LIMIT
    const gasLimit = getRandomGasLimit('unwrap');
    const gasParams = await getGasParams();
    
    console.log(`⛽ Gas Configuration:`.bold);
    console.log(`- Gas Limit: ${gasLimit} (unwrap range)`);
    console.log(`- Max Fee: ${ethers.utils.formatUnits(MAX_GAS_PRICE, 'gwei')} Gwei`.dim);
    
    const tx = await contract.withdraw(amount, { 
      gasLimit,
      ...gasParams
    });
    
    console.log(`⏳ Transaction sent: ${EXPLORER_URL}${tx.hash}`.yellow);
    console.log(`🔍 Raw data: ${tx.data}`.dim);
    console.log("⌛ Waiting for confirmation...".dim);
    
    const receipt = await tx.wait();
    console.log("✅ Unwrap WMON → MON successful".green.bold);
    console.log(`🔗 Block: ${receipt.blockNumber} | Gas used: ${receipt.gasUsed.toString()}`.dim);
    console.log(`⛽ Effective gas price: ${ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei')} Gwei`.dim);
    
    await displayBalances();
    return true;
  } catch (error) {
    console.error("❌ Error unwrapping WMON:".red.bold, error.message);
    if (error.transaction) {
      console.log(`🔍 Transaction hash: ${EXPLORER_URL}${error.transaction.hash}`.dim);
    }
    return false;
  }
}

async function runSwapCycle(cycles, interval) {
  let cycleCount = 0;
  
  console.log("\n🔍 Fetching initial balances...");
  await displayBalances();

  console.log("\n⚙️ Gas Fee Configuration:".bold);
  console.log(`- Base Fee: ${ethers.utils.formatUnits(BASE_GAS_PRICE, 'gwei')} Gwei`.dim);
  console.log(`- Max Fee: ${ethers.utils.formatUnits(MAX_GAS_PRICE, 'gwei')} Gwei`.dim);
  console.log(divider);

  // ADDED GAS LIMIT INFO DISPLAY
  console.log("⛽ Gas Limit Ranges:".bold);
  console.log(`- Wrap (MON→WMON): ${GAS_LIMITS.wrap.min}-${GAS_LIMITS.wrap.max} gas`.cyan);
  console.log(`- Unwrap (WMON→MON): ${GAS_LIMITS.unwrap.min}-${GAS_LIMITS.unwrap.max} gas`.cyan);
  console.log(divider);

  if (interval) {
    const intervalId = setInterval(async () => {
      if (cycleCount < cycles) {
        console.log(`\n🔄 Starting cycle ${cycleCount + 1} of ${cycles}`.bold.cyan);
        const randomAmount = getRandomAmount();
        
        const wrapSuccess = await wrapMON(randomAmount);
        if (wrapSuccess) {
          await unwrapMON(randomAmount);
        }
        
        cycleCount++;
        console.log(`⏳ Next cycle in ${Math.round(interval * 60)} minutes...`.yellow.dim);
      } else {
        clearInterval(intervalId);
        console.log(`\n🎉 All ${cycles} cycles completed successfully!`.bold.green);
        await displayBalances();
        process.exit(0);
      }
    }, interval * 60 * 60 * 1000);
  } else {
    for (let i = 0; i < cycles; i++) {
      console.log(`\n🔄 Starting cycle ${i + 1} of ${cycles}`.bold.cyan);
      const randomAmount = getRandomAmount();
      const randomDelay = getRandomDelay();
      
      const wrapSuccess = await wrapMON(randomAmount);
      if (wrapSuccess) {
        await unwrapMON(randomAmount);
      }
      
      if (i < cycles - 1) {
        const delaySeconds = Math.round(randomDelay / 1000);
        console.log(`⏳ Waiting ${delaySeconds} seconds before next cycle...`.yellow.dim);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
    }
    console.log(`\n🎉 All ${cycles} cycles completed successfully!`.bold.green);
    await displayBalances();
    process.exit(0);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n🛠️  MON-WMON Swap Automation Tool".bold.cyan);
console.log(divider);
console.log(`📡 Connected to: ${wallet.address}`.dim);
console.log(`🌐 Network: ${RPC_URL}`.dim);
console.log(divider);

rl.question(
  "🔢 How many swap cycles would you like to run? (Default: 1): ",
  (cycles) => {
    rl.question(
      "⏱️  How often (in hours) would you like the cycle to run? (Press enter for immediate execution): ",
      (hours) => {
        let cyclesCount = cycles ? parseInt(cycles) : 1;
        let intervalHours = hours ? parseInt(hours) : null;

        if (isNaN(cyclesCount)) cyclesCount = 1;
        if (hours && isNaN(intervalHours)) intervalHours = null;

        console.log("\n⚙️  Configuration:".bold);
        console.log(`- Swap cycles: ${cyclesCount}`.cyan);
        console.log(`- Interval: ${intervalHours ? `${intervalHours} hours` : 'immediate execution'}`.cyan);
        console.log(divider);

        runSwapCycle(cyclesCount, intervalHours);
        rl.close();
      }
    );
  }
);
