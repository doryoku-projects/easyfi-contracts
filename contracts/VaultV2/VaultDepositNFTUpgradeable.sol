// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../UserAccessControl.sol";
import "../errors/VaultDepositNFTErrors.sol";

/**
 * @title VaultDepositNFT
 * @notice ERC721 token representing deposits in the TokenVault
 * @dev Each deposit gets a unique NFT with depositId as tokenId
 */
contract VaultDepositNFTUpgradeable is 
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    UserAccessControl,
    VaultDepositNFTErrors
{
    // Base URI for token metadata
    string private s_baseTokenURI;
    
    // Only the vault can mint/burn
    address private s_vaultAddress;
    
    // Mapping from tokenId to deposit metadata
    struct DepositMetadata {
        address token;
        uint256 yieldId;
        uint256 netPrincipal;
        uint256 depositTimestamp;
        uint256 unlockTimestamp;
        bool exists;
    }
    
    mapping(uint256 => DepositMetadata) private s_depositMetadata;
    uint256[50] private __gap;
    
    event BaseURIUpdated();
    event VaultAddressUpdated(address indexed newVault);
    event DepositNFTMinted(uint256 indexed tokenId, address indexed to);
    event DepositNFTBurned(uint256 indexed tokenId);
    
    modifier onlyVault() {
        if (msg.sender != s_vaultAddress) revert NFT_ONLY_VAULT();
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the NFT contract
     * @param name_ Name of the NFT collection
     * @param symbol_ Symbol of the NFT collection
     * @param baseURI_ Base URI for token metadata
     * @param vaultAddress_ Address of the TokenVault contract
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address vaultAddress_
    ) public initializer {
        if (vaultAddress_ == address(0)) revert NFT_ZERO_ADDRESS();
        
        __ERC721_init(name_, symbol_);
        __UUPSUpgradeable_init();
        
        s_baseTokenURI = baseURI_;
        s_vaultAddress = vaultAddress_;
    }
    
    function _authorizeUpgrade(address) internal override onlyMasterAdmin {}
    
    /**
     * @notice Mint a new deposit NFT
     * @param to Address to mint the NFT to
     * @param tokenId Token ID (same as depositId)
     * @param token Address of the deposited token
     * @param yieldId Yield plan ID
     * @param netPrincipal Net principal amount
     * @param depositTimestamp Timestamp of deposit
     * @param unlockTimestamp Unlock timestamp
     */
    function mint(
        address to,
        uint256 tokenId,
        address token,
        uint256 yieldId,
        uint256 netPrincipal,
        uint256 depositTimestamp,
        uint256 unlockTimestamp
    ) external onlyVault {
        _mint(to, tokenId);
        
        s_depositMetadata[tokenId] = DepositMetadata({
            token: token,
            yieldId: yieldId,
            netPrincipal: netPrincipal,
            depositTimestamp: depositTimestamp,
            unlockTimestamp: unlockTimestamp,
            exists: true
        });
        
        emit DepositNFTMinted(tokenId, to);
    }
    
    /**
     * @notice Burn a deposit NFT after withdrawal
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external onlyVault {
        _burn(tokenId);
        delete s_depositMetadata[tokenId];
        
        emit DepositNFTBurned(tokenId);
    }
    
    /**
     * @notice Update the base URI for metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string memory newBaseURI) external onlyMasterAdmin {
        s_baseTokenURI = newBaseURI;
        emit BaseURIUpdated();
    }
    
    /**
     * @notice Update the vault address
     * @param newVault New vault address
     */
    function setVaultAddress(address newVault) external onlyMasterAdmin {
        if (newVault == address(0)) revert NFT_ZERO_ADDRESS();
        s_vaultAddress = newVault;
        emit VaultAddressUpdated(newVault);
    }
    
    /**
     * @notice Get the base URI
     */
    function getBaseURI() external view returns (string memory) {
        return s_baseTokenURI;
    }
    
    /**
     * @notice Get deposit metadata for a token
     * @param tokenId Token ID
     */
    function getDepositMetadata(uint256 tokenId) 
        external 
        view 
        returns (DepositMetadata memory) 
    {
        if (!s_depositMetadata[tokenId].exists) revert NFT_INVALID_TOKEN_ID();
        return s_depositMetadata[tokenId];
    }
    
    /**
     * @notice Check if a token exists
     * @param tokenId Token ID
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return s_depositMetadata[tokenId].exists;
    }
    
    /**
     * @notice Get the vault address
     */
    function getVaultAddress() external view returns (address) {
        return s_vaultAddress;
    }
    
    /**
     * @notice Override to prevent transfers of locked deposits
     * @dev Users can only transfer after unlock time
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting and burning
        if (from == address(0) || to == address(0)) {
            return super._update(to, tokenId, auth);
        }
        
        // For transfers, check if deposit is unlocked
        DepositMetadata memory metadata = s_depositMetadata[tokenId];
        if (metadata.exists && block.timestamp < metadata.unlockTimestamp) {
            revert("VaultDepositNFT: Cannot transfer locked deposit");
        }
        
        return super._update(to, tokenId, auth);
    }
}
