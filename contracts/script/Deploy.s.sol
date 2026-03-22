// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TEEOracle} from "../src/TEEOracle.sol";
import {SupaFundEscrow} from "../src/SupaFundEscrow.sol";

contract Deploy is Script {
    // Base Sepolia USDC
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address teeSigner = vm.envAddress("TEE_SIGNER");

        vm.startBroadcast(deployerPk);

        TEEOracle oracle = new TEEOracle();
        console2.log("TEEOracle deployed at:", address(oracle));

        oracle.registerSigner(teeSigner);
        console2.log("TEE signer registered:", teeSigner);

        SupaFundEscrow escrow = new SupaFundEscrow(USDC_BASE_SEPOLIA);
        console2.log("SupaFundEscrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }
}
