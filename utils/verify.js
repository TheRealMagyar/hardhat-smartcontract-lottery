const { run, network } = require("hardhat");

async function verify(contractAddress, args) {
    console.log("Verifying contract...");
    try {
        await run("verify:sourcify", {
            //valamiért etherscan api nem jó (sepolia test neten), de sourcify működik.
            address: contractAddress, //szerződés címe
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
}

module.exports = {
    verify,
};
