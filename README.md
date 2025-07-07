

# Maitrix Auto Task Bot

## Overview

The **Maitrix Auto Task Bot** is a fully automated Node.js script designed to interact with a set of smart contracts on the blockchain for tasks such as claiming tokens from faucets, minting, and staking various tokens. This bot helps users streamline their daily token operations by managing repetitive on-chain actions in a reliable and efficient manner.

## Features

- **Multi-token Faucet Claims:** Automatically claim tokens from several faucets.
- **Automated Minting:** Supports minting of tokens based on your wallet balances.
- **One-Click Staking:** Easily stake eligible tokens after minting.
- **Customizable Tokens & Contracts:** All token and contract addresses are easily configurable.
- **Clear Console Feedback:** Uses colored CLI output for a user-friendly, informative experience.
- **Fully Automated Cycles:** The bot repeats all operations every 24 hours.

## Requirements

- Node.js v16 or later
- NPM

## Installation

1. **Clone the repository:**
    ```bash
    https://github.com/qlwino/MAITRIX-BOT.git
    cd MAITRIX-BOT
    ```

2. **Install dependencies:**
    ```bash
    npm install
    ```

3. **Prepare your `.env` file:**
    Create a `.env` file in the project root with the following:
    ```
    PRIVATE_KEY=YOUR_PRIVATE_KEY
    ```
    - Replace `YOUR_PRIVATE_KEY` with your wallet’s private key.

> **Warning:** *Never share your private key. Use a separate wallet for bots or testing purposes.*

## Usage

To start the bot, run:
```bash
node main.js
````

The bot will print status messages in your console and will run its tasks every 24 hours automatically.

## Customization

* You can add, remove, or update faucet URLs, token addresses, or contract ABIs directly in the `main.js` script to support additional tokens or networks.

## Disclaimer

* This bot is provided **as is**, without warranty of any kind.
* Use at your own risk, especially when operating with real assets.
* Ensure you understand the smart contracts you interact with.

## License

MIT License

---

**Happy automating!**
