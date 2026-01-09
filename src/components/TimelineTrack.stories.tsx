import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { TimelineTrack } from "./TimelineTrack";

const meta: Meta<typeof TimelineTrack> = {
    title: "Components/TimelineTrack",
    component: TimelineTrack,
    tags: ["autodocs"],
    argTypes: {
        onChange: { action: "change" },
        onSelectSegment: { action: "select" },
        onAddSegment: { action: "add" },
        onRemoveSegment: { action: "remove" },
    },
    decorators: [
        (Story) => (
            <div style={{ padding: "20px", background: "#222", width: "100%", height: "100px" }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof TimelineTrack>;

export const Default: Story = {
    args: {
        min: 0,
        max: 100,
        segments: [
            { id: "1", start: 10, end: 30 },
            { id: "2", start: 50, end: 80 }
        ],
        selectedSegmentId: null,
        enableFadeIn: true,
        enableFadeOut: true,
        enableCrossfade: false,
    },
};

export const Selected: Story = {
    args: {
        min: 0,
        max: 100,
        segments: [
            { id: "1", start: 10, end: 30 },
            { id: "2", start: 50, end: 80 }
        ],
        selectedSegmentId: "2",
        enableFadeIn: true,
        enableFadeOut: true,
        enableCrossfade: false,
    },
};

export const WithCrossfade: Story = {
    args: {
        min: 0,
        max: 100,
        segments: [
            { id: "1", start: 10, end: 30 },
            { id: "2", start: 50, end: 80 }
        ],
        selectedSegmentId: null,
        enableFadeIn: false,
        enableFadeOut: false,
        enableCrossfade: true,
    },
};
