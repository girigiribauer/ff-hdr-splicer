import { createSignal, onCleanup } from 'solid-js'
import styles from './SeekBar.module.css'

interface SeekBarProps {
    min: number
    max: number
    currentTime: number
    onSeek: (time: number) => void
}

export function SeekBar(props: SeekBarProps) {
    let seekRef: HTMLDivElement | undefined
    const [, setIsDragging] = createSignal(false)

    const getPercent = (value: number) => {
        if (props.max - props.min === 0) return 0
        return ((value - props.min) / (props.max - props.min)) * 100
    }

    const getTimeFromX = (clientX: number, rect: DOMRect) => {
        const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
        return props.min + percent * (props.max - props.min)
    }

    const handleMouseDown = (e: MouseEvent) => {
        if (!seekRef) return
        e.preventDefault()
        const time = getTimeFromX(e.clientX, seekRef.getBoundingClientRect())
        props.onSeek(time)
        setIsDragging(true)
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!seekRef) return
        const time = getTimeFromX(e.clientX, seekRef.getBoundingClientRect())
        props.onSeek(time)
    }

    const handleMouseUp = () => {
        setIsDragging(false)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
    }

    onCleanup(() => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
    })

    return (
        <div class={styles.seekBarContainer} ref={seekRef} onMouseDown={handleMouseDown}>
            <div class={styles.seekTrackLine} />
            <div
                class={styles.seekPlayheadKnob}
                style={{ left: `${getPercent(props.currentTime)}% ` }}
            />
        </div>
    )
}
