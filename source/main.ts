import { ccenum } from "cc";
import { SVGImporter, SVGAssetProcessor } from "./SVGImporter";

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log("Hello World from SVG Series Extension");
    },

    /**
     * @en Import SVG file
     * @zh 导入SVG文件
     */
    async importSVG(filePath: string): Promise<boolean> {
        console.log(`Importing SVG file: ${filePath}`);
        try {
            const result = await SVGImporter.import(filePath);
            if (result) {
                console.log(`SVG imported successfully: ${filePath}`);
            } else {
                console.error(`Failed to import SVG: ${filePath}`);
            }
            return result;
        } catch (error) {
            console.error(`Error importing SVG: ${error}`);
            return false;
        }
    },

    /**
     * @en Render SVG preview
     * @zh 渲染SVG预览图
     */
    async renderSVGPreview(filePath: string): Promise<any> {
        console.log(`Rendering SVG preview: ${filePath}`);
        try {
            const preview = await SVGAssetProcessor.getPreview(filePath);
            if (preview) {
                console.log(`SVG preview rendered successfully: ${filePath}`);
                return {
                    success: true,
                    preview: preview,
                };
            } else {
                console.error(`Failed to render SVG preview: ${filePath}`);
                return {
                    success: false,
                    error: "Failed to render preview",
                };
            }
        } catch (error: any) {
            console.error(`Error rendering SVG preview: ${error}`);
            return {
                success: false,
                error: error?.message || "Unknown error",
            };
        }
    },
};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
export function load() {
    console.log("SVG Series Extension loaded");
}

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
export function unload() {
    console.log("SVG Series Extension unloaded");
}
