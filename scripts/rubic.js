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

// Inisialisasi provider dan wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  WMON_CONTRACT,
  [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
  ],
  wallet
);

function getRandomAmount() {
  const min = 0.005;
  const max = 0.01;
  const randomAmount = Math.random() * (max - min) + min; // Random between 0.005 and 0.01
  return ethers.utils.parseEther(randomAmount.toFixed(4)); // Convert to wei with 4 decimal places
}

function getRandomDelay() {
  const minDelay = 1 * 60 * 1000; // 1 minute in milliseconds
  const maxDelay = 2 * 60 * 1000; // 2 minutes in milliseconds
  return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay); // Random delay
}

async function wrapMON(amount) {
  try {
    console.log(
      `🔄 Wrapping ${ethers.utils.formatEther(amount)} MON into WMON...`.magenta
    );
    const minGas = 50000;
    const maxGas = 102000;
    const randomGasLimit = Math.floor(Math.random() * (maxGas - minGas + 1)) + minGas;
    const tx = await contract.deposit({ value: amount, gasLimit: randomGasLimit }); // Random gas
    console.log(`✔️  Wrap MON → WMON successful`.green.underline);
    console.log(`➡️  Transaction sent: ${EXPLORER_URL}${tx.hash}`.yellow);
    await tx.wait();
  } catch (error) {
    console.error("❌ Error wrapping MON:".red, error);
  }
}

async function unwrapMON(amount) {
  try {
    console.log(
      `🔄 Unwrapping ${ethers.utils.formatEther(amount)} WMON back to MON...`
        .magenta
    );
    const minGas = 50000; // gas with 50.000 wei
    const maxGas = 102000; // gas with 102.000 wei
    const randomGasLimit = Math.floor(Math.random() * (maxGas - minGas + 1)) + minGas;
    const tx = await contract.withdraw(amount, { gasLimit: randomGasLimit }); // Random gas
    console.log(`✔️  Unwrap WMON → MON successful`.green.underline);
    console.log(`➡️  Transaction sent: ${EXPLORER_URL}${tx.hash}`.yellow);
    await tx.wait();
  } catch (error) {
    console.error("❌ Error unwrapping WMON:".red, error);
  }
}

async function runSwapCycle(cycles, interval) {
  let cycleCount = 0;

  if (interval) {
    const intervalId = setInterval(async () => {
      if (cycleCount < cycles) {
        const randomAmount = getRandomAmount();
        const randomDelay = getRandomDelay();
        console.log(`Cycle ${cycleCount + 1} of ${cycles}:`.magenta);
        await wrapMON(randomAmount);
        await unwrapMON(randomAmount);
        cycleCount++;
        console.log(
          `Next cycle will be after ${randomDelay / 1000 / 60} minute(s)`.yellow
        );
      } else {
        clearInterval(intervalId);
        console.log(`All ${cycles} cycles completed`.green);
      }
    }, interval * 60 * 60 * 1000); // Interval in hours converted to milliseconds
  } else {
    // If no interval, run all cycles immediately
    for (let i = 0; i < cycles; i++) {
      const randomAmount = getRandomAmount();
      const randomDelay = getRandomDelay();
      console.log(`Cycle ${i + 1} of ${cycles}:`.magenta);
      await wrapMON(randomAmount);
      await unwrapMON(randomAmount);
      console.log(
        `Waiting for ${randomDelay / 1000 / 60} minute(s) before next cycle...`
          .yellow
      );
      await new Promise((resolve) => setTimeout(resolve, randomDelay)); // Random delay between cycles
    }
    console.log(`All ${cycles} cycles completed`.green);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "How many swap cycles would you like to run? (Press enter to skip): ",
  (cycles) => {
    rl.question(
      "How often (in hours) would you like the cycle to run? (Press enter to skip): ",
      (hours) => {
        let cyclesCount = cycles ? parseInt(cycles) : 1; // Default to 1 cycle if not provided
        let intervalHours = hours ? parseInt(hours) : null; // If not provided, interval is null

        if (
          isNaN(cyclesCount) ||
          (intervalHours !== null && isNaN(intervalHours))
        ) {
          console.log("❌ Invalid input. Please enter valid numbers.".red);
          rl.close();
          return;
        }

        console.log(
          `Starting ${cyclesCount} swap cycles ${
            intervalHours ? `every ${intervalHours} hour(s)` : "immediately"
          }...`
        );
        runSwapCycle(cyclesCount, intervalHours);

        rl.close();
      }
    );
  }
);
