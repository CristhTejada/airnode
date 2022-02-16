import { Endpoint } from '@api3/airnode-ois';
import { processHttpSignedRelayedRequests } from './process-http-signed-relayed-requests';
import * as worker from '../adapters/http/worker';
import * as fixtures from '../../test/fixtures';

const ENDPOINT_ID = '0x13dea3311fe0d6b84f4daeab831befbc49e19e6494c41e9e065a09c3c68f43b6';

function buildConfigWithEndpoint(endpoint?: Endpoint) {
  const endpoints = endpoint ? [endpoint] : [];
  return fixtures.buildConfig({ ois: [fixtures.buildOIS({ endpoints })] });
}

describe('processHttpSignedRelayedRequests', () => {
  it('returns an error if no endpoint trigger with given ID is found', async () => {
    const nonExistentEndpointId = '0xeddc421714e1b46ef350e8ecf380bd0b38a40ce1a534e7ecdf4db7dbc931ffff';
    const [err, res] = await processHttpSignedRelayedRequests(fixtures.buildConfig(), nonExistentEndpointId, {});
    expect(res).toBeNull();
    expect(err).toEqual(new Error(`Unable to find endpoint with ID:'${nonExistentEndpointId}'`));
  });

  it('returns an error if no endpoint with given ID is found', async () => {
    const [err, res] = await processHttpSignedRelayedRequests(buildConfigWithEndpoint(), ENDPOINT_ID, {});
    expect(res).toBeNull();
    expect(err).toEqual(new Error(`No endpoint definition for endpoint ID '${ENDPOINT_ID}'`));
  });

  it("returns an error if endpoint doesn't allow getting signed relayed data", async () => {
    const endpoint = fixtures.buildOIS().endpoints[0];
    const config = buildConfigWithEndpoint(endpoint);
    config.triggers.httpSignedRelayed = [];

    const [err, res] = await processHttpSignedRelayedRequests(config, ENDPOINT_ID, {});
    expect(res).toBeNull();
    expect(err).toEqual(new Error(`Unable to find endpoint with ID:'${ENDPOINT_ID}'`));
  });

  describe('returns an error for missing parameters', () => {
    it('missing relayer parameter', async () => {
      const parameters = { _id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf' };
      const [err, res] = await processHttpSignedRelayedRequests(fixtures.buildConfig(), ENDPOINT_ID, parameters);

      expect(res).toBeNull();
      expect(err).toEqual(new Error('You must specify "relayer" address in the request parameters.'));
    });

    it('missing id parameter', async () => {
      const parameters = { _relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706' };
      const [err, res] = await processHttpSignedRelayedRequests(fixtures.buildConfig(), ENDPOINT_ID, parameters);

      expect(res).toBeNull();
      expect(err).toEqual(
        new Error('You must specify "id" for the requestId/subscriptionId in the request parameters.')
      );
    });
  });

  it('calls the API with given parameters', async () => {
    const spy = jest.spyOn(worker, 'spawnNewApiCall');
    // What exactly the API returns doesn't matter for this test
    const mockedResponse = { success: true, value: 'value', signature: 'signature' } as const;
    spy.mockResolvedValueOnce([[], mockedResponse]);

    const parameters = {
      _type: 'int256',
      _path: 'price',
      from: 'ETH',
      _relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706',
      _id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
    };
    const [err, res] = await processHttpSignedRelayedRequests(fixtures.buildConfig(), ENDPOINT_ID, parameters);

    const aggregatedApiCall = fixtures.buildAggregatedSignedRelayedApiCall({
      airnodeAddress: '0xA30CA71Ba54E83127214D3271aEA8F5D6bD4Dace',
      endpointId: ENDPOINT_ID,
      id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
      parameters,
    });
    const logOptions = {
      format: 'plain',
      level: 'DEBUG',
      meta: {
        requestId: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
      },
    };
    const workerOptions = {
      cloudProvider: {
        type: 'local',
      },
      airnodeAddressShort: expect.any(String),
      stage: 'test',
    };

    expect(err).toBeNull();
    expect(res).toEqual(mockedResponse);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(aggregatedApiCall, logOptions, workerOptions);
  });
});
