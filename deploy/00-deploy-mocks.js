const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat.config");

const BASE_FEE = ethers.parseEther("0.25"); // 0.25 is the premium. it costs 0.25 link per request.
const GAS_PRICE_LINK = 1e9; // link / gas calculated value based on the gas price of the chain.

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const weiPerUnitLink = ethers.parseUnits("0.01", "ether"); //1 link mennyi ether
    const args = [BASE_FEE, GAS_PRICE_LINK, weiPerUnitLink];

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        // deploy a mock verfcoordinator...
        const tx = await deploy("VRFCoordinatorV2_5Mock", {
            from: deployer,
            log: true,
            args: args,
        });
        log("Mocks Deployed!");
        log("--------------------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
