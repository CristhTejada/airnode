import { Config } from '@api3/airnode-node';
import {
  createCloudProviderConfiguration,
  createNodeVersion,
  generateConfigFile,
  getAirnodeRrpAddress,
  getChainId,
} from '../config-utils';

const createConfig = async (generateExampleFile: boolean): Promise<Config> => ({
  chains: [
    {
      maxConcurrency: 100,
      authorizers: {
        requesterEndpointAuthorizers: [],
      },
      authorizations: {
        requesterEndpointAuthorizations: {},
      },
      contracts: {
        AirnodeRrp: await getAirnodeRrpAddress(generateExampleFile),
      },
      id: await getChainId(generateExampleFile),
      providers: {
        exampleProvider: {
          url: '${PROVIDER_URL}',
        },
      },
      type: 'evm',
      options: {
        txType: 'eip1559',
        baseFeeMultiplier: 2,
        priorityFee: {
          value: 3.12,
          unit: 'gwei',
        },
        fulfillmentGasLimit: 500_000,
      },
    },
  ],
  nodeSettings: {
    cloudProvider: createCloudProviderConfiguration(generateExampleFile),
    airnodeWalletMnemonic: '${AIRNODE_WALLET_MNEMONIC}',
    heartbeat: {
      enabled: false,
    },
    httpGateway: {
      enabled: true,
      apiKey: '${HTTP_GATEWAY_API_KEY}',
      maxConcurrency: 20,
    },
    httpSignedDataGateway: {
      enabled: false,
    },
    logFormat: 'plain',
    logLevel: 'INFO',
    nodeVersion: createNodeVersion(),
    stage: 'dev',
  },
  triggers: {
    rrp: [
      {
        endpointId: '0xfb87102cdabadf905321521ba0b3cbf74ad09c5d400ac2eccdbef8d6143e78c4',
        oisTitle: 'CoinGecko basic request',
        endpointName: 'coinMarketData',
      },
    ],
    http: [
      {
        endpointId: '0xfb87102cdabadf905321521ba0b3cbf74ad09c5d400ac2eccdbef8d6143e78c4',
        oisTitle: 'CoinGecko basic request',
        endpointName: 'coinMarketData',
      },
    ],
    httpSignedData: [],
  },
  templates: [],
  ois: [
    {
      oisFormat: '1.1.1',
      title: 'CoinGecko basic request',
      version: '1.0.0',
      apiSpecifications: {
        servers: [
          {
            url: 'https://api.coingecko.com/api/v3',
          },
        ],
        paths: {
          '/coins/{id}': {
            get: {
              parameters: [
                {
                  in: 'path',
                  name: 'id',
                },
                {
                  in: 'query',
                  name: 'localization',
                },
                {
                  in: 'query',
                  name: 'tickers',
                },
                {
                  in: 'query',
                  name: 'market_data',
                },
                {
                  in: 'query',
                  name: 'community_data',
                },
                {
                  in: 'query',
                  name: 'developer_data',
                },
                {
                  in: 'query',
                  name: 'sparkline',
                },
              ],
            },
          },
        },
        components: {
          securitySchemes: {},
        },
        security: {},
      },
      endpoints: [
        {
          name: 'coinMarketData',
          operation: {
            method: 'get',
            path: '/coins/{id}',
          },
          fixedOperationParameters: [
            {
              operationParameter: {
                in: 'query',
                name: 'localization',
              },
              value: 'false',
            },
            {
              operationParameter: {
                in: 'query',
                name: 'tickers',
              },
              value: 'false',
            },
            {
              operationParameter: {
                in: 'query',
                name: 'market_data',
              },
              value: 'true',
            },
            {
              operationParameter: {
                in: 'query',
                name: 'community_data',
              },
              value: 'false',
            },
            {
              operationParameter: {
                in: 'query',
                name: 'developer_data',
              },
              value: 'false',
            },
            {
              operationParameter: {
                in: 'query',
                name: 'sparkline',
              },
              value: 'false',
            },
          ],
          reservedParameters: [
            {
              name: '_type',
              fixed: 'int256',
            },
            {
              name: '_path',
              fixed: 'market_data.current_price.usd',
            },
            {
              name: '_times',
              fixed: '1000000',
            },
          ],
          parameters: [
            {
              name: 'coinId',
              operationParameter: {
                in: 'path',
                name: 'id',
              },
            },
          ],
        },
      ],
    },
  ],
  apiCredentials: [],
});

const generateConfig = async (generateExampleFile = false) => {
  const config = await createConfig(generateExampleFile);
  generateConfigFile(__dirname, config, generateExampleFile);
};

export default generateConfig;
