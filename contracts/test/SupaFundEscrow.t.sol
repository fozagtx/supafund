// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {TEEOracle} from "../src/TEEOracle.sol";
import {SupaFundEscrow} from "../src/SupaFundEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SupaFundEscrowTest is Test {
    TEEOracle public oracle;
    SupaFundEscrow public escrow;
    IERC20 public usdc;

    // Base Sepolia USDC
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    uint256 teePk = 0xBEEF;
    address teeSigner;

    address funder = makeAddr("funder");
    address recipient = makeAddr("recipient");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.createSelectFork("https://sepolia.base.org");

        teeSigner = vm.addr(teePk);

        oracle = new TEEOracle();
        oracle.registerSigner(teeSigner);

        usdc = IERC20(USDC_BASE_SEPOLIA);
        escrow = new SupaFundEscrow(address(usdc));

        // Give funder USDC via deal cheatcode
        deal(address(usdc), funder, 10_000e6);
    }

    // ── Helpers ──────────────────────────────────────────────

    function _signAttestation(
        TEEOracle.MilestoneAttestation memory att
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                oracle.ATTESTATION_TYPEHASH(),
                att.grantId,
                att.milestoneIndex,
                att.gitCommitHash,
                att.verified,
                att.timestamp
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", oracle.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _createDefaultGrant() internal returns (uint256) {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 500e6;
        amounts[1] = 500e6;

        bytes32[] memory prefixes = new bytes32[](2);
        prefixes[0] = bytes32("commit1");
        prefixes[1] = bytes32("commit2");

        vm.startPrank(funder);
        usdc.approve(address(escrow), 1000e6);
        uint256 grantId = escrow.createGrant(recipient, address(oracle), amounts, prefixes);
        vm.stopPrank();

        return grantId;
    }

    function _defaultAttestation(uint256 grantId, uint256 milestoneIndex)
        internal
        view
        returns (TEEOracle.MilestoneAttestation memory)
    {
        return TEEOracle.MilestoneAttestation({
            grantId: grantId,
            milestoneIndex: milestoneIndex,
            gitCommitHash: bytes32("commit1"),
            verified: true,
            timestamp: block.timestamp
        });
    }

    // ── createGrant tests ───────────────────────────────────

    function test_createGrant_success() public {
        uint256 balBefore = usdc.balanceOf(funder);

        uint256 grantId = _createDefaultGrant();

        (address f, address r, uint256 total, uint256 cur, bool active, address tee) = escrow.grants(grantId);
        assertEq(f, funder);
        assertEq(r, recipient);
        assertEq(total, 1000e6);
        assertEq(cur, 0);
        assertTrue(active);
        assertEq(tee, address(oracle));
        assertEq(usdc.balanceOf(address(escrow)), 1000e6);
        assertEq(usdc.balanceOf(funder), balBefore - 1000e6);
        assertEq(escrow.getMilestoneCount(grantId), 2);
    }

    function test_createGrant_zeroMilestones_reverts() public {
        uint256[] memory amounts = new uint256[](0);
        bytes32[] memory prefixes = new bytes32[](0);

        vm.prank(funder);
        vm.expectRevert(SupaFundEscrow.ZeroMilestones.selector);
        escrow.createGrant(recipient, address(oracle), amounts, prefixes);
    }

    function test_createGrant_mismatchedArrays_reverts() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 500e6;
        amounts[1] = 500e6;
        bytes32[] memory prefixes = new bytes32[](1);
        prefixes[0] = bytes32("commit1");

        vm.prank(funder);
        vm.expectRevert(SupaFundEscrow.MismatchedArrays.selector);
        escrow.createGrant(recipient, address(oracle), amounts, prefixes);
    }

    // ── verifyMilestone tests ───────────────────────────────

    function test_verifyMilestone_success() public {
        uint256 grantId = _createDefaultGrant();
        TEEOracle.MilestoneAttestation memory att = _defaultAttestation(grantId, 0);
        bytes memory sig = _signAttestation(att);

        escrow.verifyMilestone(grantId, 0, att, sig);

        SupaFundEscrow.Milestone[] memory ms = escrow.getMilestones(grantId);
        assertEq(uint8(ms[0].status), uint8(SupaFundEscrow.MilestoneStatus.Verified));
    }

    function test_verifyMilestone_invalidSignature_reverts() public {
        uint256 grantId = _createDefaultGrant();
        TEEOracle.MilestoneAttestation memory att = _defaultAttestation(grantId, 0);

        // Sign with wrong key
        uint256 wrongPk = 0xDEAD;
        bytes32 structHash = keccak256(
            abi.encode(
                oracle.ATTESTATION_TYPEHASH(),
                att.grantId,
                att.milestoneIndex,
                att.gitCommitHash,
                att.verified,
                att.timestamp
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", oracle.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(TEEOracle.SignerNotRegistered.selector);
        escrow.verifyMilestone(grantId, 0, att, badSig);
    }

    function test_verifyMilestone_alreadyVerified_reverts() public {
        uint256 grantId = _createDefaultGrant();
        TEEOracle.MilestoneAttestation memory att = _defaultAttestation(grantId, 0);
        bytes memory sig = _signAttestation(att);

        escrow.verifyMilestone(grantId, 0, att, sig);

        vm.expectRevert(SupaFundEscrow.MilestoneNotPending.selector);
        escrow.verifyMilestone(grantId, 0, att, sig);
    }

    // ── releaseMilestone tests ──────────────────────────────

    function test_releaseMilestone_success() public {
        uint256 grantId = _createDefaultGrant();
        TEEOracle.MilestoneAttestation memory att = _defaultAttestation(grantId, 0);
        bytes memory sig = _signAttestation(att);

        escrow.verifyMilestone(grantId, 0, att, sig);

        uint256 balBefore = usdc.balanceOf(recipient);
        escrow.releaseMilestone(grantId, 0);

        assertEq(usdc.balanceOf(recipient), balBefore + 500e6);
        SupaFundEscrow.Milestone[] memory ms = escrow.getMilestones(grantId);
        assertEq(uint8(ms[0].status), uint8(SupaFundEscrow.MilestoneStatus.Released));
    }

    function test_releaseMilestone_notVerified_reverts() public {
        uint256 grantId = _createDefaultGrant();

        vm.expectRevert(SupaFundEscrow.MilestoneNotVerified.selector);
        escrow.releaseMilestone(grantId, 0);
    }

    function test_releaseMilestone_allReleased_deactivatesGrant() public {
        uint256 grantId = _createDefaultGrant();

        // Verify and release milestone 0
        TEEOracle.MilestoneAttestation memory att0 = _defaultAttestation(grantId, 0);
        bytes memory sig0 = _signAttestation(att0);
        escrow.verifyMilestone(grantId, 0, att0, sig0);
        escrow.releaseMilestone(grantId, 0);

        // Verify and release milestone 1
        TEEOracle.MilestoneAttestation memory att1 = _defaultAttestation(grantId, 1);
        att1.gitCommitHash = bytes32("commit2");
        bytes memory sig1 = _signAttestation(att1);
        escrow.verifyMilestone(grantId, 1, att1, sig1);
        escrow.releaseMilestone(grantId, 1);

        (, , , , bool active, ) = escrow.grants(grantId);
        assertFalse(active);
    }

    // ── disputeMilestone tests ──────────────────────────────

    function test_disputeMilestone_success() public {
        uint256 grantId = _createDefaultGrant();

        vm.prank(funder);
        escrow.disputeMilestone(grantId, 0);

        SupaFundEscrow.Milestone[] memory ms = escrow.getMilestones(grantId);
        assertEq(uint8(ms[0].status), uint8(SupaFundEscrow.MilestoneStatus.Disputed));
    }

    function test_disputeMilestone_notFunder_reverts() public {
        uint256 grantId = _createDefaultGrant();

        vm.prank(stranger);
        vm.expectRevert(SupaFundEscrow.NotFunder.selector);
        escrow.disputeMilestone(grantId, 0);
    }

    function test_disputeMilestone_alreadyReleased_reverts() public {
        uint256 grantId = _createDefaultGrant();
        TEEOracle.MilestoneAttestation memory att = _defaultAttestation(grantId, 0);
        bytes memory sig = _signAttestation(att);

        escrow.verifyMilestone(grantId, 0, att, sig);
        escrow.releaseMilestone(grantId, 0);

        vm.prank(funder);
        vm.expectRevert(SupaFundEscrow.MilestoneAlreadyReleased.selector);
        escrow.disputeMilestone(grantId, 0);
    }
}
