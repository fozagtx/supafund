// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TEEOracle is EIP712("SupaFund", "1"), Ownable(msg.sender) {
    struct MilestoneAttestation {
        uint256 grantId;
        uint256 milestoneIndex;
        bytes32 gitCommitHash;
        bool verified;
        uint256 timestamp;
    }

    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "MilestoneAttestation(uint256 grantId,uint256 milestoneIndex,bytes32 gitCommitHash,bool verified,uint256 timestamp)"
    );

    mapping(address => bool) public registeredSigners;

    error SignerNotRegistered();
    error InvalidSignature();

    event SignerRegistered(address indexed signer);
    event SignerRevoked(address indexed signer);

    function registerSigner(address signer) external onlyOwner {
        registeredSigners[signer] = true;
        emit SignerRegistered(signer);
    }

    function revokeSigner(address signer) external onlyOwner {
        registeredSigners[signer] = false;
        emit SignerRevoked(signer);
    }

    function verifyAttestation(
        MilestoneAttestation calldata attestation,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                attestation.grantId,
                attestation.milestoneIndex,
                attestation.gitCommitHash,
                attestation.verified,
                attestation.timestamp
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);

        if (!registeredSigners[recovered]) revert SignerNotRegistered();

        return true;
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
