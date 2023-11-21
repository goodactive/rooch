// Copyright (c) RoochNetwork
// SPDX-License-Identifier: Apache-2.0

use crate::addresses::ROOCH_FRAMEWORK_ADDRESS;
use anyhow::Result;
use bitcoin::{block::Header, hashes::Hash};
use move_core_types::{
    account_address::AccountAddress, ident_str, identifier::IdentStr, value::MoveValue,
};
use moveos_types::{
    module_binding::{ModuleBinding, MoveFunctionCaller},
    moveos_std::tx_context::TxContext,
    transaction::FunctionCall,
};
use serde::{Deserialize, Serialize};

pub const MODULE_NAME: &IdentStr = ident_str!("bitcoin_light_client");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BlockHeader {
    /// Hash of the block
    pub hash: Vec<u8>,
    /// Block version, now repurposed for soft fork signalling.
    pub version: u32,
    /// Reference to the previous block in the chain.
    pub prev_blockhash: Vec<u8>,
    /// The root hash of the merkle tree of transactions in the block.
    pub merkle_root: Vec<u8>,
    /// The timestamp of the block, as claimed by the miner.
    pub time: u32,
    /// The target value below which the blockhash must lie.
    pub bits: u32,
    /// The nonce, selected to obtain a low enough blockhash.
    pub nonce: u32,
}

impl From<Header> for BlockHeader {
    fn from(value: Header) -> Self {
        BlockHeader {
            hash: value.block_hash().to_byte_array().to_vec(),
            version: value.version.to_consensus() as u32,
            prev_blockhash: value.prev_blockhash.to_byte_array().to_vec(),
            merkle_root: value.merkle_root.to_byte_array().to_vec(),
            time: value.time,
            bits: value.bits.to_consensus(),
            nonce: value.nonce,
        }
    }
}

/// Rust bindings for RoochFramework bitcoin_light_client module
pub struct BitcoinLightClientModule<'a> {
    caller: &'a dyn MoveFunctionCaller,
}

impl<'a> BitcoinLightClientModule<'a> {
    pub const GET_BLOCK_FUNCTION_NAME: &'static IdentStr = ident_str!("get_block");
    pub const SUBMIT_NEW_BLOCK_ENTRY_FUNCTION_NAME: &'static IdentStr =
        ident_str!("submit_new_block");

    pub fn get_block(&self, block_hash: Vec<u8>) -> Result<BlockHeader> {
        let call = FunctionCall::new(
            Self::function_id(Self::GET_BLOCK_FUNCTION_NAME),
            vec![],
            vec![MoveValue::vector_u8(block_hash).simple_serialize().unwrap()],
        );
        let ctx = TxContext::new_readonly_ctx(AccountAddress::ZERO);
        let block_header =
            self.caller
                .call_function(&ctx, call)?
                .into_result()
                .map(|mut values| {
                    let value = values.pop().expect("should have one return value");
                    bcs::from_bytes::<BlockHeader>(&value.value)
                        .expect("should be a valid BlockHeader")
                })?;
        Ok(block_header)
    }

    pub fn create_submit_new_block_call(block_header: &BlockHeader) -> FunctionCall {
        Self::create_function_call(
            Self::SUBMIT_NEW_BLOCK_ENTRY_FUNCTION_NAME,
            vec![],
            vec![MoveValue::vector_u8(
                bcs::to_bytes(&block_header).expect("Serialize BlockHeader should success."),
            )],
        )
    }
}

impl<'a> ModuleBinding<'a> for BitcoinLightClientModule<'a> {
    const MODULE_NAME: &'static IdentStr = MODULE_NAME;
    const MODULE_ADDRESS: AccountAddress = ROOCH_FRAMEWORK_ADDRESS;

    fn new(caller: &'a impl MoveFunctionCaller) -> Self
    where
        Self: Sized,
    {
        Self { caller }
    }
}

#[cfg(test)]
mod tests {
    use bitcoin::{consensus::deserialize, hashes::Hash, Block};
    use hex::FromHex;

    use crate::framework::bitcoin_light_client::BlockHeader;

    #[test]
    fn test_header() {
        // Mainnet block 00000000b0c5a240b2a61d2e75692224efd4cbecdf6eaf4cc2cf477ca7c270e7
        let some_block = Vec::<u8>::from_hex("010000004ddccd549d28f385ab457e98d1b11ce80bfea2c5ab93015ade4973e400000000bf4473e53794beae34e64fccc471dace6ae544180816f89591894e0f417a914cd74d6e49ffff001d323b3a7b0201000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0804ffff001d026e04ffffffff0100f2052a0100000043410446ef0102d1ec5240f0d061a4246c1bdef63fc3dbab7733052fbbf0ecd8f41fc26bf049ebb4f9527f374280259e7cfa99c48b0e3f39c51347a19a5819651503a5ac00000000010000000321f75f3139a013f50f315b23b0c9a2b6eac31e2bec98e5891c924664889942260000000049483045022100cb2c6b346a978ab8c61b18b5e9397755cbd17d6eb2fe0083ef32e067fa6c785a02206ce44e613f31d9a6b0517e46f3db1576e9812cc98d159bfdaf759a5014081b5c01ffffffff79cda0945903627c3da1f85fc95d0b8ee3e76ae0cfdc9a65d09744b1f8fc85430000000049483045022047957cdd957cfd0becd642f6b84d82f49b6cb4c51a91f49246908af7c3cfdf4a022100e96b46621f1bffcf5ea5982f88cef651e9354f5791602369bf5a82a6cd61a62501fffffffffe09f5fe3ffbf5ee97a54eb5e5069e9da6b4856ee86fc52938c2f979b0f38e82000000004847304402204165be9a4cbab8049e1af9723b96199bfd3e85f44c6b4c0177e3962686b26073022028f638da23fc003760861ad481ead4099312c60030d4cb57820ce4d33812a5ce01ffffffff01009d966b01000000434104ea1feff861b51fe3f5f8a3b12d0f4712db80e919548a80839fc47c6a21e66d957e9c5d8cd108c7a2d2324bad71f9904ac0ae7336507d785b17a2c115e427a32fac00000000").unwrap();

        let prevhash =
            Vec::<u8>::from_hex("4ddccd549d28f385ab457e98d1b11ce80bfea2c5ab93015ade4973e400000000")
                .unwrap();
        let merkle =
            Vec::<u8>::from_hex("bf4473e53794beae34e64fccc471dace6ae544180816f89591894e0f417a914c")
                .unwrap();

        let decode: Block = deserialize(&some_block).unwrap();
        let block_header: BlockHeader = decode.header.into();

        assert_eq!(block_header.version, 1);
        assert_eq!(block_header.prev_blockhash, prevhash);
        assert_eq!(
            block_header.merkle_root,
            decode
                .compute_merkle_root()
                .unwrap()
                .to_byte_array()
                .to_vec()
        );
        assert_eq!(block_header.merkle_root, merkle);
        assert_eq!(block_header.time, 1231965655);
        assert_eq!(block_header.bits, 486604799);
        assert_eq!(block_header.nonce, 2067413810);
    }
}
