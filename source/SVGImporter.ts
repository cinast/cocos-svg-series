/// <reference types="@cocos/creator-types/editor" />

/**
 * SVG资源导入器（主进程版本）
 * 使用Editor API与资源数据库交互
 */
export class SVGImporter {
    /**
     * 导入SVG文件
     */
    static async import(filePath: string): Promise<boolean> {
        try {
            // 1. 读取文件内容（使用Node.js的fs模块）
            const content = await SVGImporter.readFileViaEditor(filePath); // ✅ 正确调用静态方法
            if (!content) {
                console.error(`无法读取SVG文件: ${filePath}`);
                return false;
            }

            // 2. 解析SVG信息（纯文本解析，不使用DOM API）
            const svgInfo = SVGImporter.parseSVGInfoText(content); // ✅ 正确调用静态方法

            // 3. 创建资源的meta文件
            const uuid = await Editor.Message.request("asset-db", "query-uuid", filePath);
            if (!uuid) {
                console.error(`无法获取文件的UUID: ${filePath}`);
                return false;
            }

            // 4. 构建meta数据
            const meta = {
                uuid: uuid,
                imported: true,
                importer: "svg-asset",
                type: "cc.SVGAsset", // 自定义类型
                files: [filePath],
                subMetas: {},
                userData: {
                    type: "svg-asset",
                    svgContent: content,
                    ...svgInfo,
                    sourceFile: filePath,
                    lastModified: Date.now(),
                },
                ver: "1.0.0",
            };

            // 5. 保存meta文件
            await Editor.Message.request("asset-db", "save-asset-meta", uuid, JSON.stringify(meta, null, 2));

            console.log(`SVG文件导入完成: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`SVG导入过程中发生错误:`, error);
            return false;
        }
    }

    /**
     * 通过Node.js fs模块读取文件（主进程可用）
     */
    static async readFileViaEditor(filePath: string): Promise<string | null> {
        try {
            // 使用Node.js的fs模块在主进程读取文件
            const fs = require("fs"); // ✅ Node.js的fs模块在主进程可用
            return new Promise((resolve, reject) => {
                fs.readFile(filePath, "utf-8", (err: any, data: string) => {
                    if (err) {
                        console.error(`读取文件失败: ${filePath}`, err);
                        resolve(null);
                    } else {
                        resolve(data);
                    }
                });
            });
        } catch (error) {
            console.error(`读取文件失败: ${filePath}`, error);
            return null;
        }
    }

    /**
     * 纯文本解析SVG信息（不使用DOM API）
     */
    static parseSVGInfoText(svgContent: string): any {
        // 使用正则表达式从文本中提取信息
        const widthMatch = svgContent.match(/width="([^"]+)"/);
        const heightMatch = svgContent.match(/height="([^"]+)"/);
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
        const titleMatch = svgContent.match(/<title>([^<]+)<\/title>/);
        const descMatch = svgContent.match(/<desc>([^<]+)<\/desc>/);

        let width = 100,
            height = 100;

        if (widthMatch) width = SVGImporter.parseDimension(widthMatch[1]); // ✅ 正确调用静态方法
        if (heightMatch) height = SVGImporter.parseDimension(heightMatch[1]); // ✅ 正确调用静态方法

        // 从viewBox解析尺寸（如果存在）
        if (viewBoxMatch && viewBoxMatch[1]) {
            const parts = viewBoxMatch[1].split(" ").map(Number);
            if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
                width = parts[2];
                height = parts[3];
            }
        }

        return {
            width,
            height,
            aspectRatio: height > 0 ? width / height : 1,
            viewBox: viewBoxMatch ? viewBoxMatch[1] : "",
            defaultColor: "#ffffff",
            title: titleMatch ? titleMatch[1] : "",
            description: descMatch ? descMatch[1] : "",
        };
    }

    private static parseDimension(dim: string): number {
        const num = parseFloat(dim);
        return isNaN(num) ? 0 : num;
    }
}

/**
 * SVG资源处理器
 */
export class SVGAssetProcessor {
    static async process(filePath: string): Promise<boolean> {
        return await SVGImporter.import(filePath);
    }

    /**
     * 获取SVG预览 - 此方法需要在面板（渲染进程）中实现
     */
    static async getPreview(filePath: string): Promise<any> {
        // 这里不直接渲染，而是返回文件信息
        // 实际渲染应该在面板中进行
        const content = await SVGImporter.readFileViaEditor(filePath); // ✅ 直接调用静态方法
        if (!content) return null;

        const info = SVGImporter.parseSVGInfoText(content); // ✅ 直接调用静态方法
        return {
            filePath,
            ...info,
            hasContent: !!content,
        };
    }
}
