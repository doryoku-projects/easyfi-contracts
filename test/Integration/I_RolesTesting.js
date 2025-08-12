const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("I_RolesTesting — UserManagerUpgradeable roles", function () {
  let ownerWallet, generalAdminWallet, userManagerWallet, randomWallet;
  let UserManager;

  before(async () => {
    ownerWallet = new ethers.Wallet(
      process.env.MASTER_ADMIN_PRIVATE_KEY,
      ethers.provider
    );
    generalAdminWallet = new ethers.Wallet(
      process.env.GENERAL_ADMIN_PRIVATE_KEY,
      ethers.provider
    );
    userManagerWallet = new ethers.Wallet(
      process.env.USER_MANAGER_PRIVATE_KEY,
      ethers.provider
    );
    randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);

    UserManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      process.env.USER_MANAGER_ADDRESS,
      generalAdminWallet
    );
  });

  describe("MASTER_ADMIN_ROLE (bootstrapped to owner)", () => {
    it("owner starts as master admin", async () => {
      expect(await UserManager.connect(userManagerWallet).isMasterAdmin(ownerWallet.address)).to.be.true;
    });

    it("allows owner to add and remove other masters", async () => {
      const masterAdminKey = ethers.keccak256(ethers.toUtf8Bytes("MASTER_ADMIN_ROLE")); 
      
      const initialMasterAdmins = await UserManager.connect(userManagerWallet).getRoleMembers(
        masterAdminKey
      )

      console.log("Initial Master Admins:", initialMasterAdmins);
    
      await expect(
        UserManager.connect(ownerWallet).addMasterAdmins([
          generalAdminWallet.address,
        ])
      )
        .to.emit(UserManager, "MasterAdminAdded")
        .withArgs(generalAdminWallet.address);
      expect(await UserManager.connect(userManagerWallet).isMasterAdmin(generalAdminWallet.address)).to.be
        .true;

      await expect(
        UserManager.connect(generalAdminWallet).removeMasterAdmins([
          ownerWallet.address,
        ])
      )
        .to.emit(UserManager, "MasterAdminRemoved")
        .withArgs(ownerWallet.address);

      expect(await UserManager.connect(userManagerWallet).isMasterAdmin(ownerWallet.address)).to.be
      .false;

        const finalMasterAdmins = await UserManager.connect(userManagerWallet).getRoleMembers(
          masterAdminKey
        )
  
        console.log("Final Master Admins:", finalMasterAdmins);
    });
  });
});
//     it("reverts when non-master tries to add a master", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addMasterAdmins([
//           randomWallet.address,
//         ])
//       ).to.be.reverted;
//     });
//   });

//   describe("GENERAL_ADMIN_ROLE", () => {
//     it("owner can add and remove general admins", async () => {
//       await expect(UserManager.addGeneralAdmins([generalAdminWallet.address]))
//         .to.emit(UserManager, "GeneralAdminAdded")
//         .withArgs(generalAdminWallet.address);
//       expect(await UserManager.isGeneralAdmin(generalAdminWallet.address)).to.be
//         .true;

//       await expect(
//         UserManager.removeGeneralAdmins([generalAdminWallet.address])
//       )
//         .to.emit(UserManager, "GeneralAdminRemoved")
//         .withArgs(generalAdminWallet.address);
//       expect(await UserManager.isGeneralAdmin(generalAdminWallet.address)).to.be
//         .false;
//     });

//     it("reverts when non-general tries to add", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addGeneralAdmins([
//           randomWallet.address,
//         ])
//       ).to.be.reverted;
//     });
//   });

//   describe("LIQUIDITY_MANAGER_ROLE", () => {
//     before(async () => {
//       if (!(await UserManager.isGeneralAdmin(ownerWallet.address))) {
//         await UserManager.addGeneralAdmins([ownerWallet.address]);
//       }
//     });

//     it("allows general admin to add/remove liquidity managers", async () => {
//       await expect(
//         UserManager.connect(ownerWallet).addLiquidityManagers([
//           generalAdminWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "LiquidityManagerAdded")
//         .withArgs(generalAdminWallet.address);
//       expect(await UserManager.isLiquidityManager(generalAdminWallet.address))
//         .to.be.true;

//       await expect(
//         UserManager.connect(ownerWallet).removeLiquidityManagers([
//           generalAdminWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "LiquidityManagerRemoved")
//         .withArgs(generalAdminWallet.address);
//       expect(await UserManager.isLiquidityManager(generalAdminWallet.address))
//         .to.be.false;
//     });

//     it("reverts when non-general tries", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addLiquidityManagers([
//           randomWallet.address,
//         ])
//       ).to.be.reverted;
//     });
//   });

//   describe("VAULT_MANAGER_ROLE", () => {
//     it("allows general admin to add/remove vault managers", async () => {
//       await expect(
//         UserManager.connect(ownerWallet).addVaultManagers([
//           userManagerWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "VaultManagerAdded")
//         .withArgs(userManagerWallet.address);
//       expect(await UserManager.isVaultManager(userManagerWallet.address)).to.be
//         .true;

//       await expect(
//         UserManager.connect(ownerWallet).removeVaultManagers([
//           userManagerWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "VaultManagerRemoved")
//         .withArgs(userManagerWallet.address);
//       expect(await UserManager.isVaultManager(userManagerWallet.address)).to.be
//         .false;
//     });

//     it("reverts when non-general tries", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addVaultManagers([
//           randomWallet.address,
//         ])
//       ).to.be.reverted;
//     });
//   });

//   describe("USER_MANAGER_ROLE", () => {
//     it("allows master admin to add/remove user managers", async () => {
//       await expect(UserManager.addUsersManager([userManagerWallet.address]))
//         .to.emit(UserManager, "UserManagerAdded")
//         .withArgs(userManagerWallet.address);
//       expect(await UserManager.isUserManager(userManagerWallet.address)).to.be
//         .true;

//       await expect(UserManager.removeUsersManager([userManagerWallet.address]))
//         .to.emit(UserManager, "UserManagerRemoved")
//         .withArgs(userManagerWallet.address);
//       expect(await UserManager.isUserManager(userManagerWallet.address)).to.be
//         .false;
//     });

//     it("reverts when non-master tries", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addUsersManager([
//           randomWallet.address,
//         ])
//       ).to.be.reverted;
//     });
//   });

//   describe("USER_ROLE", () => {
//     before(async () => {
//       if (!(await UserManager.isUserManager(userManagerWallet.address))) {
//         await UserManager.addUsersManager([userManagerWallet.address]);
//       }
//     });

//     it("allows userManager to add/remove users", async () => {
//       await expect(
//         UserManager.connect(userManagerWallet).addUsers([randomWallet.address])
//       )
//         .to.emit(UserManager, "UserAdded")
//         .withArgs(randomWallet.address);
//       expect(await UserManager.isUser(randomWallet.address)).to.be.true;

//       await expect(
//         UserManager.connect(userManagerWallet).removeUsers([
//           randomWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "UserRemoved")
//         .withArgs(randomWallet.address);
//       expect(await UserManager.isUser(randomWallet.address)).to.be.false;
//     });

//     it("reverts when non-user-manager tries", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addUsers([randomWallet.address])
//       ).to.be.reverted;
//     });
//   });

//   describe("USER_2FA_ROLE", () => {
//     it("allows general admin to add/remove 2FA users", async () => {
//       await expect(
//         UserManager.connect(ownerWallet).addUser2FAs([
//           userManagerWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "User2FAAdded")
//         .withArgs(userManagerWallet.address);
//       expect(await UserManager.is2FA(userManagerWallet.address)).to.be.true;

//       await expect(
//         UserManager.connect(ownerWallet).removeUser2FAs([
//           userManagerWallet.address,
//         ])
//       )
//         .to.emit(UserManager, "User2FARemoved")
//         .withArgs(userManagerWallet.address);
//       expect(await UserManager.is2FA(userManagerWallet.address)).to.be.false;
//     });

//     it("reverts when non-general tries", async () => {
//       await expect(
//         UserManager.connect(randomWallet).addUser2FAs([randomWallet.address])
//       ).to.be.reverted;
//     });
//   });
// });
