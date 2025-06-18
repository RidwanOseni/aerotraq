# 🛸 Aerotraq – Decentralized Drone Flight Registry

AI Validation + IPFS + On-Chain Record-Keeping and IP Monetization Platform
Laying the foundation for tokenized drone IP assets via Story Protocol.

Surreal World Asset Buildathon Q2 2025

## 🚀 Overview

Aerotraq is a cutting-edge decentralized drone management and simulation platform built with Next.js and TypeScript, featuring deep smart contract and AI integration. It empowers users to register drones, track simulated flights via DGIP (Drone Generated Identity Protocol) logs, and tokenize drone-generated data as Intellectual Property (IP) assets on the blockchain for monetization and transparent record-keeping.

Our platform directly addresses critical challenges in modern drone technology: traceability, secure flight validation, and decentralized IP management and monetization. By leveraging AI for compliance checks and blockchain for immutable records and royalty distribution, Aerotraq ensures urban airspace safety, facilitates scalable UAV adoption, and opens new avenues for data-driven revenue generation for drone operators.

## 🌟 Features

Aerotraq offers a comprehensive suite of features designed to enhance drone operations and data management:

- **AI-Powered Flight Plan Validation**: Users submit detailed flight plans, which undergo AI-powered compliance validation. This includes checking against regulations and No-Fly Zones using LlamaIndex and an OpenAIP Model Context Protocol (MCP) server. An AI agent (via OpenAI) then generates a comprehensive compliance report based on these findings.

- **Deterministic Rule Checks**: Automated checks are performed on various flight parameters such as date, time, altitude, and drone specifications, ensuring adherence to regional airspace rules.

- **Decentralized Data Storage**: Compliant flight data is serialized, its Keccak256 hash is calculated, and the data is uploaded to IPFS for decentralized and immutable storage.

- **On-Chain Registration**: The flight plan hash is subsequently registered on-chain via a custom smart contract (address: `0x4f3880A15Ea6f0E1A269c59e44855a9963B86949`) on the Story Aeneid Testnet (Chain ID 1315) to ensure immutability and uniqueness.

- **Secure DGIP Log Simulation & On-Chain Linking**: The platform simulates real-time DGIP (Drone Generated Identity Protocol) telemetry logs, capturing data points like location, altitude, speed, heading, and battery, dynamically displaying the flight path. After simulation, the DGIP log data is processed, hashed, and uploaded to IPFS. This DGIP data hash is then linked on-chain to the initial flight registration record in the smart contract, creating a verifiable chain of custody for generated flight data.

- **Story Protocol IP Asset Tokenization & Monetization**: Aerotraq integrates with Story Protocol's Aeneid Testnet to transform drone flight data into tokenized Intellectual Property (IP) Assets. This involves registering Programmable IP License (PIL) Terms (e.g., commercial remix terms allowing revenue sharing) and minting an NFT from an SPG (Story Protocol Graph) NFT contract, attaching metadata that points to the IPFS CIDs of the initial flight data and DGIP logs. Users can then claim accrued royalties in $WIP (Story Protocol's native token) generated from their tokenized IP Assets.

- **Enhanced User Wallet Experience (Tomo Integration)**: The platform provides seamless wallet connection with social login capabilities through TomoEVMKit, wrapping the existing Wagmi setup for improved user adoption. It leverages Tomo's key management, which combines OAuth for convenience and Trusted Execution Environment (TEE) for robust private key security.

- **Security-first Design**: Implements robust security measures through smart contract interactions and Tomo's advanced key management.

- **Developer-friendly Architecture**: Features modular design, strong typing with TypeScript and Zod, and optimized dynamic imports for performance.

- **Cross-Platform Compatible**: Works on Windows, Linux, and GitHub Codespaces.

## 🔄 Workflow Summary

1. **User Input**: Flight specifications are entered in the frontend.

2. **Validation**:
   - A Python script performs deterministic checks on flight parameters.
   - The Python script calls a Node.js-based Model Context Protocol (MCP) server for no-fly zone validation using OpenAIP data.
   - An AI agent (powered by OpenAI and LlamaIndex) generates a comprehensive compliance report based on all validation findings.

3. **IPFS Storage**: Validated flight data is serialized, hashed (Keccak256), and uploaded to IPFS. The IPFS Content Identifier (CID) is returned.

4. **On-Chain Initial Flight Registration**: The calculated hash of the initial flight plan is registered on the custom smart contract via Wagmi.

5. **DGIP Logging**: The application simulates real-time drone telemetry, generating DGIP logs.

6. **On-Chain DGIP Link**: Users can trigger a process to hash the simulated DGIP log data and link this hash to the initial flight registration record on the smart contract.

7. **Story Protocol IP Tokenization**: The platform facilitates minting an IP asset via the Story Protocol SDK, attaching programmable IP license terms (PIL), and enabling future monetization and listing of the tokenized drone data.

## 🛠️ Tech Stack

Aerotraq is built using a modern, robust tech stack:

### Frontend
- Next.js 14
- React 18
- TailwindCSS
- TypeScript (^5)
- Zod (^3.24.2)

### Blockchain Integration
- Wagmi (^2.14.16)
- Viem (^2.30.6)
- Ethers.js (^6.13.5)
- Story Protocol Core SDK (@story-protocol/core-sdk ^1.3.1)
- Custom DroneFlight Smart Contract: Deployed to Story Aeneid Testnet at `0x4f3880A15Ea6f0E1A269c59e44855a9963B86949`
- Network: Story Aeneid Testnet (Chain ID: 1315)
- Wallet Integration: TomoEVMKit (@tomo-inc/tomo-evm-kit ^0.0.47)

### AI & Backend Logic (Python)
- LlamaIndex (llama_index.core)
- OpenAI (openai)
- MCP (mcp ^1.4.2) for OpenAIP integration
- aioipfs (aioipfs) for IPFS interactions
- sqlite3 for local database persistence

### UI Components
- ShadCN
- Radix UI

### Storage & Infrastructure
- IPFS (via aioipfs in Python)
- SQLite Database
- Next.js API Routes
- Python (LlamaIndex + custom scripts)
- Node.js (OpenAIP MCP server)

## 🧪 How to Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/RidwanOseni/aerotraq.git
cd aerotraq
```

### 2. Set Up Your Environment Variables

Create a file named `.env.local` in the root directory of your aerotraq project, using the `.env.example` file as a template. Populate it with your API keys and configuration details.

Required API Keys:
- OpenAIP API Key: Get your API key from [www.openaip.net](https://www.openaip.net)
- Llama Cloud API Key: Get your API key from [Llama Cloud](https://cloud.llamaindex.ai/login)

Set the Llama Cloud API key:
```bash
# If using a command prompt:
setx LLAMA_CLOUD_API_KEY "<your API key>"

# If using PowerShell:
$env:LLAMA_CLOUD_API_KEY = "<your API key>"
```

### 3. Set Up the Drone Registry App

Navigate into the drone-registry folder:
```bash
cd drone-registry
```

#### Node.js Dependencies
```bash
npm install
npm install core-js-pure # Required dependency for TomoEVMKit if using Next.js
```

#### Python Environment and Dependencies
```bash
# On Windows:
python -m venv venv
venv\Scripts\activate

# On macOS/Linux:
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Set Up the OpenAIP MCP Server

```bash
cd path/to/aerotraq/mcp-server/openaip-mcp-server/
npm install
npm run build
npm start
```

### 5. Run the Application

```bash
npm run dev
```

Your application should now be running locally at http://localhost:3000.

## 💡 Problem Statement

The rapid rise of Unmanned Aerial Vehicles (UAVs) introduces significant challenges for airspace management and accountability. How can we ensure that drone operations are:

- **Properly Registered**: Establishing a verifiable record of drone flights.
- **Compliant with Regulations**: Ensuring flights adhere to No-Fly Zones and other legal frameworks.
- **Transparently Logged**: Providing immutable records of flight activity.
- **Monetizable**: Enabling drone operators to generate revenue from their generated data.

## 📈 Future Enhancements

- **Modular Compliance System**: Support for region-specific flight rules to expand global adoption.
- **Real-Time Drone Telemetry Integration**: Shift from simulation to live tracking and automated compliance.
- **Advanced IP Asset Models**: Enable licensing of diverse drone data types—from aerial media to diagnostic logs and trained AI models.
- **Fleet Dashboard & Multi-User Control**: Centralized management for teams, enterprises, and service providers.
- **Expanded Monetization Channels**: Commercialize orthomaps, mission profiles, firmware modifications, and more via tokenized licensing and marketplaces.
- **Multichain Support**: Enable tokenized drone data assets to be used across Real World Asset (RWA)-friendly chains for broader utility and adoption.

## 🧠 Team

- Ridwan Oseni - Fullstack/AI Web developer
- Ioana - Fullstack/AI Web developer

## 📜 License

MIT License – free to use, fork, and improve.