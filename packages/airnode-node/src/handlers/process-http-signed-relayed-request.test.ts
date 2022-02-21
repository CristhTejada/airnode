import { Endpoint } from '@api3/airnode-ois';
import { processHttpSignedRelayedRequest } from './process-http-signed-relayed-request';
import * as api from '../api';
import * as fixtures from '../../test/fixtures';

const ENDPOINT_ID = '0x13dea3311fe0d6b84f4daeab831befbc49e19e6494c41e9e065a09c3c68f43b6';

function buildConfigWithEndpoint(endpoint?: Endpoint) {
  const endpoints = endpoint ? [endpoint] : [];
  return fixtures.buildConfig({ ois: [fixtures.buildOIS({ endpoints })] });
}

describe('processHttpSignedRelayedRequests', () => {
  it('returns an error if no endpoint trigger with given ID is found', async () => {
    const nonExistentEndpointId = '0xeddc421714e1b46ef350e8ecf380bd0b38a40ce1a534e7ecdf4db7dbc931ffff';
    const [err, res] = await processHttpSignedRelayedRequest(fixtures.buildConfig(), nonExistentEndpointId, {
      relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706',
      id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
      parameters: {},
    });
    expect(res).toBeNull();
    expect(err).toEqual(new Error(`Unable to find endpoint with ID:'${nonExistentEndpointId}'`));
  });

  it('returns an error if no endpoint with given ID is found', async () => {
    const [err, res] = await processHttpSignedRelayedRequest(buildConfigWithEndpoint(), ENDPOINT_ID, {
      relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706',
      id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
      parameters: {},
    });
    expect(res).toBeNull();
    expect(err).toEqual(new Error(`No endpoint definition for endpoint ID '${ENDPOINT_ID}'`));
  });

  it("returns an error if endpoint doesn't allow getting signed relayed data", async () => {
    const endpoint = fixtures.buildOIS().endpoints[0];
    const config = buildConfigWithEndpoint(endpoint);
    config.triggers.httpSignedRelayed = [];

    const [err, res] = await processHttpSignedRelayedRequest(config, ENDPOINT_ID, {
      relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706',
      id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
      parameters: {},
    });
    expect(res).toBeNull();
    expect(err).toEqual(new Error(`Unable to find endpoint with ID:'${ENDPOINT_ID}'`));
  });

  // TODO: Replace with just one test when we validate this using zod
  describe('returns an error for missing parameters', () => {
    it('missing relayer parameter', async () => {
      const parameters = {
        id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
        parameters: {},
      } as any;
      const [err, res] = await processHttpSignedRelayedRequest(fixtures.buildConfig(), ENDPOINT_ID, parameters);

      expect(res).toBeNull();
      expect(err).toEqual(new Error('You must specify "relayer" address in the request parameters.'));
    });

    it('missing id parameter', async () => {
      const parameters = { relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706', parameters: {} } as any;
      const [err, res] = await processHttpSignedRelayedRequest(fixtures.buildConfig(), ENDPOINT_ID, parameters);

      expect(res).toBeNull();
      expect(err).toEqual(
        new Error('You must specify "id" for the requestId/subscriptionId in the request parameters.')
      );
    });

    it('missing parameters parameter', async () => {
      const parameters = {
        id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
        relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706',
      } as any;
      const [err, res] = await processHttpSignedRelayedRequest(fixtures.buildConfig(), ENDPOINT_ID, parameters);

      expect(res).toBeNull();
      expect(err).toEqual(new Error('You must specify "parameters" for the API request in the request parameters.'));
    });
  });

  it('calls the API with given parameters', async () => {
    const spy = jest.spyOn(api, 'callApi');
    // What exactly the API returns doesn't matter for this test
    const mockedResponse = { success: true, value: 'value', signature: 'signature' } as const;
    spy.mockResolvedValueOnce([[], mockedResponse]);

    const parameters = {
      _type: 'int256',
      _path: 'price',
      parameters: { from: 'ETH' },
      relayer: '0xA7b4c9bf0AF030a171c49400d3299703d3E97706',
      id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
    };
    const [err, res] = await processHttpSignedRelayedRequest(fixtures.buildConfig(), ENDPOINT_ID, parameters);

    const config = fixtures.buildConfig();
    const aggregatedApiCall = fixtures.buildAggregatedSignedRelayedApiCall({
      airnodeAddress: '0xA30CA71Ba54E83127214D3271aEA8F5D6bD4Dace',
      endpointId: ENDPOINT_ID,
      id: '0xcf2816af81f9cc7c9879dc84ce29c00fe1e290bcb8d2e4b204be1eeb120811bf',
      parameters: parameters.parameters,
    });

    expect(err).toBeNull();
    expect(res).toEqual(mockedResponse);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ config, aggregatedApiCall });
  });
});
