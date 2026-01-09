export const formatTime = (s: number) => {
    // Handle infinite or NaN
    if (!Number.isFinite(s)) return "00:00:00.000";
    // HH:MM:SS.mmm
    return new Date(Math.max(0, s) * 1000).toISOString().slice(11, 23);
};

export const formatDuration = (s: number) => {
    if (!Number.isFinite(s)) return "0.000";
    return s.toFixed(3);
};

export const parseTime = (str: string): number => {
    const parts = str.split(':').reverse();
    let seconds = 0;
    if (parts[0]) seconds += parseFloat(parts[0]);
    if (parts[1]) seconds += parseFloat(parts[1]) * 60;
    if (parts[2]) seconds += parseFloat(parts[2]) * 3600;
    return seconds;
};
