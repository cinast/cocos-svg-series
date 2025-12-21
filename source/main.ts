import { SVGImporter } from "./SVGImporter";

export const methods = {
    // 保持现有方法
    showLog() {
        console.log("Hello World from SVG Series Extension");
    },

    async importSVG(filePath: string): Promise<boolean> {
        console.log(`Importing SVG file: ${filePath}`);
        try {
            // 使用改造后的SVGImporter
            const result = await SVGImporter.import(filePath);
            return result;
        } catch (error) {
            console.error(`Error importing SVG: ${error}`);
            return false;
        }
    },

    async renderSVGPreview(filePath: string): Promise<any> {
        console.log(`Rendering SVG preview: ${filePath}`);
        try {
            // 通过消息机制调用面板中的渲染功能
            const preview = await Editor.Message.request("svg-series-panel", "render-svg-preview", { filePath });
            return preview;
        } catch (error: any) {
            console.error(`Error rendering SVG preview: ${error}`);
            return {
                success: false,
                error: error?.message || "Unknown error",
            };
        }
    },
};

export function load() {
    console.log("SVG Series Extension loaded");
}

export function unload() {
    console.log("SVG Series Extension unloaded");
}
