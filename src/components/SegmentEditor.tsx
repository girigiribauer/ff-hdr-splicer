import { Component } from 'solid-js'
import styles from './SegmentEditor.module.css'

interface SegmentEditorProps {
    segment: { start: number, end: number, id: string }
    onUpdate: (start: number, end: number) => void
    onDelete: () => void
    videoDuration?: number
}

export const SegmentEditor: Component<SegmentEditorProps> = (props) => {
    return (
        <div class={styles.container}>
            <input
                type="number"
                step="0.001"
                class={styles.input}
                value={props.segment.start.toFixed(3)}
                onInput={(e) => {
                    const val = parseFloat(e.currentTarget.value)
                    if (!isNaN(val)) props.onUpdate(val, props.segment.end)
                }}
            />

            <span class={styles.separator}>~</span>

            <input
                type="number"
                step="0.001"
                class={styles.input}
                value={props.segment.end.toFixed(3)}
                onInput={(e) => {
                    const val = parseFloat(e.currentTarget.value)
                    if (!isNaN(val)) props.onUpdate(props.segment.start, val)
                }}
            />

            <span class={styles.duration}>
                ({(props.segment.end - props.segment.start).toFixed(3)}s)
            </span>

            <button
                class={styles.deleteBtn}
                onClick={props.onDelete}
                title="Delete Segment"
            >
                Delete
            </button>
        </div>
    )
}
