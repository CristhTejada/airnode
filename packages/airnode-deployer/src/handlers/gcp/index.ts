import * as path from 'path';
import { Request, Response } from '@google-cloud/functions-framework/build/src/functions';
import {
  handlers,
  providers,
  config,
  InitializeProviderPayload,
  CallApiPayload,
  ProcessTransactionsPayload,
  WorkerPayload,
  loadTrustedConfig,
} from '@api3/airnode-node';
import { logger, DEFAULT_RETRY_DELAY_MS } from '@api3/airnode-utilities';
import { go } from '@api3/promise-utils';
import { z } from 'zod';
import { verifyHttpSignedDataRequest, verifyHttpRequest, VerificationResult } from '../common';

const configFile = path.resolve(`${__dirname}/../../config-data/config.json`);
const parsedConfig = loadTrustedConfig(configFile, process.env);

export async function startCoordinator(_req: Request, res: Response) {
  await handlers.startCoordinator(parsedConfig);
  const response = { ok: true, data: { message: 'Coordinator completed' } };
  res.status(200).send(response);
}

export async function run(req: Request, res: Response) {
  const payload: WorkerPayload = req.body;

  switch (payload.functionName) {
    case 'initializeProvider':
      return initializeProvider(payload, res);
    case 'callApi':
      return callApi(payload, res);
    case 'processTransactions':
      return processTransactions(payload, res);
  }
}

// TODO: Refactor handlers so they are common for all the cloud providers
// https://api3dao.atlassian.net/browse/AN-527

async function initializeProvider(payload: InitializeProviderPayload, res: Response) {
  const stateWithConfig = { ...payload.state, config: parsedConfig };

  const goInitializedState = await go(() => handlers.initializeProvider(stateWithConfig), {
    delay: { type: 'static', delayMs: DEFAULT_RETRY_DELAY_MS },
  });
  if (!goInitializedState.success) {
    const msg = `Failed to initialize provider: ${stateWithConfig.settings.name}`;
    logger.log(goInitializedState.error.toString());
    const errorLog = logger.pend('ERROR', msg, goInitializedState.error);
    const body = { ok: false, errorLog };
    res.status(500).send(body);
    return;
  }
  if (!goInitializedState.data) {
    const msg = `Failed to initialize provider: ${stateWithConfig.settings.name}`;
    const errorLog = logger.pend('ERROR', msg);
    const body = { ok: false, errorLog };
    res.status(500).send(body);
    return;
  }

  const body = { ok: true, data: providers.scrub(goInitializedState.data) };
  res.status(200).send(body);
}

async function callApi(payload: CallApiPayload, res: Response) {
  const { aggregatedApiCall, logOptions } = payload;
  const [logs, apiCallResponse] = await handlers.callApi(parsedConfig, aggregatedApiCall);
  logger.logPending(logs, logOptions);
  const response = { ok: true, data: apiCallResponse };
  res.status(200).send(response);
}

async function processTransactions(payload: ProcessTransactionsPayload, res: Response) {
  const stateWithConfig = { ...payload.state, config: parsedConfig };

  const goUpdatedState = await go(() => handlers.processTransactions(stateWithConfig), {
    delay: { type: 'static', delayMs: DEFAULT_RETRY_DELAY_MS },
  });
  if (!goUpdatedState.success) {
    const msg = `Failed to process provider requests: ${stateWithConfig.settings.name}`;
    const errorLog = logger.pend('ERROR', msg, goUpdatedState.error);
    const body = { ok: false, errorLog };
    res.status(500).send(body);
    return;
  }

  const body = { ok: true, data: providers.scrub(goUpdatedState.data) };
  res.status(200).send(body);
}

// We need to check for an API key manually because GCP HTTP Gateway doesn't support managing API keys via API
export function verifyGcpApiKey(
  req: Request,
  apiKeyName: 'HTTP_GATEWAY_API_KEY' | 'HTTP_SIGNED_DATA_GATEWAY_API_KEY'
): VerificationResult<{}> {
  const apiKey = req.header('x-api-key');
  if (!apiKey || apiKey !== config.getEnvValue(apiKeyName)) {
    // Mimics the behavior of AWS HTTP Gateway
    return { success: false, statusCode: 403, error: { message: 'Forbidden' } };
  }

  return { success: true };
}

// We do not want to enable ".strict()" - we want to allow extra fields in the request body
const httpRequestBodySchema = z.object({
  parameters: z.any(), // Parameter validation is performed later
});

export async function processHttpRequest(req: Request, res: Response) {
  const apiKeyVerification = verifyGcpApiKey(req, 'HTTP_GATEWAY_API_KEY');
  if (!apiKeyVerification.success) {
    const { statusCode, error } = apiKeyVerification;
    res.status(statusCode).send(error);
    return;
  }

  const parsedBody = httpRequestBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    // This error and status code is returned by AWS gateway when the request does not match the openAPI
    // specification. We want the same error to be returned by the GCP gateway.
    res.status(400).send({ message: 'Invalid request body' });
    return;
  }
  const { parameters: rawParameters } = parsedBody.data;

  // Guaranteed to exist by the openAPI schema
  const { endpointId: rawEndpointId } = req.query;

  const verificationResult = verifyHttpRequest(parsedConfig, rawParameters, rawEndpointId as string);
  if (!verificationResult.success) {
    const { statusCode, error } = verificationResult;
    res.status(statusCode).send(error);
    return;
  }
  const { parameters, endpointId } = verificationResult;

  const [err, result] = await handlers.processHttpRequest(parsedConfig, endpointId, parameters);
  if (err) {
    // Returning 500 because failure here means something went wrong internally with a valid request
    res.status(500).send({ message: err.toString() });
    return;
  }

  // We do not want the user to see {"success": true, "data": <actual_data>}, but the actual data itself
  res.status(200).send(result!.data);
}

// We do not want to enable ".strict()" - we want to allow extra fields in the request body
const httpSignedDataBodySchema = z.object({
  encodedParameters: z.string(),
});

// TODO: Copy&paste for now, will refactor as part of
// https://api3dao.atlassian.net/browse/AN-527
export async function processHttpSignedDataRequest(req: Request, res: Response) {
  const apiKeyVerification = verifyGcpApiKey(req, 'HTTP_SIGNED_DATA_GATEWAY_API_KEY');
  if (!apiKeyVerification.success) {
    const { statusCode, error } = apiKeyVerification;
    res.status(statusCode).send(error);
    return;
  }

  const parsedBody = httpSignedDataBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    // This error and status code is returned by AWS gateway when the request does not match the openAPI
    // specification. We want the same error to be returned by the GCP gateway.
    res.status(400).send({ message: 'Invalid request body' });
    return;
  }
  const { encodedParameters: rawEncodedParameters } = parsedBody.data;

  // Guaranteed to exist by the openAPI schema
  const { endpointId: rawEndpointId } = req.query;

  const verificationResult = verifyHttpSignedDataRequest(parsedConfig, rawEncodedParameters, rawEndpointId as string);
  if (!verificationResult.success) {
    const { statusCode, error } = verificationResult;
    res.status(statusCode).send(error);
    return;
  }
  const { encodedParameters, endpointId } = verificationResult;

  const [err, result] = await handlers.processHttpSignedDataRequest(
    parsedConfig,
    endpointId as string,
    encodedParameters
  );
  if (err) {
    // Returning 500 because failure here means something went wrong internally with a valid request
    res.status(500).send({ message: err.toString() });
    return;
  }

  // We do not want the user to see {"success": true, "data": <actual_data>}, but the actual data itself
  res.status(200).send(result!.data);
}
