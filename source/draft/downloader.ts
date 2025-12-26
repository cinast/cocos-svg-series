// scripts/CustomFileDownloader.ts
import { assetManager, Asset } from "cc";

export class SVGFileDownloader {
    static init() {
        assetManager.downloader.register(".svg", this.handleDownload.bind(this));
    }

    /**
     * 自定义下载处理器
     */
    private static handleDownload(
        url: string,
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        // 如果是本地文件（file:// 协议）
        if (url.startsWith("file://")) {
            this.loadLocalFile(url, options, onComplete);
        }
        // 如果是远程文件
        else if (url.startsWith("http")) {
            this.loadRemoteFile(url, options, onComplete);
        }
        // 项目内资源（db://）
        else if (url.startsWith("db://")) {
            this.loadInternalAsset(url, options, onComplete);
        } else {
            // 使用默认的下载器
            assetManager.downloader.downloadFile(url, options, undefined, onComplete);
        }
    }

    /**
     * 加载本地文件
     */
    private static loadLocalFile(url: string, options: Record<string, any>, onComplete: (err: Error | null, data?: any) => void) {
        // 移除 file:// 前缀
        const filePath = url.replace("file://", "");

        // 在 Web 环境中使用 XMLHttpRequest
        if (typeof window !== "undefined") {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", filePath, true);
            xhr.responseType = "text";

            xhr.onload = () => {
                if (xhr.status === 200) {
                    onComplete(null, xhr.responseText);
                } else {
                    onComplete(new Error(`Failed to load file: ${xhr.status}`));
                }
            };

            xhr.onerror = () => {
                onComplete(new Error("Network error"));
            };

            xhr.send();
        } else {
            // Node.js 环境
            const fs = require("fs");
            fs.readFile(filePath, "utf8", (err: Error, data: string) => {
                if (err) {
                    onComplete(err);
                } else {
                    onComplete(null, data);
                }
            });
        }
    }

    /**
     * 加载远程文件
     */
    private static loadRemoteFile(
        url: string,
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        // 使用默认的下载器，但可以添加自定义逻辑
        const defaultHandler = assetManager.downloader.downloadFile;
        defaultHandler(
            url,
            {
                ...options,
                xhrResponseType: "text", // 确保返回文本
                xhrHeader: {
                    "Content-Type": "text/plain",
                    ...options.xhrHeader,
                },
            },
            undefined,
            onComplete
        );
    }

    /**
     * 加载项目内资源（通过uuid）
     */
    private static loadInternalAsset(
        url: string,
        options: Record<string, any>,
        onComplete: (err: Error | null, data?: any) => void
    ) {
        // 转换 db:// 为可访问的 URL
        // 注意：在实际项目中，这需要结合项目的资源管理系统
        console.log("Loading internal asset:", url);
        onComplete(new Error("Internal asset loading not implemented"));
    }
}
