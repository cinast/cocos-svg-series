import { assetManager, Asset, Node, isValid } from "cc";
import { SVGAsset } from "../SVGAssets";

export class SVGAssetManager {
    /**
     * 初始化自定义资源系统
     */
    static init() {
        // 确保只初始化一次
        if (this._initialized) return;

        // 初始化下载器和解析器
        // 需要在适当的时机调用 CustomFileDownloader.init() 和 CustomFileParser.init()

        this._initialized = true;
        console.log("svgAssetManager initialized");
    }

    private static _initialized = false;

    /**
     * 加载自定义文件（通用接口）
     */
    static loadSVGFile<T extends SVGAsset>(
        urlOrUuids: string[],
        options: {
            type?: any;
            metadata?: any;
        } = {}
    ): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const requestOptions: any = {
                ext: ".svg",
                ...options,
            };

            // 添加自定义元数据
            if (options.metadata) {
                requestOptions.metadata = options.metadata;
            }

            assetManager.loadAny<T>(urlOrUuids, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    /**
     * 从远程加载自定义文件
     */
    static loadRemoteCustomFile<T extends SVGAsset>(
        url: string,
        options: {
            onProgress?: (progress: number) => void;
            metadata?: any;
        } = {}
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            assetManager.loadRemote<T>(
                url,
                {
                    ext: ".svg",
                    ...options,
                },
                (err, asset) => {
                    if (err) {
                        reject(err);
                    } else if (!asset) {
                        reject(new Error("Asset is null"));
                    } else {
                        resolve(asset);
                    }
                }
            );
        });
    }

    /**
     * 保存自定义资源
     */
    static async saveSVGAsset(
        asset: SVGAsset,
        options: {
            filename?: string;
            download?: boolean;
        } = {}
    ): Promise<string | void> {
        if (!isValid(asset)) {
            throw new Error("Invalid asset");
        }

        // 生成数据字符串
        const dataStr = asset.svgContent;

        // 如果需要下载文件
        if (options.download) {
            return this.downloadFile(dataStr, options.filename || "custom-asset.svg");
        }

        // 否则返回数据字符串
        return dataStr;
    }

    /**
     * 下载文件到本地
     */
    private static downloadFile(data: string, filename: string): void {
        if (typeof window === "undefined") return;

        const blob = new Blob([data], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * 释放自定义资源
     */
    static releaseSVGAsset(asset: Asset): void {
        if (asset && isValid(asset)) {
            assetManager.releaseAsset(asset);
        }
    }

    /**
     * 获取所有已加载的自定义资源
     */
    static getLoadedSVGAssets(): SVGAsset[] {
        const assets: SVGAsset[] = [];

        // 遍历所有已加载的资源
        assetManager.assets.forEach((asset: Asset) => {
            if (asset instanceof SVGAsset) {
                assets.push(asset);
            }
        });

        return assets;
    }

    /**
     * 检查资源是否已加载
     */
    static isAssetLoaded(uuidOrUrl: string): boolean {
        return assetManager.assets.has(uuidOrUrl);
    }
}
