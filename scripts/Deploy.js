const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contract with the account:", deployer.address);

    console.log("Account balance: ", (await (await deployer.getBalance()).toString()));

    const Token = await ethers.getContractFactory("ETHPool");
    const token = await Token.deploy();

    console.log("Token address:", token.address);
}

main()
    .then(() => process.exit(0)
        .catch((error) => {
            console.log(error);
            process.exit(1);
        }));