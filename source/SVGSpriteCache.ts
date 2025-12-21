import { _decorator, SpriteFrame, Texture2D, ImageAsset } from "cc";
const { ccclass, property, executeInEditMode, menu } = _decorator;

/**
 * SVG精灵缓存管理器
 * 提供SVG到SpriteFrame的缓存和渲染功能
 */
@ccclass("SVGSpriteCache")
@menu("2D/SVGSpriteCache")
@executeInEditMode
export class SVGSpriteCache {
    // ========== 静态配置属性 ==========

    @property({
        tooltip: "最大缓存数量",
        displayName: "最大缓存数",
    })
    private static _maxCacheSize: number = 100;

    @property({
        tooltip: "默认渲染缩放",
        displayName: "渲染缩放",
    })
    private static _defaultRenderScale: number = 1.0;

    @property({
        tooltip: "默认抗锯齿",
        displayName: "抗锯齿",
    })
    private static _defaultAntialias: boolean = true;

    @property({
        tooltip: "默认颜色",
        displayName: "默认颜色",
    })
    private static _defaultColor: string = "#ffffff";

    @property({
        tooltip: "默认保持宽高比",
        displayName: "保持宽高比",
    })
    private static _defaultPreserveAspectRatio: string = "xMidYMid meet";

    @property({
        tooltip: "启用LRU缓存淘汰",
        displayName: "LRU缓存淘汰",
    })
    private static _enableLRU: boolean = true;

    // ========== 缓存存储 ==========

    private static textureCache: Map<string, SpriteFrame> = new Map();
    private static cacheKeys: string[] = []; // 用于LRU缓存淘汰
    private static cacheHitCount: number = 0;
    private static cacheMissCount: number = 0;
    private static totalRenderTime: number = 0;
    private static memoryUsage: number = 0; // 估算的内存使用（字节）

    // ========== 公共方法 ==========

    /**
     * 获取SVG精灵帧
     * @param svgContent SVG内容字符串
     * @param width 渲染宽度
     * @param height 渲染高度
     * @param color 颜色覆盖（可选）
     * @param renderScale 渲染缩放（可选）
     * @param antialias 抗锯齿（可选）
     * @param preserveAspectRatio 保持宽高比（可选）
     * @returns Promise<SpriteFrame>
     */
    public static async getSVGSpriteFrame(
        svgContent: string,
        width: number,
        height: number,
        color?: string,
        renderScale?: number,
        antialias?: boolean,
        preserveAspectRatio?: string
    ): Promise<SpriteFrame> {
        const startTime = performance.now();

        // 使用默认值或传入值
        const finalColor = color || this._defaultColor;
        const finalRenderScale = renderScale !== undefined ? renderScale : this._defaultRenderScale;
        const finalAntialias = antialias !== undefined ? antialias : this._defaultAntialias;
        const finalPreserveAspectRatio = preserveAspectRatio || this._defaultPreserveAspectRatio;

        // 生成缓存键
        const cacheKey = this.generateCacheKey(
            svgContent,
            width,
            height,
            finalColor,
            finalRenderScale,
            finalAntialias,
            finalPreserveAspectRatio
        );

        // 检查缓存
        if (this.textureCache.has(cacheKey)) {
            this.cacheHitCount++;

            // 更新LRU顺序
            if (this._enableLRU) {
                this.updateLRUOrder(cacheKey);
            }

            const endTime = performance.now();
            this.totalRenderTime += endTime - startTime;

            return this.textureCache.get(cacheKey)!;
        }

        this.cacheMissCount++;

        // 创建新的SpriteFrame
        const spriteFrame = await this.createSVGSpriteFrame(
            svgContent,
            width,
            height,
            finalColor,
            finalRenderScale,
            finalAntialias,
            finalPreserveAspectRatio
        );

        // 缓存管理
        this.cacheSpriteFrame(cacheKey, spriteFrame, width, height);

        const endTime = performance.now();
        this.totalRenderTime += endTime - startTime;

        return spriteFrame;
    }

    /**
     * 获取简化版SVG精灵帧（正方形）
     * @param svgContent SVG内容字符串
     * @param size 尺寸（宽高相同）
     * @param color 颜色（可选）
     * @returns Promise<SpriteFrame>
     */
    public static async getSimpleSVGSpriteFrame(svgContent: string, size: number, color?: string): Promise<SpriteFrame> {
        return this.getSVGSpriteFrame(svgContent, size, size, color);
    }

    /**
     * 预加载多个SVG到缓存
     * @param svgContents SVG内容数组
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     * @returns Promise<void>
     */
    public static async preloadSVGs(svgContents: string[], width: number, height: number, color?: string): Promise<void> {
        const promises = svgContents.map((svgContent) => this.getSVGSpriteFrame(svgContent, width, height, color));

        await Promise.all(promises);
    }

    /**
     * 清除指定缓存
     * @param key 缓存键
     */
    public static clearCacheByKey(key: string): void {
        if (this.textureCache.has(key)) {
            const spriteFrame = this.textureCache.get(key)!;
            // 释放纹理资源
            if (spriteFrame.texture) {
                spriteFrame.texture.destroy();
            }
            this.textureCache.delete(key);

            // 从LRU列表中移除
            const index = this.cacheKeys.indexOf(key);
            if (index > -1) {
                this.cacheKeys.splice(index, 1);
            }

            // 更新内存使用估算
            this.updateMemoryUsage();
        }
    }

    /**
     * 清除所有缓存
     */
    public static clearAllCache(): void {
        // 释放所有纹理资源
        this.textureCache.forEach((spriteFrame) => {
            if (spriteFrame.texture) {
                spriteFrame.texture.destroy();
            }
        });

        this.textureCache.clear();
        this.cacheKeys = [];
        this.cacheHitCount = 0;
        this.cacheMissCount = 0;
        this.totalRenderTime = 0;
        this.memoryUsage = 0;
    }

    /**
     * 获取缓存统计信息
     * @returns 缓存统计对象
     */
    public static getCacheStats(): {
        size: number;
        hitRate: number;
        totalRenderTime: number;
        memoryUsage: number;
        hitCount: number;
        missCount: number;
    } {
        const totalRequests = this.cacheHitCount + this.cacheMissCount;
        const hitRate = totalRequests > 0 ? (this.cacheHitCount / totalRequests) * 100 : 0;

        return {
            size: this.textureCache.size,
            hitRate: parseFloat(hitRate.toFixed(2)),
            totalRenderTime: parseFloat(this.totalRenderTime.toFixed(2)),
            memoryUsage: this.memoryUsage,
            hitCount: this.cacheHitCount,
            missCount: this.cacheMissCount,
        };
    }

    /**
     * 设置默认配置
     * @param config 配置对象
     */
    public static setDefaultConfig(config: {
        maxCacheSize?: number;
        renderScale?: number;
        antialias?: boolean;
        defaultColor?: string;
        preserveAspectRatio?: string;
        enableLRU?: boolean;
    }): void {
        if (config.maxCacheSize !== undefined) {
            this._maxCacheSize = config.maxCacheSize;
            this.manageCacheSize();
        }
        if (config.renderScale !== undefined) {
            this._defaultRenderScale = config.renderScale;
        }
        if (config.antialias !== undefined) {
            this._defaultAntialias = config.antialias;
        }
        if (config.defaultColor !== undefined) {
            this._defaultColor = config.defaultColor;
        }
        if (config.preserveAspectRatio !== undefined) {
            this._defaultPreserveAspectRatio = config.preserveAspectRatio;
        }
        if (config.enableLRU !== undefined) {
            this._enableLRU = config.enableLRU;
        }
    }

    /**
     * 获取当前配置
     * @returns 配置对象
     */
    public static getCurrentConfig(): {
        maxCacheSize: number;
        renderScale: number;
        antialias: boolean;
        defaultColor: string;
        preserveAspectRatio: string;
        enableLRU: boolean;
    } {
        return {
            maxCacheSize: this._maxCacheSize,
            renderScale: this._defaultRenderScale,
            antialias: this._defaultAntialias,
            defaultColor: this._defaultColor,
            preserveAspectRatio: this._defaultPreserveAspectRatio,
            enableLRU: this._enableLRU,
        };
    }

    /**
     * 根据SVG内容获取缓存键（如果存在）
     * @param svgContent SVG内容
     * @returns 缓存键或null
     */
    public static findCacheKeyBySVG(svgContent: string): string | null {
        for (const [key, _] of this.textureCache) {
            if (key.includes(this.calculateSVGHash(svgContent))) {
                return key;
            }
        }
        return null;
    }

    // ========== 私有方法 ==========

    /**
     * 生成缓存键
     */
    private static generateCacheKey(
        svgContent: string,
        width: number,
        height: number,
        color: string,
        renderScale: number,
        antialias: boolean,
        preserveAspectRatio: string
    ): string {
        const svgHash = this.calculateSVGHash(svgContent);
        return `${svgHash}_${width}x${height}_${color}_${renderScale}_${antialias}_${preserveAspectRatio}`;
    }

    /**
     * 计算SVG哈希
     */
    private static calculateSVGHash(svgContent: string): string {
        // 简单哈希函数，实际项目中可以使用更复杂的哈希算法
        let hash = 0;
        for (let i = 0; i < svgContent.length; i++) {
            const char = svgContent.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * 创建SVG精灵帧
     */
    private static async createSVGSpriteFrame(
        svgContent: string,
        width: number,
        height: number,
        color: string,
        renderScale: number,
        antialias: boolean,
        preserveAspectRatio: string
    ): Promise<SpriteFrame> {
        // 验证SVG内容
        if (!svgContent || svgContent.trim().length === 0) {
            throw new Error("SVG内容不能为空");
        }

        // 创建Canvas
        const canvas = document.createElement("canvas");
        const renderWidth = Math.floor(width * renderScale);
        const renderHeight = Math.floor(height * renderScale);
        canvas.width = renderWidth;
        canvas.height = renderHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("无法获取Canvas 2D上下文");
        }

        // 设置抗锯齿
        if (antialias) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
        }

        // 准备SVG字符串
        let svgToRender = svgContent;

        // 应用颜色覆盖
        if (color !== "#ffffff") {
            svgToRender = this.applyColorOverride(svgToRender, color);
        }

        // 设置SVG尺寸
        svgToRender = this.setSVGDimensions(svgToRender, width, height, preserveAspectRatio);

        // 渲染SVG到Canvas
        await this.renderSVGToCanvas(svgToRender, canvas);

        // 创建ImageAsset和Texture2D
        const imageAsset = new ImageAsset(canvas);
        const texture = new Texture2D();
        texture.image = imageAsset;

        // 创建SpriteFrame
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;

        return spriteFrame;
    }

    /**
     * 应用颜色覆盖
     */
    private static applyColorOverride(svgString: string, color: string): string {
        // 简单的颜色替换：将所有fill属性（除了"none"）替换为指定颜色
        return svgString.replace(/fill="([^"]*)"/g, (match, fillValue) => {
            if (fillValue === "none" || fillValue === "transparent") {
                return match; // 保持透明填充不变
            }
            return `fill="${color}"`;
        });
    }

    /**
     * 设置SVG尺寸
     */
    private static setSVGDimensions(svgString: string, width: number, height: number, preserveAspectRatio: string): string {
        let result = svgString;

        // 更新width属性
        if (result.includes('width="')) {
            result = result.replace(/width="[^"]*"/, `width="${width}"`);
        } else {
            result = result.replace(/<svg/, `<svg width="${width}"`);
        }

        // 更新height属性
        if (result.includes('height="')) {
            result = result.replace(/height="[^"]*"/, `height="${height}"`);
        } else {
            result = result.replace(/<svg/, `<svg height="${height}"`);
        }

        // 添加或更新preserveAspectRatio
        if (result.includes('preserveAspectRatio="')) {
            result = result.replace(/preserveAspectRatio="[^"]*"/, `preserveAspectRatio="${preserveAspectRatio}"`);
        } else {
            result = result.replace(/<svg/, `<svg preserveAspectRatio="${preserveAspectRatio}"`);
        }

        return result;
    }

    /**
     * 渲染SVG到Canvas
     */
    private static renderSVGToCanvas(svgString: string, canvas: HTMLCanvasElement): Promise<void> {
        return new Promise((resolve, reject) => {
            const ctx = canvas.getContext("2d")!;

            // 创建Blob和URL
            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                // 清空画布
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // 绘制SVG
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 清理URL
                URL.revokeObjectURL(url);
                resolve();
            };

            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(new Error(`SVG渲染失败: ${error}`));
            };

            img.src = url;
        });
    }

    /**
     * 缓存精灵帧
     */
    private static cacheSpriteFrame(key: string, spriteFrame: SpriteFrame, width: number, height: number): void {
        // 检查缓存大小
        if (this.textureCache.size >= this._maxCacheSize && this._enableLRU) {
            this.evictLRUCache();
        }

        // 添加到缓存
        this.textureCache.set(key, spriteFrame);

        // 更新LRU列表
        if (this._enableLRU) {
            this.cacheKeys.push(key);
        }

        // 更新内存使用估算（假设每个像素4字节，RGBA）
        const estimatedMemory = width * height * 4;
        this.memoryUsage += estimatedMemory;
    }

    /**
     * 更新LRU顺序
     */
    private static updateLRUOrder(key: string): void {
        if (!this._enableLRU) return;

        const index = this.cacheKeys.indexOf(key);
        if (index > -1) {
            // 移动到列表末尾（最近使用）
            this.cacheKeys.splice(index, 1);
            this.cacheKeys.push(key);
        }
    }

    /**
     * 淘汰LRU缓存
     */
    private static evictLRUCache(): void {
        if (this.cacheKeys.length === 0) return;

        // 移除最久未使用的缓存（列表第一个）
        const oldestKey = this.cacheKeys.shift()!;
        this.clearCacheByKey(oldestKey);
    }

    /**
     * 管理缓存大小
     */
    private static manageCacheSize(): void {
        if (!this._enableLRU) return;

        while (this.textureCache.size > this._maxCacheSize && this.cacheKeys.length > 0) {
            this.evictLRUCache();
        }
    }

    /**
     * 更新内存使用估算
     */
    private static updateMemoryUsage(): void {
        let totalMemory = 0;

        this.textureCache.forEach((spriteFrame, key) => {
            // 从缓存键中提取尺寸信息
            const sizeMatch = key.match(/_(\d+)x(\d+)_/);
            if (sizeMatch) {
                const width = parseInt(sizeMatch[1]);
                const height = parseInt(sizeMatch[2]);
                totalMemory += width * height * 4; // 每个像素4字节（RGBA）
            }
        });

        this.memoryUsage = totalMemory;
    }
}
