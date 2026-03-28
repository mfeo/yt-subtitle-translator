// Runs in MAIN world to access ytInitialPlayerResponse
(function () {
  try {
    const data = (window as any).ytInitialPlayerResponse;
    if (!data) return;
    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks) return;
    window.postMessage(
      {
        type: "__YT_CAPTION_TRACKS__",
        tracks: tracks.map(
          (t: {
            baseUrl: string;
            name?: { simpleText?: string };
            vssId?: string;
            languageCode?: string;
            isDefault?: boolean;
          }) => ({
            baseUrl: t.baseUrl,
            name: t.name?.simpleText || "",
            vssId: t.vssId || "",
            languageCode: t.languageCode || "",
            isDefault: t.isDefault || false,
          })
        ),
      },
      "*"
    );
  } catch (e) {}
})();
