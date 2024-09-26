require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();
require("solidity-coverage");
require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";
const METAMASK_PRIVATE_KEY = process.env.METAMASK_PRIVATE_KEY || "0x454...";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "key";

const REPORT_GAS = false;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [METAMASK_PRIVATE_KEY],
            chainId: 11155111,
            blockConfirmations: 1, // 6 block confirmationra kell várnunk a tranzakciók után, hogy az ether scannek lehetőséget adjunk indexelni a tranzakciót.
            gasPrice: undefined,
            gas: 500000,
        },
    },
    solidity: "0.8.19",
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 20000, //200s max
    },
};
