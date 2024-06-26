
<a name="0x4_light_client"></a>

# Module `0x4::light_client`



-  [Struct `TxProgressErrorLogEvent`](#0x4_light_client_TxProgressErrorLogEvent)
-  [Resource `BitcoinBlockStore`](#0x4_light_client_BitcoinBlockStore)
-  [Constants](#@Constants_0)
-  [Function `genesis_init`](#0x4_light_client_genesis_init)
-  [Function `get_tx`](#0x4_light_client_get_tx)
-  [Function `get_block`](#0x4_light_client_get_block)
-  [Function `get_block_height`](#0x4_light_client_get_block_height)
-  [Function `get_block_by_height`](#0x4_light_client_get_block_by_height)
-  [Function `get_latest_block_height`](#0x4_light_client_get_latest_block_height)


<pre><code><b>use</b> <a href="">0x1::option</a>;
<b>use</b> <a href="">0x1::string</a>;
<b>use</b> <a href="">0x1::vector</a>;
<b>use</b> <a href="">0x2::bcs</a>;
<b>use</b> <a href="">0x2::object</a>;
<b>use</b> <a href="">0x2::signer</a>;
<b>use</b> <a href="">0x2::simple_multimap</a>;
<b>use</b> <a href="">0x2::table</a>;
<b>use</b> <a href="">0x2::table_vec</a>;
<b>use</b> <a href="">0x2::type_info</a>;
<b>use</b> <a href="">0x3::bitcoin_address</a>;
<b>use</b> <a href="">0x3::timestamp</a>;
<b>use</b> <a href="data_import_config.md#0x4_data_import_config">0x4::data_import_config</a>;
<b>use</b> <a href="ord.md#0x4_ord">0x4::ord</a>;
<b>use</b> <a href="types.md#0x4_types">0x4::types</a>;
<b>use</b> <a href="utxo.md#0x4_utxo">0x4::utxo</a>;
</code></pre>



<a name="0x4_light_client_TxProgressErrorLogEvent"></a>

## Struct `TxProgressErrorLogEvent`



<pre><code><b>struct</b> <a href="light_client.md#0x4_light_client_TxProgressErrorLogEvent">TxProgressErrorLogEvent</a> <b>has</b> <b>copy</b>, drop
</code></pre>



<a name="0x4_light_client_BitcoinBlockStore"></a>

## Resource `BitcoinBlockStore`



<pre><code><b>struct</b> <a href="light_client.md#0x4_light_client_BitcoinBlockStore">BitcoinBlockStore</a> <b>has</b> key
</code></pre>



<a name="@Constants_0"></a>

## Constants


<a name="0x4_light_client_ErrorBlockNotFound"></a>



<pre><code><b>const</b> <a href="light_client.md#0x4_light_client_ErrorBlockNotFound">ErrorBlockNotFound</a>: u64 = 1;
</code></pre>



<a name="0x4_light_client_ErrorBlockAlreadyProcessed"></a>



<pre><code><b>const</b> <a href="light_client.md#0x4_light_client_ErrorBlockAlreadyProcessed">ErrorBlockAlreadyProcessed</a>: u64 = 2;
</code></pre>



<a name="0x4_light_client_genesis_init"></a>

## Function `genesis_init`



<pre><code><b>public</b>(<b>friend</b>) <b>fun</b> <a href="light_client.md#0x4_light_client_genesis_init">genesis_init</a>(_genesis_account: &<a href="">signer</a>)
</code></pre>



<a name="0x4_light_client_get_tx"></a>

## Function `get_tx`



<pre><code><b>public</b> <b>fun</b> <a href="light_client.md#0x4_light_client_get_tx">get_tx</a>(txid: <b>address</b>): <a href="_Option">option::Option</a>&lt;<a href="types.md#0x4_types_Transaction">types::Transaction</a>&gt;
</code></pre>



<a name="0x4_light_client_get_block"></a>

## Function `get_block`

Get block via block_hash


<pre><code><b>public</b> <b>fun</b> <a href="light_client.md#0x4_light_client_get_block">get_block</a>(block_hash: <b>address</b>): <a href="_Option">option::Option</a>&lt;<a href="types.md#0x4_types_Header">types::Header</a>&gt;
</code></pre>



<a name="0x4_light_client_get_block_height"></a>

## Function `get_block_height`



<pre><code><b>public</b> <b>fun</b> <a href="light_client.md#0x4_light_client_get_block_height">get_block_height</a>(block_hash: <b>address</b>): <a href="_Option">option::Option</a>&lt;u64&gt;
</code></pre>



<a name="0x4_light_client_get_block_by_height"></a>

## Function `get_block_by_height`

Get block via block_height


<pre><code><b>public</b> <b>fun</b> <a href="light_client.md#0x4_light_client_get_block_by_height">get_block_by_height</a>(block_height: u64): <a href="_Option">option::Option</a>&lt;<a href="types.md#0x4_types_Header">types::Header</a>&gt;
</code></pre>



<a name="0x4_light_client_get_latest_block_height"></a>

## Function `get_latest_block_height`

Get latest block height


<pre><code><b>public</b> <b>fun</b> <a href="light_client.md#0x4_light_client_get_latest_block_height">get_latest_block_height</a>(): <a href="_Option">option::Option</a>&lt;u64&gt;
</code></pre>
