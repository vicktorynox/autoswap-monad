require("colors");

function displayHeader() {
  process.stdout.write("\x1Bc");
  console.log("========================================".magenta);
  console.log("=          Auto Swap/Stake Monad       =".magenta);
  console.log("=           by vicktorynox labs        =".magenta);
  console.log("=      https://t.me/vicktorynoxlabs    =".magenta);
  console.log("========================================".magenta);
  console.log();
}

module.exports = displayHeader;
