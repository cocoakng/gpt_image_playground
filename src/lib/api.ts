import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'
import { mergeActualParams } from './imageApiShared'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

async function callFalAiImageApiConcurrent(opts: CallApiOptions, profile: Parameters<typeof callFalAiImageApi>[1], n: number): Promise<CallApiResult> {
  const singleOpts = {
    ...opts,
    params: {
      ...opts.params,
      n: 1,
    },
  }
  const results = await Promise.allSettled(
    Array.from({ length: n }).map((_, requestIndex) => callFalAiImageApi({
      ...singleOpts,
      onPartialImage: opts.onPartialImage
        ? (partial) => opts.onPartialImage?.({ ...partial, requestIndex })
        : undefined,
      onFalRequestEnqueued: opts.onFalRequestEnqueued,
    }, profile)),
  )

  const successfulResults = results
    .filter((r): r is PromiseFulfilledResult<CallApiResult> => r.status === 'fulfilled')
    .map((r) => r.value)

  if (successfulResults.length === 0) {
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (firstError) throw firstError.reason
    throw new Error('所有并发请求均失败')
  }

  const images = successfulResults.flatMap((r) => r.images)
  const actualParamsList = successfulResults.flatMap((r) =>
    r.actualParamsList?.length ? r.actualParamsList : r.images.map(() => r.actualParams),
  )
  const revisedPrompts = successfulResults.flatMap((r) =>
    r.revisedPrompts?.length ? r.revisedPrompts : r.images.map(() => undefined),
  )
  const rawImageUrls = successfulResults.flatMap((r) => r.rawImageUrls ?? [])
  const actualParams = mergeActualParams(
    successfulResults[0]?.actualParams ?? {},
    { n: images.length },
  )

  return { images, actualParams, actualParamsList, revisedPrompts, ...(rawImageUrls.length ? { rawImageUrls } : {}) }
}

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)
  if (profile.provider === 'fal') {
    const n = opts.params.n > 0 ? opts.params.n : 1
    if (n > 1) {
      return callFalAiImageApiConcurrent(opts, profile, n)
    }
    return callFalAiImageApi(opts, profile)
  }

  return callOpenAICompatibleImageApi(opts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
}
