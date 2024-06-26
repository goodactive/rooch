// Copyright (c) RoochNetwork
// SPDX-License-Identifier: Apache-2.0

import fetch from 'isomorphic-fetch'
import { HTTPTransport, RequestManager } from '@open-rpc/client-js'
import { JsonRpcClient } from '../generated/client'
import { ChainInfo, Network, DevNetwork, DEFAULT_MAX_GAS_AMOUNT } from '../constants'
import {
  AnnotatedFunctionResultView,
  BalanceInfoView,
  bcs,
  EventOptions,
  EventPageView,
  InscriptionStatePageView,
  EventWithIndexerPageView,
  StateOptions,
  StatePageView,
  StateView,
  TransactionWithInfoPageView,
  TransactionWithInfoView,
  UTXOStatePageView,
  BalanceInfoPageView,
  IPage,
  ObjectStateView,
  FieldStateView,
} from '../types'
import {
  addressToListTuple,
  addressToSeqNumber,
  encodeArg,
  encodeFunctionCall,
  functionIdToStirng,
  toHexString,
  typeTagToString,
} from '../utils'
import {
  SendRawTransactionParams,
  SendTransactionParams,
  ExecuteViewFunctionParams,
  GetEventsParams,
  GetTransactionsParams,
  QueryInscriptionsParams,
  QueryUTXOsParams,
  ResoleRoochAddressParams,
  ListStatesParams,
  QueryTransactionParams,
  QueryEventParams,
  GetBalanceParams,
  GetBalancesParams,
  SessionInfo,
  SendTransactionDataParams,
  QueryObjectStatesParams,
  QueryFieldStatesParams,
} from './roochClientTypes'

import {
  AccountAddress as BCSAccountAddress,
  RoochTransaction,
  RoochTransactionData,
} from '../generated/runtime/rooch_types/mod'

import { BcsSerializer } from '../generated/runtime/bcs/bcsSerializer'

export const ROOCH_CLIENT_BRAND = Symbol.for('@roochnetwork/rooch-sdk')

export function isRoochClient(client: unknown): client is RoochClient {
  return (
    typeof client === 'object' &&
    client !== null &&
    (client as { [ROOCH_CLIENT_BRAND]: unknown })[ROOCH_CLIENT_BRAND] === true
  )
}

/**
 * Configuration options for the JsonRpcProvider. If the value of a field is not provided,
 * value in `DEFAULT_OPTIONS` for that field will be used
 */
export type RpcProviderOptions = {
  /**
   * Cache timeout in seconds for the RPC API Version
   */
  versionCacheTimeoutInSeconds?: number

  /** Allow defining a custom RPC client to use */
  fetcher?: typeof fetch
}

const DEFAULT_OPTIONS: RpcProviderOptions = {
  versionCacheTimeoutInSeconds: 600,
}

export class RoochClient {
  public network: Network

  private client: JsonRpcClient

  private rpcApiVersion: string | undefined

  private cacheExpiry: number | undefined

  constructor(network: Network = DevNetwork, public options: RpcProviderOptions = DEFAULT_OPTIONS) {
    this.network = network

    const opts = { ...DEFAULT_OPTIONS, ...options }
    this.options = opts

    this.client = new JsonRpcClient(
      new RequestManager([
        new HTTPTransport(network.options.url, {
          headers: {
            'Content-Type': 'application/json',
          },
          fetcher: opts.fetcher,
        }),
      ]),
    )
  }

  switchChain(network: Network) {
    this.client.close()
    this.network = network
    this.client = new JsonRpcClient(
      new RequestManager([
        new HTTPTransport(network.url, {
          headers: {
            'Content-Type': 'application/json',
          },
          fetcher: this.options.fetcher,
        }),
      ]),
    )
  }

  ChainInfo(): ChainInfo {
    return this.network.info
  }

  getChainId(): number {
    return this.network.id
  }

  async getRpcApiVersion(): Promise<string | undefined> {
    if (this.rpcApiVersion && this.cacheExpiry && this.cacheExpiry <= Date.now()) {
      return this.rpcApiVersion
    }

    try {
      this.rpcApiVersion = await this.client.getRpcApiVersion()
      this.cacheExpiry =
        // Date.now() is in milliseconds, but the timeout is in seconds
        Date.now() + (this.options.versionCacheTimeoutInSeconds ?? 0) * 1000
      return this.rpcApiVersion
    } catch (err) {
      return undefined
    }
  }

  // Execute a read-only function call The function do not change the state of Application
  async executeViewFunction(
    params: ExecuteViewFunctionParams,
  ): Promise<AnnotatedFunctionResultView> {
    const tyStrArgs = params.tyArgs?.map((v) => typeTagToString(v))
    const bcsArgs = params.args?.map((arg) => toHexString(encodeArg(arg))) as any

    return this.client.rooch_executeViewFunction({
      function_id: functionIdToStirng(params.funcId),
      ty_args: tyStrArgs ?? [],
      args: bcsArgs ?? [],
    })
  }

  async sendRawTransaction(params: SendRawTransactionParams) {
    if (params instanceof Uint8Array) {
      return this.client.rooch_sendRawTransaction(params)
    }

    if (
      typeof params === 'object' &&
      params !== null &&
      'authorizer' in params &&
      'data' in params
    ) {
      const { data, authorizer } = params as SendTransactionDataParams
      const transactionDataPayload = (() => {
        const se = new BcsSerializer()
        data.serialize(se)
        return se.getBytes()
      })()
      const auth = await authorizer.auth(transactionDataPayload)
      const transaction = new RoochTransaction(data, auth)
      const transactionPayload = (() => {
        const se = new BcsSerializer()
        transaction.serialize(se)
        return se.getBytes()
      })()

      return this.client.rooch_sendRawTransaction(transactionPayload)
    }

    const { address, authorizer, args, funcId, tyArgs, opts } = params as SendTransactionParams
    const number = await this.getSequenceNumber(address)
    const bcsArgs = args?.map((arg) => encodeArg(arg)) ?? []
    const scriptFunction = encodeFunctionCall(funcId, tyArgs ?? [], bcsArgs)
    const txData = new RoochTransactionData(
      new BCSAccountAddress(addressToListTuple(address)),
      BigInt(number),
      BigInt(this.getChainId()),
      BigInt(opts?.maxGasAmount ?? DEFAULT_MAX_GAS_AMOUNT),
      scriptFunction,
    )
    const transactionDataPayload = (() => {
      const se = new BcsSerializer()
      txData.serialize(se)
      return se.getBytes()
    })()
    const auth = await authorizer.auth(transactionDataPayload)
    const transaction = new RoochTransaction(txData, auth)
    const transactionPayload = (() => {
      const se = new BcsSerializer()
      transaction.serialize(se)
      return se.getBytes()
    })()

    return this.client.rooch_sendRawTransaction(transactionPayload)
  }

  async getTransactionsByHashes(tx_hashes: string[]): Promise<TransactionWithInfoView | null[]> {
    return await this.client.rooch_getTransactionsByHash(tx_hashes)
  }

  async getTransactions(params: GetTransactionsParams): Promise<TransactionWithInfoPageView> {
    return this.client.rooch_getTransactionsByOrder(
      params.cursor.toString(),
      params.limit.toString(),
      params.descending_order,
    )
  }

  // Get the events by event handle id
  async getEvents(params: GetEventsParams): Promise<EventPageView> {
    return await this.client.rooch_getEventsByEventHandle(
      params.eventHandleType,
      params.cursor.toString(),
      params.limit.toString(),
      params.descending_order,
      { decode: true } as EventOptions,
    )
  }

  // Get the states by access_path
  async getStates(access_path: string): Promise<StateView | null[]> {
    return await this.client.rooch_getStates(access_path, { decode: true } as StateOptions)
  }

  async listStates(params: ListStatesParams): Promise<StatePageView> {
    return await this.client.rooch_listStates(
      params.accessPath,
      params.cursor as any,
      params.limit.toString(),
      {
        decode: true,
      } as StateOptions,
    )
  }

  async queryGlobalStates(params: QueryObjectStatesParams): Promise<ObjectStateView> {
    return await this.client.rooch_queryGlobalStates(
      params.filter,
      params.cursor as any,
      params.limit.toString(),
      params.descending_order,
    )
  }

  async queryObjectStates(params: QueryObjectStatesParams): Promise<ObjectStateView> {
    return await this.client.rooch_queryObjectStates(
      params.filter,
      params.cursor as any,
      params.limit.toString(),
      params.descending_order,
    )
  }

  async queryFieldStates(params: QueryFieldStatesParams): Promise<FieldStateView> {
    return await this.client.rooch_queryFieldStates(
      params.filter,
      params.cursor as any,
      params.limit.toString(),
      params.descending_order,
    )
  }

  async queryTableStates(params: QueryFieldStatesParams): Promise<FieldStateView> {
    return await this.client.rooch_queryTableStates(
      params.filter,
      params.cursor as any,
      params.limit.toString(),
      params.descending_order,
    )
  }

  async queryInscriptions(params: QueryInscriptionsParams): Promise<InscriptionStatePageView> {
    return await this.client.btc_queryInscriptions(
      params.filter as any,
      params.cursor as any,
      params.limit.toString(),
      params.descending_order,
    )
  }

  async queryUTXOs(params: QueryUTXOsParams): Promise<UTXOStatePageView> {
    return await this.client.btc_queryUTXOs(
      params.filter as any,
      params.cursor as any,
      params.limit.toString(),
      params.descending_order,
    )
  }

  async queryTransactions(params: QueryTransactionParams): Promise<TransactionWithInfoPageView> {
    return await this.client.rooch_queryTransactions(
      params.filter,
      params.cursor,
      params.limit,
      params.descending_order,
    )
  }

  async queryEvents(params: QueryEventParams): Promise<EventWithIndexerPageView> {
    return await this.client.rooch_queryEvents(
      params.filter,
      params.cursor,
      params.limit,
      params.descending_order,
    )
  }

  async getBalance(params: GetBalanceParams): Promise<BalanceInfoView> {
    return await this.client.rooch_getBalance(params.address, params.coinType)
  }

  async getBalances(params: GetBalancesParams): Promise<BalanceInfoPageView> {
    return await this.client.rooch_getBalances(params.address, params.cursor, params.limit)
  }

  /// contract func

  async getSequenceNumber(address: string): Promise<number> {
    const resp = await this.executeViewFunction({
      funcId: '0x2::account::sequence_number',
      tyArgs: [],
      args: [
        {
          type: 'Address',
          value: address,
        },
      ],
    })

    if (resp && resp.return_values) {
      return resp.return_values[0].decoded_value as number
    }

    return 0
  }

  /**
   * Query account's sessionKey
   *
   * @param address
   * @param cursor The page cursor
   * @param limit The page limit
   */
  public async querySessionKeys(
    address: string,
    cursor: string | null,
    limit: number,
  ): Promise<IPage<SessionInfo, string>> {
    const accessPath = `/resource/${address}/0x3::session_key::SessionKeys`
    const states = await this.getStates(accessPath)

    if (!states || (Array.isArray(states) && states.length === 0)) {
      throw new Error('not found state')
    }
    const stateView = states as any

    const tableId = stateView[0].decoded_value.value.keys.value.handle.value.id

    const tablePath = `/table/${tableId}`
    const pageView = await this.listStates({
      accessPath: tablePath,
      cursor,
      limit,
    })

    const parseScopes = (data: Array<any>) => {
      const result = new Array<string>()

      for (const scope of data) {
        result.push(`${scope.module_name}::${scope.module_address}::${scope.function_name}`)
      }

      return result
    }

    const parseStateToSessionInfo = () => {
      const result = new Array<SessionInfo>()

      for (const state of pageView.data as any) {
        const moveValue = state?.state.decoded_value as any

        if (moveValue) {
          const val = moveValue.value

          result.push({
            authentication_key: val.authentication_key,
            scopes: parseScopes(val.scopes),
            create_time: parseInt(val.create_time),
            last_active_time: parseInt(val.last_active_time),
            max_inactive_interval: parseInt(val.max_inactive_interval),
          } as SessionInfo)
        }
      }
      return result
    }

    return {
      data: parseStateToSessionInfo(),
      nextCursor: pageView.next_cursor,
      hasNextPage: pageView.has_next_page,
    }
  }

  /**
   * Check session key whether expired
   *
   * @param address rooch address
   * @param authKey the auth key
   */
  async sessionIsExpired(address: string, authKey: string): Promise<boolean> {
    const result = await this.executeViewFunction({
      funcId: '0x3::session_key::is_expired_session_key',
      tyArgs: [],
      args: [
        {
          type: 'Address',
          value: address,
        },
        {
          type: { Vector: 'U8' },
          value: addressToSeqNumber(authKey),
        },
      ],
    })

    if (result && result.vm_status !== 'Executed') {
      throw new Error('view 0x3::session_key::is_expired_session_key fail')
    }

    return result.return_values![0].decoded_value as boolean
  }

  async gasCoinBalance(address: string): Promise<bigint> {
    const result = await this.executeViewFunction({
      funcId: '0x3::gas_coin::balance',
      tyArgs: [],
      args: [
        {
          type: 'Address',
          value: address,
        },
      ],
    })

    if (result && result.vm_status !== 'Executed') {
      throw new Error('view 0x3::gas_coin::balance fail')
    }

    return BigInt(result.return_values![0].decoded_value as string)
  }

  // Resolve the rooch address
  async resoleRoochAddress(params: ResoleRoochAddressParams): Promise<string> {
    const ma = new bcs.MultiChainAddress(
      BigInt(params.multiChainID),
      addressToSeqNumber(params.address),
    )

    const result = await this.executeViewFunction({
      funcId: '0x3::address_mapping::resolve_or_generate',
      tyArgs: [],
      args: [
        {
          type: {
            Struct: {
              address: '0x3',
              module: 'address_mapping',
              name: 'MultiChainAddress',
            },
          },
          value: ma,
        },
      ],
    })

    if (result && result.vm_status === 'Executed' && result.return_values) {
      return result.return_values[0].decoded_value as string
    }

    throw new Error('resolve rooch address fail')
  }
}
