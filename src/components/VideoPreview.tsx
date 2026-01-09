import { Component } from 'solid-js'
import styles from './VideoPreview.module.css'

interface VideoPreviewProps {
    src: string
    videoRef: (el: HTMLVideoElement) => void
    onLoadedMetadata: (e: Event) => void
    onTimeUpdate: (e: Event) => void
    onPlay: () => void
    onPause: () => void
    onClick: () => void
}

export const VideoPreview: Component<VideoPreviewProps> = (props) => {
    return (
        <div class={styles.previewArea} onClick={props.onClick}>
            <video
                ref={props.videoRef}
                src={props.src}
                class={styles.video}
                onLoadedMetadata={props.onLoadedMetadata}
                onTimeUpdate={props.onTimeUpdate}
                onPlay={props.onPlay}
                onPause={props.onPause}
                crossOrigin="anonymous"
            />
        </div>
    )
}
