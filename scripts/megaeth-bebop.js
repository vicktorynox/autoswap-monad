require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const readline = require("readline");
const displayHeader = require("../src/displayHeader.js");
displayHeader();

// Enhanced Configuration (delays in seconds)
const CONFIG = {
  RPC_URL: "https://carrot.megaeth.com/rpc",
  EXPLORER_URL: "https://megaexplorer.xyz",
  WETH_CONTRACT: "0x4eB2Bd7beE16F38B1F4a0A5796Fffd028b6040e9", // WETH address on MegaETH
  MIN_SWAP_AMOUNT: 0.0001, // ETH
  MAX_SWAP_AMOUNT: 0.002, // ETH
  MIN_DELAY: 60, // seconds (previously minutes)
  MAX_DELAY: 120, // seconds (previously minutes)
  GAS_BUFFER: 1.3, // 30% buffer
  MAX_RETRIES: 3,
  BASE_GAS_LIMIT: {
    DEPOSIT: 25000,
    WITHDRAW: 30000
  },
  FIXED_GAS_PRICE: ethers.utils.parseUnits("0.001", "gwei") // 0.001 Gwei
};

// Initialize provider with timeout and network settings
const provider = new ethers.providers.JsonRpcProvider(
  {
    url: CONFIG.RPC_URL,
    timeout: 30000
  },
  {
    chainId: 6342,
    name: "megaeth"
  }
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const wethContract = new ethers.Contract(
  CONFIG.WETH_CONTRACT,
  [
    "function deposit() public payable",
    "function withdraw(uint256 wad) public",
    "function balanceOf(address owner) public view returns (uint256)"
  ],
  wallet
);

// Enhanced Gas Handling with fixed gas price
async function getGasParameters(operation, amount) {
  try {
    let estimatedGas;
    
    if (operation === 'deposit') {
      estimatedGas = await wethContract.estimateGas.deposit({
        value: amount
      });
    } else {
      estimatedGas = await wethContract.estimateGas.withdraw(amount);
    }

    const bufferedGas = Math.floor(estimatedGas.toNumber() * CONFIG.GAS_BUFFER);

    return {
      maxFeePerGas: CONFIG.FIXED_GAS_PRICE,
      maxPriorityFeePerGas: CONFIG.FIXED_GAS_PRICE,
      gasLimit: bufferedGas
    };
  } catch (error) {
    console.error("⚠️  Gas estimation failed, using fallback values".yellow);
    return {
      maxFeePerGas: CONFIG.FIXED_GAS_PRICE,
      maxPriorityFeePerGas: CONFIG.FIXED_GAS_PRICE,
      gasLimit: operation === 'deposit' 
        ? CONFIG.BASE_GAS_LIMIT.DEPOSIT 
        : CONFIG.BASE_GAS_LIMIT.WITHDRAW
    };
  }
}

// Robust Wrapping Function with Retries
async function wrapETH(amount, attempt = 1) {
  try {
    const gasParams = await getGasParameters('deposit', amount);
    console.log(`🔄 Attempt ${attempt}: Wrapping ${ethers.utils.formatEther(amount)} ETH to WETH...`.magenta);
    
    const tx = await wethContract.deposit({
      value: amount,
      ...gasParams
    });
    
    console.log(`✔️  Wrap successful (Gas: ${gasParams.gasLimit})`.green);
    console.log(`➡️  ${CONFIG.EXPLORER_URL}/tx/${tx.hash}`.dim);
    
    const receipt = await tx.wait();
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`.dim);
    return receipt;
  } catch (error) {
    if (attempt >= CONFIG.MAX_RETRIES) throw error;
    
    console.error(`⚠️  Attempt ${attempt} failed: ${error.shortMessage || error.message}`.yellow);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    return wrapETH(amount, attempt + 1);
  }
}

// Robust Unwrapping Function with Retries and Balance Check
async function unwrapWETH(amount, attempt = 1) {
  try {
    // First check WETH balance
    const balance = await wethContract.balanceOf(wallet.address);
    if (balance.lt(amount)) {
      throw new Error(`Insufficient WETH balance (${ethers.utils.formatEther(balance)} < ${ethers.utils.formatEther(amount)})`);
    }

    const gasParams = await getGasParameters('withdraw', amount);
    console.log(`🔄 Attempt ${attempt}: Unwrapping ${ethers.utils.formatEther(amount)} WETH...`.magenta);
    
    const tx = await wethContract.withdraw(amount, {
      ...gasParams
    });
    
    console.log(`✔️  Unwrap successful (Gas: ${gasParams.gasLimit})`.green);
    console.log(`➡️  ${CONFIG.EXPLORER_URL}/tx/${tx.hash}`.dim);
    
    const receipt = await tx.wait();
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`.dim);
    return receipt;
  } catch (error) {
    if (attempt >= CONFIG.MAX_RETRIES) throw error;
    
    console.error(`⚠️  Attempt ${attempt} failed: ${error.shortMessage || error.message}`.yellow);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    return unwrapWETH(amount, attempt + 1);
  }
}

// Helper Functions
function getRandomAmount() {
  const randomAmount = Math.random() * 
    (CONFIG.MAX_SWAP_AMOUNT - CONFIG.MIN_SWAP_AMOUNT) + 
    CONFIG.MIN_SWAP_AMOUNT;
  return ethers.utils.parseEther(randomAmount.toFixed(4));
}

// Changed to use seconds instead of minutes
function getRandomDelay() {
  return Math.floor(
    Math.random() * 
    (CONFIG.MAX_DELAY * 1000 - CONFIG.MIN_DELAY * 1000 + 1) + 
    CONFIG.MIN_DELAY * 1000
  );
}

async function getCurrentBalances() {
  const ethBalance = await wallet.getBalance();
  const wethBalance = await wethContract.balanceOf(wallet.address);
  
  return {
    eth: ethers.utils.formatEther(ethBalance),
    weth: ethers.utils.formatEther(wethBalance)
  };
}

// Main Execution Flow with Interval Support
async function runSwapCycle(cycles, intervalHours = null) {
  console.log("\n💰 Starting ETH/WETH Swap Bot\n".bold);
  
  try {
    // Initial balance check
    const initialBalances = await getCurrentBalances();
    console.log(`Initial Balances:`.underline);
    console.log(`ETH: ${initialBalances.eth}`.green);
    console.log(`WETH: ${initialBalances.weth}\n`.green);
    
    let cycleCount = 0;
    
    const executeCycle = async () => {
      cycleCount++;
      console.log(`\n🔄 Cycle ${cycleCount} of ${cycles}`.bold.blue);
      
      const swapAmount = getRandomAmount();
      const delayMs = getRandomDelay();
      
      try {
        // Wrap ETH to WETH
        await wrapETH(swapAmount);
        
        // Unwrap WETH back to ETH
        await unwrapWETH(swapAmount);
        
        // Show updated balances
        const balances = await getCurrentBalances();
        console.log(`\nUpdated Balances:`.underline);
        console.log(`ETH: ${balances.eth}`.green);
        console.log(`WETH: ${balances.weth}\n`.green);
        
        // Schedule next cycle or complete
        if (cycleCount < cycles) {
          if (intervalHours) {
            console.log(`⏳ Next cycle in ${intervalHours} hour(s)...`.yellow);
          } else {
            // Convert to seconds for display
            const delaySeconds = Math.floor(delayMs / 1000);
            console.log(`⏳ Next cycle in ${delaySeconds} seconds...`.yellow);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            await executeCycle();
          }
        } else {
          console.log(`\n🎉 All ${cycles} cycles completed successfully!`.bold.green);
          process.exit(0);
        }
      } catch (error) {
        console.error(`❌ Cycle ${cycleCount} failed:`.red, error.message);
        process.exit(1);
      }
    };
    
    if (intervalHours) {
      // Run on fixed interval
      await executeCycle(); // Run first cycle immediately
      const intervalId = setInterval(executeCycle, intervalHours * 60 * 60 * 1000);
      
      // Cleanup when cycles complete
      const checkCompletion = setInterval(() => {
        if (cycleCount >= cycles) {
          clearInterval(intervalId);
          clearInterval(checkCompletion);
        }
      }, 1000);
    } else {
      // Run sequentially with random delays
      await executeCycle();
    }
  } catch (error) {
    console.error("\n❌ Fatal error in swap cycle:".red, error.message);
    process.exit(1);
  }
}

// User Interface
function promptUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question("How many swap cycles would you like to run? (Default: 1): ", (cyclesInput) => {
    rl.question("How often in hours? Leave empty for random delays: ", (intervalInput) => {
      rl.close();
      
      const cycles = parseInt(cyclesInput) || 1;
      const intervalHours = intervalInput ? parseInt(intervalInput) : null;
      
      if (isNaN(cycles) || (intervalHours !== null && isNaN(intervalHours))) {
        console.error("❌ Invalid input. Please enter numbers only.".red);
        process.exit(1);
      }
      
      console.log(`\nStarting ${cycles} swap cycle${cycles !== 1 ? 's' : ''} ${intervalHours ? `every ${intervalHours} hour(s)` : 'with random delays'}...`.bold);
      runSwapCycle(cycles, intervalHours);
    });
  });
}

// Start the bot
promptUser();

// Clean shutdown
process.on('SIGINT', () => {
  console.log("\n🛑 Bot stopped by user".red);
  process.exit(0);
});
