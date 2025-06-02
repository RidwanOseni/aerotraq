🛸 Aerotraq – Decentralized Drone Flight Registry
AI Validation + IPFS + On-Chain Record-Keeping
Laying the foundation for tokenized drone IP assets via Story Protocol.

🚀 Features
AI-powered Flight Plan Validation
Uses an OpenAIP-powered MCP (Model Context Protocol) server to check no-fly zones. AI agent (via OpenAI) generates compliance reports.

Deterministic Rule Checks
Automated checks on date, time, altitude, and drone specs based on regional airspace rules.

Decentralized Data Storage
Flight plans and telemetry logs are stored on IPFS. Serialized and hashed data ensures integrity.

On-Chain Registration (Polygon Amoy)
Flight data hashes are recorded on-chain using a custom smart contract on the Polygon Amoy testnet (Chain ID: 80002).

DGIP Simulation
Simulates drone flight telemetry like GPS, altitude, and speed. Produces logs for potential IP use.

Future IP Tokenization
Integrates with Story Protocol (WIP) to mint IP assets from drone-generated logs (DGIP), assign licenses, and manage royalties.

Cross-Platform Compatible
Works on Windows, Linux, and GitHub Codespaces.

🛠️ Tech Stack
Frontend: Next.js (React), Wagmi, Viem

Backend:

API Routes (Next.js)

Python (LlamaIndex + custom scripts)

Node.js (OpenAIP MCP server)

Smart Contract: Solidity (DroneFlight)

Deployed to Polygon Amoy at:
0xbf9da8c38e15105f0ada872ea78512991d6a601c

Chain ID: 80002

Storage: IPFS (via aioipfs in Python)

AI: OpenAI SDK + LlamaIndex

Database: SQLite

Web3 Interaction: Wagmi + Viem (no Hardhat or Ganache)

⚙️ Setup Instructions
1. Prerequisites
Python 3.9+

Node.js 18+

Git

Local IPFS daemon (API must be enabled)

uv or pip for Python deps

Metamask or other wallet (for Polygon Amoy)

💡 Note: No Ganache or Hardhat needed — smart contract is already deployed on Polygon Amoy.

2. Clone the Repo

git clone https://github.com/your-org/your-repo.git
cd your-repo

3. Setup Python Environment

With uv:
uv venv
source .venv/bin/activate
uv add openai mcp[cli] aioipfs eth-hash[pycryptodome] python-dotenv python-dateutil fastapi uvicorn python-multipart

With pip:
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

4. Setup Node.js MCP Server

cd mcp-server/openaip-mcp-server
npm install
npm run build
5. Environment Variables
Update .env using the example file:

cp .env.example .env
Update the following fields in .env:

WEB3_PROVIDER_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
Set your API keys and paths accordingly.

6. No Smart Contract Deployment Required
The smart contract is already deployed. Ensure your frontend/backend uses this address:

0xbf9da8c38e15105f0ada872ea78512991d6a601c
If redeployment is ever needed, use Remix and update the contract address and ABI in your code.

7. Run the App
Start IPFS daemon

Ensure .env is set up correctly

Start MCP server (if not auto-spawned)

Start the Next.js app:

npm run dev
Visit: http://localhost:3000

🔄 Workflow Summary
User Input: Flight specs are entered in the frontend.

Validation:

Python script checks flight parameters

Calls MCP server for no-fly zone validation

AI agent generates compliance report

IPFS Storage:

Validated data is serialized + hashed

Uploaded to IPFS (returns CID)

On-Chain Hash Registration (Step 1):

registerFlight(hash) is called on contract (via Wagmi)

DGIP Logging:

Simulates telemetry

User triggers processing to generate a DGIP log

On-Chain DGIP Link (Step 2):

Calls registerDGIPData(flightHash, dgipHash)

(Planned) Story Protocol IP Tokenization:

Mint IP asset via SDK

Attach license terms (PIL)

Enable future monetization and listing

🌐 Example .env Settings

# Web3
WEB3_PROVIDER_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002

# IPFS
IPFS_HOST=127.0.0.1
IPFS_PORT=5001
IPFS_PROTOCOL=http

# AI Keys
OPENAI_API_KEY=your_openai_key
OPENAIP_API_KEY=your_openaip_key

# SQLite
DB_PATH=flight_data.db

# Optional
LOG_LEVEL=INFO
LOG_FILE=app.log
PYTHON_EXECUTABLE=python

🤝 Contributions
Pull requests, issues, and ideas are welcome! Feel free to fork the repo, open an issue, or submit a PR.

Please note: By contributing, you agree that your submissions are offered under the same license, and do not imply ownership or claim over the broader project or its core concept.