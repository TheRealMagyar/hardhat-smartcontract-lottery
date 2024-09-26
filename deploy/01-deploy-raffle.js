const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat.config");
const { verify } = require("../helper-hardhat.config");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2_5Address;
    let subscriptionId = null;
    let vrfCoordinatorV2_5Mock;

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2_5Mock = await ethers.getContract("VRFCoordinatorV2_5Mock");

        vrfCoordinatorV2_5Address = vrfCoordinatorV2_5Mock.target;
        console.log("vrfCoordinatorV2_5Address: " + vrfCoordinatorV2_5Address);

        const transactionResponse = await vrfCoordinatorV2_5Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);

        const subscriptionCreatedEvent = transactionReceipt.logs.find(
            (log) => log.fragment.name === "SubscriptionCreated"
        );

        if (subscriptionCreatedEvent) {
            subscriptionId = subscriptionCreatedEvent.args[0]; // subId kinyerése
        } else {
            console.error("The SubscriptionCreated event is not exist!");
            subscriptionId = 0;
        }
        //Fund the subscriptionya
        //Usually, you'd the link token on a real network

        await vrfCoordinatorV2_5Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
        console.log("Subscription created");
    } else {
        vrfCoordinatorV2_5Address = networkConfig[chainId]["vrfCoordinatorV2_5"];
        subscriptionId = networkConfig[chainId]["subscriptionId"].toString();
    }

    const entranceFee = networkConfig[chainId]["entranceFee"].toString();
    const gasLane = networkConfig[chainId]["gasLane"].toString();
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"].toString();
    const interval = networkConfig[chainId]["interval"].toString();

    console.log("Chain ID:", chainId);
    console.log("Network Name:", network.name);
    console.log("Entrance Fee:", entranceFee);
    console.log("Gas Lanee:", gasLane);
    console.log("Callback Gas Limit:", callbackGasLimit);
    console.log("Interval:", interval);
    console.log("SubscriptionId:", subscriptionId);
    console.log("Type of vrfCoordinatorV2_5Address:", typeof vrfCoordinatorV2_5Address);
    console.log("Type of entranceFee:", typeof entranceFee);
    console.log("Type of gasLane:", typeof gasLane);
    console.log("Type of subscriptionId:", typeof subscriptionId);
    console.log("Type of callbackGasLimit:", typeof callbackGasLimit);
    console.log("Type of interval:", typeof interval);

    const args = [
        subscriptionId,
        gasLane,
        interval,
        entranceFee,
        callbackGasLimit,
        vrfCoordinatorV2_5Address,
    ];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    if (developmentChains.includes(network.name)) {
        await network.provider.send("evm_mine", []);
        const raffle_xd = await ethers.getContract("Raffle");
        // Add the Raffle contract as a consumer to the subscription
        await vrfCoordinatorV2_5Mock.addConsumer(subscriptionId, raffle_xd.target);
        console.log(`Consumer ${raffle_xd.target} added to subscription ${subscriptionId}`);
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...");
        await verify(raffle.target, args);
    }
    log("--------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
