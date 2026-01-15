import { Show } from 'solid-js'
import styles from './ProgressOverlay.module.css'

interface ProgressOverlayProps {
    isVisible: boolean
    message: string
    subMessage?: string
    progress: number
    color?: 'green' | 'blue'
}

export function ProgressOverlay(props: ProgressOverlayProps) {
    return (
        <Show when={props.isVisible}>
            <div class={styles.overlay}>
                <div class={styles.spinner}></div>
                <div class={styles.text}>
                    {props.message} {Math.round(props.progress)}%
                    <Show when={props.subMessage}>
                        <span class={styles.subText}>{props.subMessage}</span>
                    </Show>
                </div>
                <div class={styles.barContainer}>
                    <div
                        class={`${styles.barFill} ${props.color === 'blue' ? styles.blue : styles.green}`}
                        style={{ width: `${props.progress}%` }}
                    ></div>
                </div>
            </div>
        </Show>
    )
}
