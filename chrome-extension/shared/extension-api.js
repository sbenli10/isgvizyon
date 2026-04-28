export const extensionApi =
  globalThis.chrome?.runtime?.id
    ? globalThis.chrome
    : globalThis.browser?.runtime?.id
      ? globalThis.browser
      : null;

export function assertExtensionApi(scope = "extension") {
  if (!extensionApi) {
    throw new Error(
      `${scope} ortaminda extension API bulunamadi. Eklentiyi yeniden yukleyip tekrar deneyin.`
    );
  }

  return extensionApi;
}
