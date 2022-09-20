// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

// Summary
// ETHPool provides a service where people can deposit ETH and they will receive weekly rewards.
// Users must be able to take out their deposits along with their portion of rewards at any time.
// As well, users can add additional deposits at any time.
// New rewards are deposited manually into the pool by the ETHPool team each week using a contract function.

// Requirements
// Only the team can deposit rewards.
// Deposited rewards go to the users proportional to the amount of ETH each user has at the time the team deposits rewards.
// Users should be able to withdraw at any time their deposits along with their share of rewards accrued so far.
// Example:

// Let say we have user A and B and team T.

// A deposits 100, and B deposits 300 for a total of 400 in the pool.
// Now A has 25% of the pool and B has 75%.
// When T deposits 200 rewards, A should be able to withdraw 150 and B 450.
//  What if the following happens? A deposits then T deposits then B deposits then A withdraws and finally B withdraws.
//  A should get their deposit + all the rewards.
// B should only get their deposit because rewards were sent to the pool before they participated.

// https://uploads-ssl.webflow.com/5ad71ffeb79acc67c8bcdaba/5ad8d1193a40977462982470_scalable-reward-distribution-paper.pdf

error Unauthorized();

contract ETHPool is ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    // total amount deposited by users
    uint256 public totalDeposited;

    // total deposited rewards by the team
    uint256 public totalDepositedRewards;
    uint256 public rewardPerDeposit;

    // User address => deposited amount
    mapping(address => uint256) public deposits;

    // User blocktime => rewards to be claimed
    mapping(address => uint256) public rewards;

    constructor() {
        totalDepositedRewards = 0;
        totalDeposited = 0;
        rewardPerDeposit = 0;
    }

    // User deposit
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "amount must be > 0");
        deposits[msg.sender] = deposits[msg.sender].add(msg.value);
        rewards[msg.sender] = rewardPerDeposit;
        totalDeposited = totalDeposited.add(msg.value);
        emit Deposited(msg.sender, msg.value);
    }

    // team reward deposit
    function depositReward() external payable onlyOwner {
        require(msg.value > 0, "amount must be > 0");
        totalDepositedRewards = totalDepositedRewards.add(msg.value);
        // multiply by 100 to avoid decimals
        if (totalDeposited > 0) {
            rewardPerDeposit = (rewardPerDeposit * 100).add(
                ((msg.value * 100).div(totalDeposited))
            );
        } else {
            revert();
        }
        emit RewardDeposit(msg.value);
    }

    // user withdraw
    function withdraw() external nonReentrant returns (uint256) {
        require(deposits[msg.sender] > 0, "Not enough balance");
        uint256 balance = deposits[msg.sender];
        // divide by 100 to adjust the decimal in the depositReward function
        uint256 reward = balance
            .mul((rewardPerDeposit.sub(rewards[msg.sender])))
            .div(100);
        totalDeposited = totalDeposited.sub(balance);
        uint256 totalAmount = balance.add(reward);
        (bool success, ) = msg.sender.call{value: totalAmount}("");
        deposits[msg.sender] = 0;
        totalDepositedRewards = totalDepositedRewards.sub(reward);
        require(success, "Failed to send the funds");

        emit Withdrawn(msg.sender, totalAmount);
        return totalAmount;
    }

    //  function will be invoked if msg contains no matching calldata
    fallback() external payable {
        deposits[msg.sender] = deposits[msg.sender].add(msg.value);
    }

    receive() external payable {}

    // Events
    event Deposited(address indexed user, uint256 amount);
    event RewardDeposit(uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
}
