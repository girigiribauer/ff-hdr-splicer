import { Component } from 'solid-js'
import styles from './DurationDisplay.module.css'
import { formatTime } from '../utils/time'

interface DurationDisplayProps {
    duration: number
}

export const DurationDisplay: Component<DurationDisplayProps> = (props) => {
    return (
        <div class={styles.container}>
            <span class={styles.text}>
                {formatTime(props.duration)}
            </span>
        </div>
    )
}
