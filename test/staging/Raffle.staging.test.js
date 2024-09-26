const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat.config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, raffleEntranceFee, deployer;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              raffle = await ethers.getContract("Raffle", deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", async function () {
              it("works with live Chainlink keepers and Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  const starttingTimeStamp = await raffle.getLastTimestamp();
                  const accounts = await ethers.getSigners();

                  await new Promise(async (resolve, reject) => {
                      //setup listener before we enter the raffle
                      //Just in case the blockchain move REALLY FAST
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          resolve();
                      });
                      try {
                          //add our asserts here
                          const recentWinner = await raffle.getRecentWinner();
                          const raffleState = await raffle.getRaffleState();
                          const winnerEndingBalance = await ethers.provider.getBalance(
                              accounts[0].address
                          );
                          const endingTimeStamp = await raffle.getLastTimeStamp();

                          await expect(raffle.getPlayer(0)).to.be.reverted;
                          assert.equal(recentWinner.toString(), accounts[0].address);
                          assert.equal(raffleState, 0);
                          assert.equal(
                              Number(winnerEndingBalance).toString(),
                              (Number(winnerStartingBalance) + Number(raffleEntranceFee)).toString()
                          );
                          assert(endingTimeStamp > starttingTimeStamp);
                          resolve();
                      } catch (err) {
                          console.log(err);
                          reject(err);
                      }
                      //then entering the raffle
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      const winnerStartingBalance = await ethers.provider.getBalance(
                          accounts[0].address
                      );
                      //and this code WONT complete until our listener has finished listening!
                  });
              });
          });
      });
// 1. Get our SubId for chainlink VRF
// 2. Deploy our contract using subId
// 3. Register the contract with chainlink VRF & it's subId
// 4. Register the contract with chainlink keepers
// 5. Run staging tests
