require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const readline = require("readline");
const displayHeader = require("../src/displayHeader.js");
displayHeader();

// Configuration
const CONFIG = {
  RPC_URL: "https://carrot.megaeth.com/rpc",
  EXPLORER_URL: "https://megaexplorer.xyz",
  WETH_CONTRACT: "0x4200000000000000000000000000000000000006", // Standard WETH address on MegaETH
  MIN_SWAP_AMOUNT: 0.001, // ETH
  MAX_SWAP_AMOUNT: 0.002, // ETH
  MIN_DELAY: 1, // minutes
  MAX_DELAY: 2, // minutes
  MIN_GAS_LIMIT: 21000,
  MAX_GAS_LIMIT: 30000
};

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
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

// Helper functions
function getRandomAmount() {
  const randomAmount = Math.random() * (CONFIG.MAX_SWAP_AMOUNT - CONFIG.MIN_SWAP_AMOUNT) + CONFIG.MIN_SWAP_AMOUNT;
  return ethers.utils.parseEther(randomAmount.toFixed(4));
}

function getRandomDelay() {
  return Math.floor(
    Math.random() * 
    (CONFIG.MAX_DELAY * 60 * 1000 - CONFIG.MIN_DELAY * 60 * 1000 + 1) + 
    CONFIG.MIN_DELAY * 60 * 1000
  );
}

function getRandomGasLimit() {
  return Math.floor(
    Math.random() * 
    (CONFIG.MAX_GAS_LIMIT - CONFIG.MIN_GAS_LIMIT + 1) + 
    CONFIG.MIN_GAS_LIMIT
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

// Swap functions
async function wrapETH(amount) {
  try {
    console.log(`🔄 Wrapping ${ethers.utils.formatEther(amount)} ETH to WETH...`.magenta);
    
    const tx = await wethContract.deposit({
      value: amount,
      gasLimit: getRandomGasLimit()
    });
    
    console.log(`✔️  Wrap ETH → WETH successful`.green.underline);
    console.log(`➡️  Transaction: ${CONFIG.EXPLORER_URL}/tx/${tx.hash}`.yellow);
    
    const receipt = await tx.wait();
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`.dim);
    
    return receipt;
  } catch (error) {
    console.error("❌ Error wrapping ETH:".red, error.message);
    throw error;
  }
}

async function unwrapWETH(amount) {
  try {
    console.log(`🔄 Unwrapping ${ethers.utils.formatEther(amount)} WETH to ETH...`.magenta);
    
    const tx = await wethContract.withdraw(amount, {
      gasLimit: getRandomGasLimit()
    });
    
    console.log(`✔️  Unwrap WETH → ETH successful`.green.underline);
    console.log(`➡️  Transaction: ${CONFIG.EXPLORER_URL}/tx/${tx.hash}`.yellow);
    
    const receipt = await tx.wait();
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`.dim);
    
    return receipt;
  } catch (error) {
    console.error("❌ Error unwrapping WETH:".red, error.message);
    throw error;
  }
}

// Main cycle function
async function runSwapCycle(cycles, intervalHours = null) {
  console.log("\n💰 Starting ETH/WETH swap cycles...\n".bold);
  
  try {
    // Initial balance check
    const initialBalances = await getCurrentBalances();
    console.log(`Initial Balances:`.underline);
    console.log(`ETH: ${initialBalances.eth}`.green);
    console.log(`WETH: ${initialBalances.weth}\n`.green);
    
    let cycleCount = 0;
    
    const executeCycle = async () => {
      cycleCount++;
      console.log(`\n🔄 Starting cycle ${cycleCount} of ${cycles}`.bold.blue);
      
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
            console.log(`⏳ Next cycle in ${delayMs / 1000 / 60} minute(s)...`.yellow);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            await executeCycle();
          }
        } else {
          console.log(`\n🎉 All ${cycles} swap cycles completed successfully!`.bold.green);
          process.exit(0);
        }
      } catch (error) {
        console.error(`❌ Cycle ${cycleCount} failed:`.red, error.message);
        // Optionally retry or exit
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
    console.error("❌ Fatal error in swap cycles:".red, error);
    process.exit(1);
  }
}

// User input handling
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
      
      console.log(`\nStarting ${cycles} swap cycles ${intervalHours ? `every ${intervalHours} hour(s)` : 'with random delays'}...`.bold);
      runSwapCycle(cycles, intervalHours);
    });
  });
}

// Start the program
promptUser();

// Handle process termination
process.on('SIGINT', () => {
  console.log("\n🛑 Process stopped by user".red);
  process.exit(0);
});
