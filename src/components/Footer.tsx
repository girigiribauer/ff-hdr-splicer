import { Component, createSignal, Show, For } from 'solid-js'
import styles from './Footer.module.css'

interface FooterProps {
    ffmpegVersion?: string
    hasError?: boolean
    logs: string[]
}

export const Footer: Component<FooterProps> = (props) => {
    const [showLogs, setShowLogs] = createSignal(false)

    // Parse version string (e.g. "ffmpeg version 6.1.1-tessus...") -> "6.1.1-tessus"
    const getShortVersion = () => {
        if (!props.ffmpegVersion) return ''
        const match = props.ffmpegVersion.match(/version\s+([^\s]+)/)
        return match ? match[1] : props.ffmpegVersion.split(' ')[0]
    }

    return (
        <>
            <div class={styles.footer}>
                <button
                    class={styles.versionInfo}
                    onClick={() => {
                        // if (import.meta.env.DEV) {
                        setShowLogs(!showLogs())
                        // }
                    }}
                    style={{ cursor: import.meta.env.DEV ? 'pointer' : 'default' }}
                >
                    <Show when={props.hasError}>
                        <svg class={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="8" r="8" fill="#CC4444" />
                            <path d="M7 5V9H9V5H7ZM7 10V12H9V10H7Z" fill="white" />
                        </svg>
                        <span class={styles.text}>FFmpeg Check Failed</span>
                    </Show>

                    <Show when={!props.hasError}>
                        <Show when={props.ffmpegVersion} fallback={
                            <span class={styles.text}>Checking Env...</span>
                        }>
                            <svg class={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="8" fill="#00A61C" />
                                <path d="M6.46154 12L3 8.95238L4.15385 7.42857L6.46154 9.33333L11.4615 4L13 5.14286L6.46154 12Z" fill="white" />
                            </svg>
                            <span class={styles.text}>FFmpeg: {getShortVersion()}</span>
                        </Show>
                    </Show>
                </button>
            </div>

            <Show when={showLogs()}>
                <div class={styles.logModal}>
                    <div class={styles.logHeader}>
                        <span>Application Logs</span>
                        <button
                            onClick={() => setShowLogs(false)}
                            class={styles.closeBtn}
                        >
                            ✕
                        </button>
                    </div>
                    <div class={styles.logBody}>
                        <For each={props.logs}>
                            {(l) => <div class={styles.logEntry}>{l}</div>}
                        </For>
                    </div>
                </div>
            </Show>
        </>
    )
}
