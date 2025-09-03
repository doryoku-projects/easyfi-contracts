// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Interface for the VaultManager contract, which manages liquidity positions in a DeFi protocol.
interface IVaultProxyUpgradeable {

        function withdrawFunds(address user, address mainToken, uint256 amount) external;

}