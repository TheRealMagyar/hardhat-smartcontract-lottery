const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat.config");
const { assert, expect } = require("chai");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, vrfCoordinatorV2_5Mock, raffleEntranceFee, deployer, interval;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              raffle = await ethers.getContract("Raffle", deployer);
              vrfCoordinatorV2_5Mock = await ethers.getContract("VRFCoordinatorV2_5Mock", deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  //Ideally we make our test have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState();
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__SendMoreToEnterRaffle()"
                  );
              });
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  ); //elvárjuk hogy kibocsáltson egy eventet
              });
              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString()); // Convert to number

                  // Ellenőrizd, hogy az intervalInSeconds szám
                  if (isNaN(intervalInSeconds)) {
                      throw new Error("Interval is not a valid number");
                  }

                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]); //előre tekerjük az időt a blockchainen
                  await network.provider.send("evm_mine", []); // kibányászunk +1 extra blockot a blockchainen
                  // we pretend to be a chainlink keeper
                  await raffle.performUpkeep("0x"); //we need a fcking consumer at first
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__RaffleNotOpen");
              });
          });
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  const intervalInSeconds = Number(interval.toString()); // Convert to number
                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString()); // Convert to number

                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]); //előre tekerjük az időt a blockchainen
                  await network.provider.send("evm_mine", []); // kibányászunk +1 extra blockot a blockchainen
                  // we pretend to be a chainlink keeper
                  await raffle.performUpkeep("0x"); //we need a fcking consumer at first
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString()); // Convert to number

                  await network.provider.send("evm_increaseTime", [intervalInSeconds - 20]); //előre tekerjük az időt a blockchainen
                  await network.provider.send("evm_mine", []); // kibányászunk +1 extra blockot a blockchainen
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString()); // Convert to number

                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("it can only run if checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString());
                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await raffle.performUpkeep("0x"); //0x means nincs adat
                  assert(tx);
              });
              it("reverts when checkupkeep is false", async function () {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  );
              });
              it("updates the raffle state, emits and event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString());
                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]);
                  await network.provider.send("evm_mine", []);
                  // Perform the upkeep (calls performUpkeep function)
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.logs[1].args[0];

                  // Ellenőrizd a raffle állapotát
                  const raffleState = await raffle.getRaffleState();
                  assert(raffleState == 1);
                  assert(Number(requestId.toString()) > 0);
                  assert(raffleState.toString() == "1");
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const intervalInSeconds = Number(interval.toString());
                  await network.provider.send("evm_increaseTime", [intervalInSeconds + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2_5Mock.fulfillRandomWords(0, raffle.target)
                  ).to.be.revertedWithCustomError(vrfCoordinatorV2_5Mock, "InvalidRequest");
                  await expect(
                      vrfCoordinatorV2_5Mock.fulfillRandomWords(1, raffle.target)
                  ).to.be.revertedWithCustomError(vrfCoordinatorV2_5Mock, "InvalidRequest");
              });
              it("picks a winner, reset the lottery, and sends money", async function () {
                  const additionalEnters = 3;
                  const startingAccountIndex = 1; // deployer = 0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEnters;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimeStamp = await raffle.getLastTimeStamp();

                  // performUpkeep (mock being Chainlink keepers)
                  // fulfillRandomWords (mock being the Chainlink VRF)
                  // we will have to wait for the fulfillRandomWords to be called
                  await new Promise(async (resolve, reject) => {
                      //listen the winnerpicked event
                      raffle.once("WinnerPicked", async () => {
                          console.log("\tFound the event!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              console.log("\tRecent winner: " + recentWinner);
                              console.log("\tDeployer: " + accounts[0].address);
                              console.log("\tAccount1: " + accounts[1].address);
                              console.log("\tAccount2: " + accounts[2].address);
                              console.log("\tAccount3: " + accounts[3].address);
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLastTimeStamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[1].address
                              );
                              assert.equal(numPlayers.toString(), "0"); // players: 0
                              assert.equal(raffleState.toString(), "0"); // raffle: open
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  Number(winnerEndingBalance).toString(),
                                  (
                                      Number(winnerStartingBalance) +
                                      Number(raffleEntranceFee) * additionalEnters +
                                      Number(raffleEntranceFee)
                                  ).toString()
                              ); //the winner got the money
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });
                      //below, we will fire the event, and the listener will pick it up, and resolve
                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);
                      const winnerStartingBalance = await ethers.provider.getBalance(
                          accounts[1].address
                      );
                      await vrfCoordinatorV2_5Mock.fulfillRandomWords(
                          txReceipt.logs[1].args[0],
                          raffle.target
                      );
                  });
              });
          });
      });
