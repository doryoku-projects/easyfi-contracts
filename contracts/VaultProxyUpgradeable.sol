// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./UserAccessControl.sol";

contract VaultProxyUpgradeable is UserAccessControl {

    bytes32 private constant MAIN_KEY = keccak256("MainToken");
    event UserWithdrawal(address user, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _userManager) public initializer {
        __UUPSUpgradeable_init();
        s_userManager = IUserManagerUpgradeable(_userManager);
    }

    function _authorizeUpgrade(address) internal override onlyMasterAdmin {}

    function withdrawFunds( address to, address maintoken, uint256 amount) external onlyVaultManager {
        require(IERC20(maintoken).balanceOf(address(this)) >= amount, "Insufficient balance");
        IERC20(maintoken).transfer(to, amount);
        emit UserWithdrawal(to, amount);
    }

}
