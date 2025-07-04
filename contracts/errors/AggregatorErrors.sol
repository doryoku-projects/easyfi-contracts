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
     * @notice _maxMigrationSize == 0
     */
    error AGG_ZERO_MAX_MIGRATION_SIZE();
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
    /**
     * @notice This error is reverted when the maximum size of an array is exceeded.
     * @param arrayName The name of the array that exceeded the size limit.
     * @param size The size of the array that exceeded the limit.
     */
    error AGG_ARRAY_SIZE_LIMIT_EXCEEDED(string arrayName, uint256 size);
}
