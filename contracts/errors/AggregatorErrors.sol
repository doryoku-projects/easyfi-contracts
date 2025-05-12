// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

abstract contract AggregatorErrors {
    /**
     * @notice _vaultManagerAddress or _userManagerAddress was zero
     */
    error AGG_ZERO_ADDRESS();
    /**
     * @notice new address equals current
     */
    error AGG_ADDRESS_UNCHANGED();
    /**
     * @notice amountMainTokenDesired == 0
     */
    error AGG_ZERO_AMOUNT();
    /**
     * @notice transferFrom(msg.sender, …) failed
     */
    error AGG_TRANSFER_FAILED();
    /**
     * @notice approve(...) failed
     */
    error AGG_APPROVE_FAILED();
    /**
     * @notice percentageToRemove == 0
     */
    error AGG_ZERO_PERCENTAGE();
    /**
     * @notice percentageToRemove > 10000
     */
    error AGG_PERCENTAGE_TOO_HIGH();
    /**
     * @notice tickLower >= tickUpper
     */
    error AGG_INVALID_TICK_RANGE();
}
