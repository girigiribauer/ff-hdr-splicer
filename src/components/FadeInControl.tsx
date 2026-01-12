import { Component } from 'solid-js'
import styles from './FadeInControl.module.css'
import { formatDuration, parseTime } from '../utils/time'

export const FadeInControl: Component<{
    active: boolean
    duration: number
    onToggle: () => void
    onDurationChange: (d: number) => void
}> = (props) => {
    return (
        <div class={styles.container}>
            <button
                class={`${styles.iconBtn} ${props.active ? styles.active : ''}`}
                onClick={props.onToggle}
                title="Toggle Fade In/Out"
            >
                <img src="fadeInOut.svg" class={styles.icon} />
            </button>
            <input
                type="text"
                class={styles.timeInput}
                value={formatDuration(props.duration)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const val = parseTime(e.currentTarget.value)
                        if (!isNaN(val)) props.onDurationChange(val)
                        e.currentTarget.blur()
                    }
                }}
                onBlur={(e) => {
                    const val = parseTime(e.currentTarget.value)
                    if (!isNaN(val)) props.onDurationChange(val)
                }}
                disabled={!props.active}
            />
        </div>
    )
}
