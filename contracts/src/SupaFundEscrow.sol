// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TEEOracle} from "./TEEOracle.sol";

contract SupaFundEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum MilestoneStatus {
        Pending,
        Verified,
        Released,
        Disputed
    }

    struct Grant {
        address funder;
        address recipient;
        uint256 totalAmount;
        uint256 currentMilestone;
        bool active;
        address teeVerifier;
    }

    struct Milestone {
        uint256 amount;
        bytes32 requiredGitCommitPrefix;
        string demoVideoURL;
        string liveSiteURL;
        MilestoneStatus status;
        TEEOracle.MilestoneAttestation teeAttestation;
        uint256 completedAt;
    }

    IERC20 public immutable usdc;
    uint256 public grantCount;

    mapping(uint256 => Grant) public grants;
    mapping(uint256 => Milestone[]) public milestones;

    error ZeroMilestones();
    error MismatchedArrays();
    error GrantNotActive();
    error MilestoneNotPending();
    error MilestoneNotVerified();
    error MilestoneAlreadyReleased();
    error NotFunder();
    error AttestationNotVerified();
    error InvalidMilestoneIndex();

    event GrantCreated(uint256 indexed grantId, address indexed funder, address indexed recipient, uint256 totalAmount);
    event MilestoneVerified(uint256 indexed grantId, uint256 milestoneIndex);
    event MilestoneReleased(uint256 indexed grantId, uint256 milestoneIndex, uint256 amount);
    event MilestoneDisputed(uint256 indexed grantId, uint256 milestoneIndex);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function createGrant(
        address recipient,
        address teeVerifier,
        uint256[] calldata amounts,
        bytes32[] calldata gitCommitPrefixes
    ) external returns (uint256 grantId) {
        if (amounts.length == 0) revert ZeroMilestones();
        if (amounts.length != gitCommitPrefixes.length) revert MismatchedArrays();

        grantId = grantCount++;
        uint256 totalAmount;

        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
            milestones[grantId].push(
                Milestone({
                    amount: amounts[i],
                    requiredGitCommitPrefix: gitCommitPrefixes[i],
                    demoVideoURL: "",
                    liveSiteURL: "",
                    status: MilestoneStatus.Pending,
                    teeAttestation: TEEOracle.MilestoneAttestation(0, 0, bytes32(0), false, 0),
                    completedAt: 0
                })
            );
        }

        grants[grantId] = Grant({
            funder: msg.sender,
            recipient: recipient,
            totalAmount: totalAmount,
            currentMilestone: 0,
            active: true,
            teeVerifier: teeVerifier
        });

        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        emit GrantCreated(grantId, msg.sender, recipient, totalAmount);
    }

    function verifyMilestone(
        uint256 grantId,
        uint256 milestoneIndex,
        TEEOracle.MilestoneAttestation calldata attestation,
        bytes calldata signature
    ) external {
        Grant storage grant_ = grants[grantId];
        if (!grant_.active) revert GrantNotActive();
        if (milestoneIndex >= milestones[grantId].length) revert InvalidMilestoneIndex();

        Milestone storage milestone = milestones[grantId][milestoneIndex];
        if (milestone.status != MilestoneStatus.Pending) revert MilestoneNotPending();
        if (!attestation.verified) revert AttestationNotVerified();

        TEEOracle(grant_.teeVerifier).verifyAttestation(attestation, signature);

        milestone.status = MilestoneStatus.Verified;
        milestone.teeAttestation = attestation;
        milestone.completedAt = block.timestamp;

        emit MilestoneVerified(grantId, milestoneIndex);
    }

    function releaseMilestone(uint256 grantId, uint256 milestoneIndex) external nonReentrant {
        Grant storage grant_ = grants[grantId];
        if (!grant_.active) revert GrantNotActive();
        if (milestoneIndex >= milestones[grantId].length) revert InvalidMilestoneIndex();

        Milestone storage milestone = milestones[grantId][milestoneIndex];
        if (milestone.status != MilestoneStatus.Verified) revert MilestoneNotVerified();

        milestone.status = MilestoneStatus.Released;

        usdc.safeTransfer(grant_.recipient, milestone.amount);

        emit MilestoneReleased(grantId, milestoneIndex, milestone.amount);

        // Check if all milestones are released
        bool allReleased = true;
        for (uint256 i = 0; i < milestones[grantId].length; i++) {
            if (milestones[grantId][i].status != MilestoneStatus.Released) {
                allReleased = false;
                break;
            }
        }
        if (allReleased) {
            grant_.active = false;
        }
    }

    function disputeMilestone(uint256 grantId, uint256 milestoneIndex) external {
        Grant storage grant_ = grants[grantId];
        if (msg.sender != grant_.funder) revert NotFunder();
        if (!grant_.active) revert GrantNotActive();
        if (milestoneIndex >= milestones[grantId].length) revert InvalidMilestoneIndex();

        Milestone storage milestone = milestones[grantId][milestoneIndex];
        if (milestone.status == MilestoneStatus.Released) revert MilestoneAlreadyReleased();

        milestone.status = MilestoneStatus.Disputed;

        emit MilestoneDisputed(grantId, milestoneIndex);
    }

    function getMilestones(uint256 grantId) external view returns (Milestone[] memory) {
        return milestones[grantId];
    }

    function getMilestoneCount(uint256 grantId) external view returns (uint256) {
        return milestones[grantId].length;
    }
}
