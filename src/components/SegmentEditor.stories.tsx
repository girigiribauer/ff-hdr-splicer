import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SegmentEditor } from "./SegmentEditor";

const meta: Meta<typeof SegmentEditor> = {
    title: "Components/SegmentEditor",
    component: SegmentEditor,
    tags: ["autodocs"],
    argTypes: {
        onUpdate: { action: "update" },
        onDelete: { action: "delete" },
    },
};

export default meta;
type Story = StoryObj<typeof SegmentEditor>;


export const Selected: Story = {
    args: {
        segment: { id: "seg1", start: 10.5, end: 25.0 },
    },
};
