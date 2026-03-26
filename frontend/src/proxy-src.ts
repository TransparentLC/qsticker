export default (url: string) => {
    let m: RegExpExecArray | null;
    m =
        /^https:\/\/i0\.hdslb\.com\/bfs\/(garb|emote)\/([\da-f]{40}\.(?:jpg|png|gif|webp))$/.exec(
            url,
        );
    if (m) {
        return `proxy/bfs/${m[1]}/${m[2]}`;
    }
    return url;
};
