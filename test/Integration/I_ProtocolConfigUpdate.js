const { expect } = require("chai");
const { ethers } = require("hardhat");

// Se requiere que las direcciones de los contratos ya estén desplegadas y sean válidas.
// Durante el despliegue se le da al ProtocolConfig las direcciones de los contratos desplegados previamente.
// Se requiere que estos valores se actualicen en el archivo .env antes de ejecutar este test.
// Con este test lo que se hace es darle valores correctos a los mappings del s_config tras el despliegue de los contratos finales.

describe("ProtocolConfigUpgradeable", function () {
  let protocolConfig;
  let admin;

  const VAULT_MANAGER = process.env.VAULT_MANAGER_ADDRESS;
  const LIQ_MANAGER = process.env.LIQUIDITY_MANAGER_ADDRESS;
  const LIQ_HELPER = process.env.LIQUIDITY_HELPER_ADDRESS;
  const ORACLE_SWAP = process.env.ORACLE_SWAP_ADDRESS;
  const AGGREGATOR = process.env.AGGREGATOR_ADDRESS;
  const NFPM = process.env.UNISWAP_NFT_ADDRESS;
  const SWAP_ROUTER = process.env.SWAP_ROUTER_ADDRESS;
  const FACTORY = process.env.FACTORY_ADDRESS;
  const MAIN_TOKEN = process.env.MAIN_TOKEN_ADDRESS;

  before(async function () {
    [admin] = await ethers.getSigners();
    // Aquí se asume que el contrato ya está desplegado y se obtiene la instancia.
    // Si usas ethers.getContractAt, reemplaza "ProtocolConfigUpgradeable" y la dirección correspondiente.
    protocolConfig = await ethers.getContractAt(
      "ProtocolConfigUpgradeable",
      process.env.PROTOCOL_CONFIG_ADDRESS,
      admin
    );
  });

  it("Debería actualizar todas las direcciones y valores numéricos correctamente", async function () {
    const hashKey = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

    const addressKeys = [
      "VaultManager",
      "LiquidityManager",
      "LiquidityHelper",
      "OracleSwap",
      "Aggregator",
    ].map(hashKey);

    const addressValues = [
      VAULT_MANAGER,
      LIQ_MANAGER,
      LIQ_HELPER,
      ORACLE_SWAP,
      AGGREGATOR,
    ];

    // const uintKeys = ["BP", "CompanyFeePct"].map(hashKey);
    // const uintValues = [10000, 3000];

    // Actualización de direcciones
    for (let i = 0; i < addressKeys.length; i++) {
      const tx = await protocolConfig.setAddress(
        addressKeys[i],
        addressValues[i]
      );
      await tx.wait();
    }

    // // Actualización de uints: usa uintKeys[i]
    // for (let i = 0; i < uintKeys.length; i++) {
    //   const tx = await protocolConfig.setUint(uintKeys[i], uintValues[i]);
    //   await tx.wait();
    // }

    // (Opcional) Validación
    //   for (let i = 0; i < addressKeys.length; i++) {
    //     const stored = await protocolConfig.getAddress(addressKeys[i]);
    //     expect(stored).to.equal(addressValues[i]);
    //   }
    //   for (let i = 0; i < uintKeys.length; i++) {
    //     const stored = await protocolConfig.getUint(uintKeys[i]);
    //     expect(stored).to.equal(uintValues[i]);
    //   }
  });
});
