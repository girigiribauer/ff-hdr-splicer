import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ProgressOverlay } from './ProgressOverlay'

const meta: Meta<typeof ProgressOverlay> = {
    title: 'Components/ProgressOverlay',
    component: ProgressOverlay,
    tags: ['autodocs'],
    argTypes: {
        color: { control: 'select', options: ['green', 'blue'] }
    },
}

export default meta
type Story = StoryObj<typeof ProgressOverlay>

export const Exporting: Story = {
    args: {
        isVisible: true,
        message: 'Exporting...',
        progress: 45,
        color: 'green'
    },
}

export const GeneratingProxy: Story = {
    args: {
        isVisible: true,
        message: 'Generating Preview Proxy...',
        subMessage: '(Optimization for smooth playback)',
        progress: 72,
        color: 'blue'
    },
}

export const Completed: Story = {
    args: {
        isVisible: true,
        message: 'Completed',
        progress: 100,
        color: 'green'
    },
}
