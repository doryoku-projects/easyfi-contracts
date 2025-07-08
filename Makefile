-include .env
# Makefile

# Define a default network, but allow overriding from the command line:
NETWORK = virtual

.PHONY: deploy UserManager ProtocolConfig Vault LiquidityManager OracleSwap LiquidityHelper Aggregator

# The deploy target calls other targets:
deploy: UserManager ProtocolConfig Vault LiquidityManager OracleSwap LiquidityHelper Aggregator 

ProtocolConfig: 
	@echo "Deploying ProtocolConfig contract..."
	-npx hardhat run ./launch/ProtocolConfig.js --network $(NETWORK)

UserManager:
	@echo "Deploying UserManager contract..."
	-npx hardhat run ./launch/UserManager.js --network $(NETWORK)

Vault:
	@echo "Deploying Vault contract..."
	-npx hardhat run ./launch/Vault.js --network $(NETWORK)

LiquidityManager:
	@echo "Deploying LiquidityManager contract..."
	-npx hardhat run ./launch/LiquidityManager.js --network $(NETWORK)

OracleSwap: 
	@echo "Deploying OracleSwap contract..."
	-npx hardhat run ./launch/OracleSwap.js --network $(NETWORK)

LiquidityHelper:
	@echo "Deploying LiquidityHelper contract..."
	-npx hardhat run ./launch/LiquidityHelper.js --network $(NETWORK)

Aggregator:
	@echo "Deploying Aggregator contract..."
	-npx hardhat run ./launch/Aggregator.js --network $(NETWORK)

# UPGRADE

upgrade_OracleSwap:
	@echo "Upgrading OracleSwap contract..."
	-npx hardhat run ./launch/upgrade/OracleSwap.js --network $(NETWORK)


# PARA LANZAR EN CMD DE WINDOWS TODOS LOS CONTRATOS DE UNA

# npx hardhat run .\launch\UserManager.js --network virtual & npx hardhat run .\launch\ProtocolConfig.js --network virtual & npx hardhat run .\launch\Vault.js --network virtual & npx hardhat run .\launch\LiquidityManager.js --network virtual & npx hardhat run .\launch\OracleSwap.js --network virtual & npx hardhat run .\launch\LiquidityHelper.js --network virtual & npx hardhat run .\launch\Aggregator.js --network virtual 