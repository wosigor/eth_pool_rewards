const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Contract", function () {

    async function deployTokenFixture() {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("ETHPool", owner);

        const hardhatToken = await Token.deploy();

        await hardhatToken.deployed();
        return { Token, hardhatToken, owner, addr1, addr2 };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {

            const { hardhatToken, owner } = await loadFixture(deployTokenFixture);

            expect(await hardhatToken.owner()).to.equal(owner.address);
        });

        it("Should set totalDeposited to zero", async function () {
            const { hardhatToken, owner } = await loadFixture(deployTokenFixture);
            const totalDeposited = await hardhatToken.totalDeposited();
            expect(await hardhatToken.totalDeposited()).to.equal(0);
        });

        it("Should set totalDepositedRewards to zero", async function () {
            const { hardhatToken, owner } = await loadFixture(deployTokenFixture);
            const totalDepositedRewards = await hardhatToken.totalDepositedRewards();
            expect(await hardhatToken.totalDepositedRewards()).to.equal(0);
        });

        it("Should set rewardPerDeposit to zero", async function () {
            const { hardhatToken, owner } = await loadFixture(deployTokenFixture);
            const rewardPerDeposit = await hardhatToken.rewardPerDeposit();
            expect(await hardhatToken.rewardPerDeposit()).to.equal(0);
        });
    });

    describe("Deposits", function () {
        it("Should add balance to the user after deposit", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );
            await hardhatToken.connect(addr1).deposit({ value: 100 });
            expect(
                await hardhatToken.deposits(addr1.address)
            ).to.equal(100);

            expect(await hardhatToken.totalDeposited()).to.equal(100);

            await hardhatToken.connect(addr2).deposit({ value: 100 });
            expect(
                await hardhatToken.deposits(addr2.address)
            ).to.equal(100);

            expect(await hardhatToken.totalDeposited()).to.equal(100 + 100);
        });

        it("Should set rewards to the user after deposit", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );
            await hardhatToken.connect(addr1).deposit({ value: 100 });
            expect(
                await hardhatToken.deposits(addr1.address)
            ).to.equal(100);

            expect(await hardhatToken.rewards(addr1.address)).to.equal(0);
        });

        it("should emit Deposited events", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );

            await expect(hardhatToken.connect(addr1).deposit({ value: 100 }))
                .to.emit(hardhatToken, "Deposited")
                .withArgs(addr1.address, 100);
        });
    });

    describe("Deposit Reward", function () {
        it("should add correctly totalDepositedRewards", async function () {
            const { hardhatToken, owner, addr1 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });

            await hardhatToken.depositReward({ value: 100 });
            expect(
                (await hardhatToken.totalDepositedRewards())
            ).to.equal(100);
        });

        it("should calculate correct rewardPerDeposit", async function () {
            const { hardhatToken, owner, addr1 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });
            await hardhatToken.depositReward({ value: 100 });
            expect(await hardhatToken.rewardPerDeposit()).to.equal(100);
        });

        it("should fail with Unauthorized if called by not the owner", async function () {
            const { hardhatToken, owner, addr1 } = await loadFixture(
                deployTokenFixture
            );

            await expect(
                hardhatToken.connect(addr1).depositReward({ value: 100 })
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should update rewards balance after withdrawal", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });
            hardhatToken.connect(addr1).depositReward({ value: 100 })

            await hardhatToken.connect(addr1).withdraw();
            expect(
                await hardhatToken.deposits(addr1.address)
            ).to.equal(0);
            expect(
                await hardhatToken.totalDeposited()
            ).to.equal(0);

            expect(
                await hardhatToken.totalDepositedRewards()
            ).to.equal(0);
        });
    });

    describe("Withdraw", function () {

        it("should deduct amount from user balance", async function () {
            const { hardhatToken, owner, addr1 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });
            expect(
                (await hardhatToken.deposits(addr1.address))
            ).to.equal(100);

            await hardhatToken.connect(addr1).withdraw();
            expect(
                await hardhatToken.deposits(addr1.address)
            ).to.equal(0);
            expect(
                await hardhatToken.totalDeposited()
            ).to.equal(0);
        });

        it("should emit Withdraw events", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });

            const userBalance = await hardhatToken.deposits(addr1.address);
            await expect(hardhatToken.connect(addr1).withdraw())
                .to.emit(hardhatToken, "Withdrawn")
                .withArgs(addr1.address, userBalance);
        });

        it("should fail if not enough balance", async function () {
            const { hardhatToken, owner, addr1 } = await loadFixture(
                deployTokenFixture
            );

            await expect(
                hardhatToken.connect(addr1).withdraw()
            ).to.be.revertedWith("Not enough balance");
        });
    });

    describe("Rewards calculations", function () {

        it("should calculate correct reward", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });
            await hardhatToken.connect(addr2).deposit({ value: 300 });
            expect(
                await hardhatToken.totalDeposited()
            ).to.equal(400);
            await hardhatToken.depositReward({ value: 200 });
            expect(
                await hardhatToken.totalDepositedRewards()
            ).to.equal(200);
            expect(
                await hardhatToken.rewardPerDeposit()
            ).to.equal(50);
            await expect(hardhatToken.connect(addr1).withdraw())
                .to.emit(hardhatToken, "Withdrawn")
                .withArgs(addr1.address, 150);

            await expect(hardhatToken.connect(addr2).withdraw())
                .to.emit(hardhatToken, "Withdrawn")
                .withArgs(addr2.address, 450);
        });

        it("should not reward depositer who deposited after team added rewards", async function () {
            const { hardhatToken, owner, addr1, addr2 } = await loadFixture(
                deployTokenFixture
            );

            await hardhatToken.connect(addr1).deposit({ value: 100 });
            await hardhatToken.depositReward({ value: 200 });
            await hardhatToken.connect(addr2).deposit({ value: 300 });
            expect(
                await hardhatToken.totalDeposited()
            ).to.equal(400);

            expect(
                await hardhatToken.totalDepositedRewards()
            ).to.equal(200);

            expect(
                await hardhatToken.rewardPerDeposit()
            ).to.equal(200);
            await expect(hardhatToken.connect(addr1).withdraw())
                .to.emit(hardhatToken, "Withdrawn")
                .withArgs(addr1.address, 300);

            await expect(hardhatToken.connect(addr2).withdraw())
                .to.emit(hardhatToken, "Withdrawn")
                .withArgs(addr2.address, 300);

            expect(
                await hardhatToken.deposits(addr1.address)
            ).to.equal(0);

            expect(
                await hardhatToken.deposits(addr2.address)
            ).to.equal(0);
        });
    });
});