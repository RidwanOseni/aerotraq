// blockchain-example.js
async function main() {
    try {
      // Get ETH balance for an address using ENS
      console.log("Getting ETH balance for vitalik.eth...");
      
      // When using with Cursor, you can simply ask Cursor to:
      // "Check the ETH balance of vitalik.eth on mainnet"
      // Or "Transfer 0.1 ETH from my wallet to vitalik.eth"
      
      // Cursor will use the MCP server to execute these operations 
      // without requiring any additional code from you
      
      // This is the power of the MCP integration - your AI assistant
      // can directly interact with blockchain data and operations
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
  
  main();