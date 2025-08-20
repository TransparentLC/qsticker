export default (x: number) => {
    const units = ['TB', 'GB', 'MB', 'KB'];
    let unit = 'Bytes';
    while (units.length && x >= 1024) {
        x /= 1024;
        // biome-ignore lint/style/noNonNullAssertion: no reason
        unit = units.pop()!;
    }
    return `${Math.round(x * 100) / 100} ${unit}`;
};
