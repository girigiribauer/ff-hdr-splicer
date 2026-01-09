import { Component, Show } from 'solid-js'
import styles from './PlayControls.module.css'
import { formatTime, parseTime } from '../utils/time'

interface PlayControlsProps {
    isPlaying: boolean
    currentTime: number
    onTogglePlay: () => void
    onTimeChange: (time: number) => void
}

export const PlayControls: Component<PlayControlsProps> = (props) => {
    let inputRef: HTMLInputElement | undefined;

    return (
        <div class={styles.container}>
            <button
                class={styles.playBtn}
                onClick={props.onTogglePlay}
                title={props.isPlaying ? "Pause" : "Play"}
            >
                <Show when={props.isPlaying} fallback={<img src="/play.svg" class={styles.icon} />}>
                    <div class={styles.pauseIcon}>
                        <div class={styles.pauseBar}></div>
                        <div class={styles.pauseBar}></div>
                    </div>
                </Show>
            </button>
            <input
                ref={inputRef}
                type="text"
                class={styles.timeInput}
                value={formatTime(props.currentTime)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const val = parseTime(e.currentTarget.value)
                        if (!isNaN(val)) props.onTimeChange(val)
                        e.currentTarget.blur()
                    }
                }}
                onBlur={(e) => {
                    const val = parseTime(e.currentTarget.value)
                    if (!isNaN(val)) props.onTimeChange(val)
                }}
            />
        </div>
    )
}
