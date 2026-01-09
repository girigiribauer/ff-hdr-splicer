import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { EditorHeader } from "./EditorHeader";

const meta: Meta<typeof EditorHeader> = {
    title: "Components/EditorHeader",
    component: EditorHeader,
    tags: ["autodocs"],
    argTypes: {
        onBack: { action: "back clicked" },
        onExport: { action: "export clicked" },
    },
};

export default meta;
type Story = StoryObj<typeof EditorHeader>;

export const Default: Story = {
    args: {
        filePath: "/Users/demo/videos/hdr_vacation.mp4",
        isExporting: false,
    },
};

export const Exporting: Story = {
    args: {
        filePath: "/Users/demo/videos/project_alpha.mov",
        isExporting: true,
    },
};
