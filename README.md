Here is an adjusted version of your readme.txt file for the Aerotraq drone app, incorporating details and insights from the provided sources.
# 🛰️ Aerotraq - Decentralized Drone Registry, Simulation, and IP Monetization Platform

> Surreal World Asset Buildathon Q2 2025

## 🚀 Overview

Aerotraq is a cutting-edge decentralized drone management and simulation platform built with Next.js, TypeScript, and Leaflet, featuring deep smart contract and AI integration. It empowers users to **register drones**, **track simulated flights via DGIP (Drone Generated Identity Protocol) logs**, and **tokenize drone-generated data as Intellectual Property (IP) assets** on the blockchain for monetization and transparent record-keeping.

Our platform directly addresses critical challenges in modern drone technology: **traceability**, **secure flight validation**, and **decentralized IP management and monetization**. By leveraging AI for compliance checks and blockchain for immutable records and royalty distribution, Aerotraq ensures urban airspace safety, facilitates scalable UAV adoption, and opens new avenues for data-driven revenue generation for drone operators.

## 🌟 Features

*   **Decentralized Flight Registration**:
    *   Users submit detailed flight plans, which undergo **AI-powered compliance validation** (checking against regulations and No-Fly Zones using LlamaIndex and OpenAIP's MCP server) [1-6].
    *   Compliant flight data is then serialized, its Keccak256 hash is calculated, and the data is **uploaded to IPFS** for decentralized storage [7-9].
    *   The flight plan hash is subsequently **registered on-chain** via a custom smart contract (`0xbf9da8c38e15105f0ada872ea78512991d6a601c` [10, 11]) to ensure immutability and uniqueness [12, 13].

*   **Secure DGIP Log Simulation & On-Chain Linking**:
    *   The platform simulates **real-time DGIP (Drone Generated Identity Protocol) telemetry logs**, including location, altitude, speed, heading, and battery, dynamically displaying the flight path on a map [14-26].
    *   After simulation, the DGIP log data is processed, its hash is calculated, and it is **uploaded to IPFS** [27-29].
    *   The DGIP data hash is then **linked on-chain** to the initial flight registration record in the smart contract, creating a verifiable chain of custody for generated flight data [30-32].

*   **Story Protocol IP Asset Tokenization & Monetization**:
    *   The platform integrates with **Story Protocol's Aeneid Testnet (Chain ID 1315)** [33-37] to transform drone flight data into **tokenized Intellectual Property (IP) Assets** [38, 39].
    *   This involves registering **Programmable IP License (PIL) Terms** (e.g., commercial remix terms allowing revenue sharing) and **minting an NFT** from an SPG (Story Protocol Graph) NFT contract, attaching metadata that points to the IPFS CIDs of the initial flight data and DGIP logs [38-44].
    *   Users can **claim accrued royalties in $WIP (Story Protocol's native token)** generated from their tokenized IP Assets [35, 45-49]. The system checks for the existence of a royalty vault for proper revenue distribution [50-52].
    *   Supports **simulation of royalty payments**, demonstrating the full monetization lifecycle for DGIP assets [53-55].

*   **Enhanced User Wallet Experience (Tomo Integration)**:
    *   Seamless wallet connection with **social login capabilities** through **TomoEVMKit**, wrapping the existing Wagmi setup for improved user adoption [56-58].
    *   Utilizes Tomo's key management, which combines **OAuth for convenience** and **Trusted Execution Environment (TEE) for robust private key security** [56, 59, 60].
    *   Provides **in-app $WIP management services** such as SWAP (token exchange) and ONRAMP (token purchase via card), streamlining cryptocurrency interactions directly within the application [45, 61, 62].

*   **Live Location Tracking using Leaflet.js**: Visualizes simulated drone paths and current positions on an interactive map [24-26, 63-67].
*   **Security-first Design**: Implements robust security measures through smart contract interactions and Tomo's advanced key management.
*   **Developer-friendly Architecture**: Features modular design, strong typing with TypeScript and Zod, and optimized dynamic imports for performance.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 14, React 18, TailwindCSS
*   **Mapping & Visualization**: Leaflet.js (`^1.9.4` [68]), React-Leaflet (`^4.1.0` [68])
*   **Type Safety**: TypeScript (`^5` [69]), Zod (`^3.24.2` [69])
*   **Blockchain Integration**:
    *   Wagmi (`^2.14.16` [69]), Viem (`^2.30.6` [69]), Ethers.js (`^6.13.5` [68]) (via Wagmi adapters for incremental migration/third-party libraries [70]).
    *   Story Protocol Core SDK (`@story-protocol/core-sdk` `^1.3.1` [68]).
    *   Custom DroneFlight Smart Contract (address: `0xbf9da8c38e15105f0ada872ea78512991d6a601c` [10, 11]).
    *   Network: Story Aeneid Testnet (Chain ID `1315`) [33-37].
*   **Wallet Integration**: TomoEVMKit (`@tomo-inc/tomo-evm-kit` `^0.0.47` [68]).
*   **AI & Backend Logic (Python)**:
    *   LlamaIndex (`llama_index.core`) [71, 72].
    *   OpenAI (`openai`) [71, 72].
    *   MCP (`mcp` `^1.4.2` [68]) for OpenAIP integration (e.g., NFZ validation) [73, 74].
    *   aioipfs (`aioipfs`) for IPFS interactions [72, 75].
    *   sqlite3 for local database persistence of flight and IP asset mappings [74, 76].
*   **UI Components**: ShadCN, Radix UI

## 🧪 How to Run Locally

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/drone-registry.git
    cd drone-registry
    ```

2.  **Install Node.js Dependencies**:
    ```bash
    npm install
    # Ensure peer dependencies for react-leaflet are also installed:
    npm install react react-dom leaflet
    # Install TypeScript definitions for Leaflet:
    npm install -D @types/leaflet
    # Install core-js-pure, a dependency for TomoEVMKit if using Next.js:
    npm install core-js-pure
    ```

3.  **Set up your `.env` file**: Create a `.env.local` file in the root directory with the following environment variables.
    ```ini
    # --- Frontend/Next.js Related ---
    NEXT_PUBLIC_MAPBOX_API_KEY=your_mapbox_api_key_here # (Optional, if using Mapbox tiles instead of OpenStreetMap)
    NEXT_PUBLIC_BACKEND_URL=http://localhost:3000 # Your Next.js app URL

    # --- Tomo EVM Kit Configuration ---
    NEXT_PUBLIC_TOMO_CLIENT_ID=YOUR_TOMO_CLIENT_ID # Obtain from your Tomo developer account [77-79]
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_WALLETCONNECT_PROJECT_ID # Obtain from WalletConnect Cloud [77-79]

    # --- Story Protocol Specific ---
    SPG_NFT_CONTRACT_ADDRESS=0xYourSpgNftContractAddressHere # Address of an SPG NFT collection you own/control, used for minting IP Assets [44]

    # --- Python Backend (AI/MCP/IPFS) Configuration ---
    # Python executable command (e.g., 'python', 'python3'). Set if 'python' isn't your default.
    PYTHON_EXECUTABLE=python
    # API key for OpenAIP (required for NFZ validation via MCP).
    OPENAIP_API_KEY=YOUR_OPENAIP_API_KEY_HERE
    # Path to the OpenAIP MCP server executable (e.g., Node.js index.js or Python script).
    # This path is relative to your project root.
    OPENAIP_SERVER_PATH=./backend/mcp-server/openaip-mcp-server/build/index.js # Example path
    # Path for the SQLite database. Defaults to 'flight_data.db' if not set.
    DB_PATH=./flight_data.db
    ```

4.  **Python Backend Setup**:
    *   Ensure you have Python 3 installed.
    *   Install Python dependencies for the backend scripts:
        ```bash
        pip install mcp openai aioipfs eth-hash python-dotenv llama-index-core llama-index-llms-openai llama-index-readers-llama-parse web3
        ```
    *   The `llama_validator.py` script automatically initializes an SQLite database (`flight_data.db` by default) for storing flight mappings and IP details [80].

5.  **Configure Next.js**:
    *   **Transpile Packages**: Ensure `next.config.ts` includes `transpilePackages` for `wagmi`, `viem`, `@tomo-inc/tomo-evm-kit`, etc., to resolve CommonJS/ESM interoperability issues [81].
    *   **TypeScript Configuration**: In `tsconfig.json`, ensure `module` and `moduleResolution` are set to `"NodeNext"` [82].

6.  **Load Leaflet CSS**: Ensure `leaflet/dist/leaflet.css` is imported in your `globals.css` file [83].

7.  **Run the Application**:
    ```bash
    npm run dev
    ```
    Your application should now be running locally, typically on `http://localhost:3000`.

**Important Notes for Local Development:**
*   **Hydration Errors**: The `WagmiProviderWrapper.tsx` explicitly sets `ssr: false` for `TomoEVMKitProvider` to address potential React hydration errors caused by server-side rendering discrepancies [84, 85].
*   **Leaflet Icons**: Default Leaflet marker icons may not appear due to bundling issues. The `dgip-simulation-display.tsx` component includes a client-side fix (or expects a global configuration) to correctly load these icons [65, 84, 86-88].

## 💡 Problem Statement

The rapid rise of Unmanned Aerial Vehicles (UAVs) introduces significant challenges for airspace management and accountability. How can we ensure that drone operations are:

*   **Properly Registered**: Establishing a verifiable record of drone flights.
*   **Compliant with Regulations**: Ensuring flights adhere to No-Fly Zones and other legal frameworks.
*   **Transparently Logged**: Providing immutable records of flight activity.
*   **Monetizable**: Enabling drone operators to generate revenue from their generated data.

Aerotraq introduces a practical solution using **AI-powered, blockchain-backed compliance**, **secure DGIP logs**, and **Story Protocol's IP Asset tokenization** to create a transparent, verifiable, and economically viable ecosystem for drone data.

## 📈 Future Enhancements

*   Implementing a modular compliance system to adapt to different regional regulations.
*   Developing a multi-user dashboard for comprehensive fleet monitoring and management.
*   Expanding on Tomo integration for advanced $WIP token management, including deeper SWAP and ONRAMP functionalities, and potentially direct royalty payments through Tomo's internal wallet services.
*   Exploring advanced IP Asset licensing models on Story Protocol for varied commercial use cases of DGIP data.
*   Integration with real-time drone telemetry for live flight tracking beyond simulation.

## 🧠 Team

*   Ridwan Oseni - Fullstack/AI Web developer
*   Ioana - Fullstack/AI Web developer

## 📜 License

MIT License – free to use, fork, and improve.

