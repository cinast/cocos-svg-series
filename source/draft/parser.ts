// scripts/CustomFileParser.ts
import { assetManager } from "cc";
import { SVGAsset } from "../SVGAssets";

export class CustomFileParser {
    static init() {
        // 注册 .svg 文件的解析处理器
        assetManager.parser.register(".svg", this.handleParse.bind(this));

        // 注册更多自定义格式
        assetManager.parser.register({
            ".svg": this.handleParse.bind(this),
        });
    }

    /**
     * 自定义解析处理器
     */
    private static handleParse(
        file: any, // 下载器传来的原始文件数据
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        try {
            // 根据不同的文件内容类型进行处理
            if (typeof file === "string") {
                // 文本格式
                this.parseTextFile(file, options, onComplete);
            } else if (file instanceof ArrayBuffer) {
                // 二进制格式
                this.parseBinaryFile(file, options, onComplete);
            } else if (file instanceof Uint8Array) {
                // 字节数组格式
                this.parseUint8Array(file, options, onComplete);
            } else {
                // 其他格式，尝试转换为字符串
                this.parseTextFile(String(file), options, onComplete);
            }
        } catch (err) {
            onComplete(err as Error);
        }
    }

    /**
     * 解析文本文件
     */
    private static parseTextFile(
        text: string,
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        // 创建自定义资源实例
        const svgAsset = new SVGAsset();
        svgAsset.svgContent = text;

        // 尝试自动解析数据
        try {
            svgAsset.parseSVG();
        } catch (e) {
            console.warn("Auto parse failed, you can parse manually later");
        }

        onComplete(null, svgAsset);
    }

    /**
     * 解析二进制文件
     */
    private static parseBinaryFile(
        buffer: ArrayBuffer,
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        // 将 ArrayBuffer 转换为字符串
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(buffer);
        this.parseTextFile(text, options, onComplete);
    }

    /**
     * 解析 Uint8Array
     */
    private static parseUint8Array(
        array: Uint8Array,
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        // 将 Uint8Array 转换为字符串
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(array);
        this.parseTextFile(text, options, onComplete);
    }
}
