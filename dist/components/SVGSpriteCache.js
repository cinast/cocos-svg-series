"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGSpriteCache = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, menu } = cc_1._decorator;
/**
 * SVG精灵缓存管理器
 * 提供SVG到SpriteFrame的缓存和渲染功能
 */
let SVGSpriteCache = class SVGSpriteCache extends cc_1.Component {
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
    static async getSVGSpriteFrame(svgContent, width, height, color, renderScale, antialias, preserveAspectRatio) {
        const startTime = performance.now();
        // 使用默认值或传入值
        const finalColor = color || this._defaultColor;
        const finalRenderScale = renderScale !== undefined ? renderScale : this._defaultRenderScale;
        const finalAntialias = antialias !== undefined ? antialias : this._defaultAntialias;
        const finalPreserveAspectRatio = preserveAspectRatio || this._defaultPreserveAspectRatio;
        // 生成缓存键
        const cacheKey = this.generateCacheKey(svgContent, width, height, finalColor, finalRenderScale, finalAntialias, finalPreserveAspectRatio);
        // 检查缓存
        if (this.textureCache.has(cacheKey)) {
            this.cacheHitCount++;
            // 更新LRU顺序
            if (this._enableLRU) {
                this.updateLRUOrder(cacheKey);
            }
            const endTime = performance.now();
            this.totalRenderTime += endTime - startTime;
            return this.textureCache.get(cacheKey);
        }
        this.cacheMissCount++;
        // 创建新的SpriteFrame
        const spriteFrame = await this.createSVGSpriteFrame(svgContent, width, height, finalColor, finalRenderScale, finalAntialias, finalPreserveAspectRatio);
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
    static async getSimpleSVGSpriteFrame(svgContent, size, color) {
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
    static async preloadSVGs(svgContents, width, height, color) {
        const promises = svgContents.map((svgContent) => this.getSVGSpriteFrame(svgContent, width, height, color));
        await Promise.all(promises);
    }
    /**
     * 清除指定缓存
     * @param key 缓存键
     */
    static clearCacheByKey(key) {
        if (this.textureCache.has(key)) {
            const spriteFrame = this.textureCache.get(key);
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
    static clearAllCache() {
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
    static getCacheStats() {
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
    static setDefaultConfig(config) {
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
    static getCurrentConfig() {
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
    static findCacheKeyBySVG(svgContent) {
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
    static generateCacheKey(svgContent, width, height, color, renderScale, antialias, preserveAspectRatio) {
        const svgHash = this.calculateSVGHash(svgContent);
        return `${svgHash}_${width}x${height}_${color}_${renderScale}_${antialias}_${preserveAspectRatio}`;
    }
    /**
     * 计算SVG哈希
     */
    static calculateSVGHash(svgContent) {
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
    static async createSVGSpriteFrame(svgContent, width, height, color, renderScale, antialias, preserveAspectRatio) {
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
        const imageAsset = new cc_1.ImageAsset(canvas);
        const texture = new cc_1.Texture2D();
        texture.image = imageAsset;
        // 创建SpriteFrame
        const spriteFrame = new cc_1.SpriteFrame();
        spriteFrame.texture = texture;
        return spriteFrame;
    }
    /**
     * 应用颜色覆盖
     */
    static applyColorOverride(svgString, color) {
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
    static setSVGDimensions(svgString, width, height, preserveAspectRatio) {
        let result = svgString;
        // 更新width属性
        if (result.includes('width="')) {
            result = result.replace(/width="[^"]*"/, `width="${width}"`);
        }
        else {
            result = result.replace(/<svg/, `<svg width="${width}"`);
        }
        // 更新height属性
        if (result.includes('height="')) {
            result = result.replace(/height="[^"]*"/, `height="${height}"`);
        }
        else {
            result = result.replace(/<svg/, `<svg height="${height}"`);
        }
        // 添加或更新preserveAspectRatio
        if (result.includes('preserveAspectRatio="')) {
            result = result.replace(/preserveAspectRatio="[^"]*"/, `preserveAspectRatio="${preserveAspectRatio}"`);
        }
        else {
            result = result.replace(/<svg/, `<svg preserveAspectRatio="${preserveAspectRatio}"`);
        }
        return result;
    }
    /**
     * 渲染SVG到Canvas
     */
    static renderSVGToCanvas(svgString, canvas) {
        return new Promise((resolve, reject) => {
            const ctx = canvas.getContext("2d");
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
    static cacheSpriteFrame(key, spriteFrame, width, height) {
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
    static updateLRUOrder(key) {
        if (!this._enableLRU)
            return;
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
    static evictLRUCache() {
        if (this.cacheKeys.length === 0)
            return;
        // 移除最久未使用的缓存（列表第一个）
        const oldestKey = this.cacheKeys.shift();
        this.clearCacheByKey(oldestKey);
    }
    /**
     * 管理缓存大小
     */
    static manageCacheSize() {
        if (!this._enableLRU)
            return;
        while (this.textureCache.size > this._maxCacheSize && this.cacheKeys.length > 0) {
            this.evictLRUCache();
        }
    }
    /**
     * 更新内存使用估算
     */
    static updateMemoryUsage() {
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
};
exports.SVGSpriteCache = SVGSpriteCache;
// ========== 静态配置属性 ==========
SVGSpriteCache._maxCacheSize = 100;
SVGSpriteCache._defaultRenderScale = 1.0;
SVGSpriteCache._defaultAntialias = true;
SVGSpriteCache._defaultColor = "#ffffff";
SVGSpriteCache._defaultPreserveAspectRatio = "xMidYMid meet";
SVGSpriteCache._enableLRU = true;
// ========== 缓存存储 ==========
SVGSpriteCache.textureCache = new Map();
SVGSpriteCache.cacheKeys = []; // 用于LRU缓存淘汰
SVGSpriteCache.cacheHitCount = 0;
SVGSpriteCache.cacheMissCount = 0;
SVGSpriteCache.totalRenderTime = 0;
SVGSpriteCache.memoryUsage = 0; // 估算的内存使用（字节）
__decorate([
    property({
        tooltip: "最大缓存数量",
        displayName: "最大缓存数",
    })
], SVGSpriteCache, "_maxCacheSize", void 0);
__decorate([
    property({
        tooltip: "默认渲染缩放",
        displayName: "渲染缩放",
    })
], SVGSpriteCache, "_defaultRenderScale", void 0);
__decorate([
    property({
        tooltip: "默认抗锯齿",
        displayName: "抗锯齿",
    })
], SVGSpriteCache, "_defaultAntialias", void 0);
__decorate([
    property({
        tooltip: "默认颜色",
        displayName: "默认颜色",
    })
], SVGSpriteCache, "_defaultColor", void 0);
__decorate([
    property({
        tooltip: "默认保持宽高比",
        displayName: "保持宽高比",
    })
], SVGSpriteCache, "_defaultPreserveAspectRatio", void 0);
__decorate([
    property({
        tooltip: "启用LRU缓存淘汰",
        displayName: "LRU缓存淘汰",
    })
], SVGSpriteCache, "_enableLRU", void 0);
exports.SVGSpriteCache = SVGSpriteCache = __decorate([
    ccclass("SVGSpriteCache"),
    menu("2D/SVGSpriteCache"),
    executeInEditMode
], SVGSpriteCache);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHU3ByaXRlQ2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvY29tcG9uZW50cy9TVkdTcHJpdGVDYWNoZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSwyQkFBK0U7QUFDL0UsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBVSxDQUFDO0FBRWxFOzs7R0FHRztBQUlJLElBQU0sY0FBYyxHQUFwQixNQUFNLGNBQWUsU0FBUSxjQUFTO0lBZ0R6Qyw2QkFBNkI7SUFFN0I7Ozs7Ozs7Ozs7T0FVRztJQUNJLE1BQU0sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQ2pDLFVBQWtCLEVBQ2xCLEtBQWEsRUFDYixNQUFjLEVBQ2QsS0FBYyxFQUNkLFdBQW9CLEVBQ3BCLFNBQW1CLEVBQ25CLG1CQUE0QjtRQUU1QixNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFcEMsWUFBWTtRQUNaLE1BQU0sVUFBVSxHQUFHLEtBQUssSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQy9DLE1BQU0sZ0JBQWdCLEdBQUcsV0FBVyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUM7UUFDNUYsTUFBTSxjQUFjLEdBQUcsU0FBUyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDcEYsTUFBTSx3QkFBd0IsR0FBRyxtQkFBbUIsSUFBSSxJQUFJLENBQUMsMkJBQTJCLENBQUM7UUFFekYsUUFBUTtRQUNSLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FDbEMsVUFBVSxFQUNWLEtBQUssRUFDTCxNQUFNLEVBQ04sVUFBVSxFQUNWLGdCQUFnQixFQUNoQixjQUFjLEVBQ2Qsd0JB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LFdBQVc7UUFDcEIsV0FBVyxFQUFFLFNBQVM7S0FDekIsQ0FBQzt3Q0FDd0M7eUJBckNqQyxjQUFjO0lBSDFCLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztJQUN6QixJQUFJLENBQUMsbUJBQW1CLENBQUM7SUFDekIsaUJBQWlCO0dBQ0wsY0FBYyxDQXFoQjFCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgX2RlY29yYXRvciwgU3ByaXRlRnJhbWUsIFRleHR1cmUyRCwgSW1hZ2VBc3NldCwgQ29tcG9uZW50IH0gZnJvbSBcImNjXCI7XG5jb25zdCB7IGNjY2xhc3MsIHByb3BlcnR5LCBleGVjdXRlSW5FZGl0TW9kZSwgbWVudSB9ID0gX2RlY29yYXRvcjtcblxuLyoqXG4gKiBTVkfnsr7ngbXnvJPlrZjnrqHnkIblmahcbiAqIOaPkOS+m1NWR+WIsFNwcml0ZUZyYW1l55qE57yT5a2Y5ZKM5riy5p+T5Yqf6IO9XG4gKi9cbkBjY2NsYXNzKFwiU1ZHU3ByaXRlQ2FjaGVcIilcbkBtZW51KFwiMkQvU1ZHU3ByaXRlQ2FjaGVcIilcbkBleGVjdXRlSW5FZGl0TW9kZVxuZXhwb3J0IGNsYXNzIFNWR1Nwcml0ZUNhY2hlIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvLyA9PT09PT09PT09IOmdmeaAgemFjee9ruWxnuaApyA9PT09PT09PT09XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIuacgOWkp+e8k+WtmOaVsOmHj1wiLFxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmnIDlpKfnvJPlrZjmlbBcIixcbiAgICB9KVxuICAgIHByaXZhdGUgc3RhdGljIF9tYXhDYWNoZVNpemU6IG51bWJlciA9IDEwMDtcblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi6buY6K6k5riy5p+T57yp5pS+XCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIua4suafk+e8qeaUvlwiLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBzdGF0aWMgX2RlZmF1bHRSZW5kZXJTY2FsZTogbnVtYmVyID0gMS4wO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLpu5jorqTmipfplK/pvb9cIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5oqX6ZSv6b2/XCIsXG4gICAgfSlcbiAgICBwcml2YXRlIHN0YXRpYyBfZGVmYXVsdEFudGlhbGlhczogYm9vbGVhbiA9IHRydWU7XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIum7mOiupOminOiJslwiLFxuICAgICAgICBkaXNwbGF5TmFtZTogXCLpu5jorqTpopzoibJcIixcbiAgICB9KVxuICAgIHByaXZhdGUgc3RhdGljIF9kZWZhdWx0Q29sb3I6IHN0cmluZyA9IFwiI2ZmZmZmZlwiO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLpu5jorqTkv53mjIHlrr3pq5jmr5RcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5L+d5oyB5a696auY5q+UXCIsXG4gICAgfSlcbiAgICBwcml2YXRlIHN0YXRpYyBfZGVmYXVsdFByZXNlcnZlQXNwZWN0UmF0aW86IHN0cmluZyA9IFwieE1pZFlNaWQgbWVldFwiO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKhMUlXnvJPlrZjmt5jmsbBcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwiTFJV57yT5a2Y5reY5rGwXCIsXG4gICAgfSlcbiAgICBwcml2YXRlIHN0YXRpYyBfZW5hYmxlTFJVOiBib29sZWFuID0gdHJ1ZTtcblxuICAgIC8vID09PT09PT09PT0g57yT5a2Y5a2Y5YKoID09PT09PT09PT1cblxuICAgIHByaXZhdGUgc3RhdGljIHRleHR1cmVDYWNoZTogTWFwPHN0cmluZywgU3ByaXRlRnJhbWU+ID0gbmV3IE1hcCgpO1xuICAgIHByaXZhdGUgc3RhdGljIGNhY2hlS2V5czogc3RyaW5nW10gPSBbXTsgLy8g55So5LqOTFJV57yT5a2Y5reY5rGwXG4gICAgcHJpdmF0ZSBzdGF0aWMgY2FjaGVIaXRDb3VudDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHN0YXRpYyBjYWNoZU1pc3NDb3VudDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHN0YXRpYyB0b3RhbFJlbmRlclRpbWU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBzdGF0aWMgbWVtb3J5VXNhZ2U6IG51bWJlciA9IDA7IC8vIOS8sOeul+eahOWGheWtmOS9v+eUqO+8iOWtl+iKgu+8iVxuXG4gICAgLy8gPT09PT09PT09PSDlhazlhbHmlrnms5UgPT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog6I635Y+WU1ZH57K+54G15binXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnQgU1ZH5YaF5a655a2X56ym5LiyXG4gICAgICogQHBhcmFtIHdpZHRoIOa4suafk+WuveW6plxuICAgICAqIEBwYXJhbSBoZWlnaHQg5riy5p+T6auY5bqmXG4gICAgICogQHBhcmFtIGNvbG9yIOminOiJsuimhueblu+8iOWPr+mAie+8iVxuICAgICAqIEBwYXJhbSByZW5kZXJTY2FsZSDmuLLmn5PnvKnmlL7vvIjlj6/pgInvvIlcbiAgICAgKiBAcGFyYW0gYW50aWFsaWFzIOaKl+mUr+m9v++8iOWPr+mAie+8iVxuICAgICAqIEBwYXJhbSBwcmVzZXJ2ZUFzcGVjdFJhdGlvIOS/neaMgeWuvemrmOavlO+8iOWPr+mAie+8iVxuICAgICAqIEByZXR1cm5zIFByb21pc2U8U3ByaXRlRnJhbWU+XG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRTVkdTcHJpdGVGcmFtZShcbiAgICAgICAgc3ZnQ29udGVudDogc3RyaW5nLFxuICAgICAgICB3aWR0aDogbnVtYmVyLFxuICAgICAgICBoZWlnaHQ6IG51bWJlcixcbiAgICAgICAgY29sb3I/OiBzdHJpbmcsXG4gICAgICAgIHJlbmRlclNjYWxlPzogbnVtYmVyLFxuICAgICAgICBhbnRpYWxpYXM/OiBib29sZWFuLFxuICAgICAgICBwcmVzZXJ2ZUFzcGVjdFJhdGlvPzogc3RyaW5nXG4gICAgKTogUHJvbWlzZTxTcHJpdGVGcmFtZT4ge1xuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuICAgICAgICAvLyDkvb/nlKjpu5jorqTlgLzmiJbkvKDlhaXlgLxcbiAgICAgICAgY29uc3QgZmluYWxDb2xvciA9IGNvbG9yIHx8IHRoaXMuX2RlZmF1bHRDb2xvcjtcbiAgICAgICAgY29uc3QgZmluYWxSZW5kZXJTY2FsZSA9IHJlbmRlclNjYWxlICE9PSB1bmRlZmluZWQgPyByZW5kZXJTY2FsZSA6IHRoaXMuX2RlZmF1bHRSZW5kZXJTY2FsZTtcbiAgICAgICAgY29uc3QgZmluYWxBbnRpYWxpYXMgPSBhbnRpYWxpYXMgIT09IHVuZGVmaW5lZCA/IGFudGlhbGlhcyA6IHRoaXMuX2RlZmF1bHRBbnRpYWxpYXM7XG4gICAgICAgIGNvbnN0IGZpbmFsUHJlc2VydmVBc3BlY3RSYXRpbyA9IHByZXNlcnZlQXNwZWN0UmF0aW8gfHwgdGhpcy5fZGVmYXVsdFByZXNlcnZlQXNwZWN0UmF0aW87XG5cbiAgICAgICAgLy8g55Sf5oiQ57yT5a2Y6ZSuXG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gdGhpcy5nZW5lcmF0ZUNhY2hlS2V5KFxuICAgICAgICAgICAgc3ZnQ29udGVudCxcbiAgICAgICAgICAgIHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0LFxuICAgICAgICAgICAgZmluYWxDb2xvcixcbiAgICAgICAgICAgIGZpbmFsUmVuZGVyU2NhbGUsXG4gICAgICAgICAgICBmaW5hbEFudGlhbGlhcyxcbiAgICAgICAgICAgIGZpbmFsUHJlc2VydmVBc3BlY3RSYXRpb1xuICAgICAgICApO1xuXG4gICAgICAgIC8vIOajgOafpee8k+WtmFxuICAgICAgICBpZiAodGhpcy50ZXh0dXJlQ2FjaGUuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgICAgICAgdGhpcy5jYWNoZUhpdENvdW50Kys7XG5cbiAgICAgICAgICAgIC8vIOabtOaWsExSVemhuuW6j1xuICAgICAgICAgICAgaWYgKHRoaXMuX2VuYWJsZUxSVSkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTFJVT3JkZXIoY2FjaGVLZXkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBlbmRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgICB0aGlzLnRvdGFsUmVuZGVyVGltZSArPSBlbmRUaW1lIC0gc3RhcnRUaW1lO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy50ZXh0dXJlQ2FjaGUuZ2V0KGNhY2hlS2V5KSE7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNhY2hlTWlzc0NvdW50Kys7XG5cbiAgICAgICAgLy8g5Yib5bu65paw55qEU3ByaXRlRnJhbWVcbiAgICAgICAgY29uc3Qgc3ByaXRlRnJhbWUgPSBhd2FpdCB0aGlzLmNyZWF0ZVNWR1Nwcml0ZUZyYW1lKFxuICAgICAgICAgICAgc3ZnQ29udGVudCxcbiAgICAgICAgICAgIHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0LFxuICAgICAgICAgICAgZmluYWxDb2xvcixcbiAgICAgICAgICAgIGZpbmFsUmVuZGVyU2NhbGUsXG4gICAgICAgICAgICBmaW5hbEFudGlhbGlhcyxcbiAgICAgICAgICAgIGZpbmFsUHJlc2VydmVBc3BlY3RSYXRpb1xuICAgICAgICApO1xuXG4gICAgICAgIC8vIOe8k+WtmOeuoeeQhlxuICAgICAgICB0aGlzLmNhY2hlU3ByaXRlRnJhbWUoY2FjaGVLZXksIHNwcml0ZUZyYW1lLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICBjb25zdCBlbmRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMudG90YWxSZW5kZXJUaW1lICs9IGVuZFRpbWUgLSBzdGFydFRpbWU7XG5cbiAgICAgICAgcmV0dXJuIHNwcml0ZUZyYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiOt+WPlueugOWMlueJiFNWR+eyvueBteW4p++8iOato+aWueW9ou+8iVxuICAgICAqIEBwYXJhbSBzdmdDb250ZW50IFNWR+WGheWuueWtl+espuS4slxuICAgICAqIEBwYXJhbSBzaXplIOWwuuWvuO+8iOWuvemrmOebuOWQjO+8iVxuICAgICAqIEBwYXJhbSBjb2xvciDpopzoibLvvIjlj6/pgInvvIlcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlPFNwcml0ZUZyYW1lPlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0U2ltcGxlU1ZHU3ByaXRlRnJhbWUoc3ZnQ29udGVudDogc3RyaW5nLCBzaXplOiBudW1iZXIsIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTxTcHJpdGVGcmFtZT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRTVkdTcHJpdGVGcmFtZShzdmdDb250ZW50LCBzaXplLCBzaXplLCBjb2xvcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog6aKE5Yqg6L295aSa5LiqU1ZH5Yiw57yT5a2YXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnRzIFNWR+WGheWuueaVsOe7hFxuICAgICAqIEBwYXJhbSB3aWR0aCDlrr3luqZcbiAgICAgKiBAcGFyYW0gaGVpZ2h0IOmrmOW6plxuICAgICAqIEBwYXJhbSBjb2xvciDpopzoibLvvIjlj6/pgInvvIlcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlPHZvaWQ+XG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyBwcmVsb2FkU1ZHcyhzdmdDb250ZW50czogc3RyaW5nW10sIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBjb2xvcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBwcm9taXNlcyA9IHN2Z0NvbnRlbnRzLm1hcCgoc3ZnQ29udGVudCkgPT4gdGhpcy5nZXRTVkdTcHJpdGVGcmFtZShzdmdDb250ZW50LCB3aWR0aCwgaGVpZ2h0LCBjb2xvcikpO1xuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmuIXpmaTmjIflrprnvJPlrZhcbiAgICAgKiBAcGFyYW0ga2V5IOe8k+WtmOmUrlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgY2xlYXJDYWNoZUJ5S2V5KGtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVDYWNoZS5oYXMoa2V5KSkge1xuICAgICAgICAgICAgY29uc3Qgc3ByaXRlRnJhbWUgPSB0aGlzLnRleHR1cmVDYWNoZS5nZXQoa2V5KSE7XG4gICAgICAgICAgICAvLyDph4rmlL7nurnnkIbotYTmupBcbiAgICAgICAgICAgIGlmIChzcHJpdGVGcmFtZS50ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgc3ByaXRlRnJhbWUudGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVDYWNoZS5kZWxldGUoa2V5KTtcblxuICAgICAgICAgICAgLy8g5LuOTFJV5YiX6KGo5Lit56e76ZmkXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FjaGVLZXlzLmluZGV4T2Yoa2V5KTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jYWNoZUtleXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8g5pu05paw5YaF5a2Y5L2/55So5Lyw566XXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1lbW9yeVVzYWdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmuIXpmaTmiYDmnInnvJPlrZhcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGNsZWFyQWxsQ2FjaGUoKTogdm9pZCB7XG4gICAgICAgIC8vIOmHiuaUvuaJgOaciee6ueeQhui1hOa6kFxuICAgICAgICB0aGlzLnRleHR1cmVDYWNoZS5mb3JFYWNoKChzcHJpdGVGcmFtZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNwcml0ZUZyYW1lLnRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICBzcHJpdGVGcmFtZS50ZXh0dXJlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy50ZXh0dXJlQ2FjaGUuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5jYWNoZUtleXMgPSBbXTtcbiAgICAgICAgdGhpcy5jYWNoZUhpdENvdW50ID0gMDtcbiAgICAgICAgdGhpcy5jYWNoZU1pc3NDb3VudCA9IDA7XG4gICAgICAgIHRoaXMudG90YWxSZW5kZXJUaW1lID0gMDtcbiAgICAgICAgdGhpcy5tZW1vcnlVc2FnZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog6I635Y+W57yT5a2Y57uf6K6h5L+h5oGvXG4gICAgICogQHJldHVybnMg57yT5a2Y57uf6K6h5a+56LGhXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBnZXRDYWNoZVN0YXRzKCk6IHtcbiAgICAgICAgc2l6ZTogbnVtYmVyO1xuICAgICAgICBoaXRSYXRlOiBudW1iZXI7XG4gICAgICAgIHRvdGFsUmVuZGVyVGltZTogbnVtYmVyO1xuICAgICAgICBtZW1vcnlVc2FnZTogbnVtYmVyO1xuICAgICAgICBoaXRDb3VudDogbnVtYmVyO1xuICAgICAgICBtaXNzQ291bnQ6IG51bWJlcjtcbiAgICB9IHtcbiAgICAgICAgY29uc3QgdG90YWxSZXF1ZXN0cyA9IHRoaXMuY2FjaGVIaXRDb3VudCArIHRoaXMuY2FjaGVNaXNzQ291bnQ7XG4gICAgICAgIGNvbnN0IGhpdFJhdGUgPSB0b3RhbFJlcXVlc3RzID4gMCA/ICh0aGlzLmNhY2hlSGl0Q291bnQgLyB0b3RhbFJlcXVlc3RzKSAqIDEwMCA6IDA7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNpemU6IHRoaXMudGV4dHVyZUNhY2hlLnNpemUsXG4gICAgICAgICAgICBoaXRSYXRlOiBwYXJzZUZsb2F0KGhpdFJhdGUudG9GaXhlZCgyKSksXG4gICAgICAgICAgICB0b3RhbFJlbmRlclRpbWU6IHBhcnNlRmxvYXQodGhpcy50b3RhbFJlbmRlclRpbWUudG9GaXhlZCgyKSksXG4gICAgICAgICAgICBtZW1vcnlVc2FnZTogdGhpcy5tZW1vcnlVc2FnZSxcbiAgICAgICAgICAgIGhpdENvdW50OiB0aGlzLmNhY2hlSGl0Q291bnQsXG4gICAgICAgICAgICBtaXNzQ291bnQ6IHRoaXMuY2FjaGVNaXNzQ291bnQsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog6K6+572u6buY6K6k6YWN572uXG4gICAgICogQHBhcmFtIGNvbmZpZyDphY3nva7lr7nosaFcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHNldERlZmF1bHRDb25maWcoY29uZmlnOiB7XG4gICAgICAgIG1heENhY2hlU2l6ZT86IG51bWJlcjtcbiAgICAgICAgcmVuZGVyU2NhbGU/OiBudW1iZXI7XG4gICAgICAgIGFudGlhbGlhcz86IGJvb2xlYW47XG4gICAgICAgIGRlZmF1bHRDb2xvcj86IHN0cmluZztcbiAgICAgICAgcHJlc2VydmVBc3BlY3RSYXRpbz86IHN0cmluZztcbiAgICAgICAgZW5hYmxlTFJVPzogYm9vbGVhbjtcbiAgICB9KTogdm9pZCB7XG4gICAgICAgIGlmIChjb25maWcubWF4Q2FjaGVTaXplICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX21heENhY2hlU2l6ZSA9IGNvbmZpZy5tYXhDYWNoZVNpemU7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZUNhY2hlU2l6ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb25maWcucmVuZGVyU2NhbGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdFJlbmRlclNjYWxlID0gY29uZmlnLnJlbmRlclNjYWxlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb25maWcuYW50aWFsaWFzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRBbnRpYWxpYXMgPSBjb25maWcuYW50aWFsaWFzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb25maWcuZGVmYXVsdENvbG9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDb2xvciA9IGNvbmZpZy5kZWZhdWx0Q29sb3I7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZpZy5wcmVzZXJ2ZUFzcGVjdFJhdGlvICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRQcmVzZXJ2ZUFzcGVjdFJhdGlvID0gY29uZmlnLnByZXNlcnZlQXNwZWN0UmF0aW87XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZpZy5lbmFibGVMUlUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlTFJVID0gY29uZmlnLmVuYWJsZUxSVTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiOt+WPluW9k+WJjemFjee9rlxuICAgICAqIEByZXR1cm5zIOmFjee9ruWvueixoVxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZ2V0Q3VycmVudENvbmZpZygpOiB7XG4gICAgICAgIG1heENhY2hlU2l6ZTogbnVtYmVyO1xuICAgICAgICByZW5kZXJTY2FsZTogbnVtYmVyO1xuICAgICAgICBhbnRpYWxpYXM6IGJvb2xlYW47XG4gICAgICAgIGRlZmF1bHRDb2xvcjogc3RyaW5nO1xuICAgICAgICBwcmVzZXJ2ZUFzcGVjdFJhdGlvOiBzdHJpbmc7XG4gICAgICAgIGVuYWJsZUxSVTogYm9vbGVhbjtcbiAgICB9IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1heENhY2hlU2l6ZTogdGhpcy5fbWF4Q2FjaGVTaXplLFxuICAgICAgICAgICAgcmVuZGVyU2NhbGU6IHRoaXMuX2RlZmF1bHRSZW5kZXJTY2FsZSxcbiAgICAgICAgICAgIGFudGlhbGlhczogdGhpcy5fZGVmYXVsdEFudGlhbGlhcyxcbiAgICAgICAgICAgIGRlZmF1bHRDb2xvcjogdGhpcy5fZGVmYXVsdENvbG9yLFxuICAgICAgICAgICAgcHJlc2VydmVBc3BlY3RSYXRpbzogdGhpcy5fZGVmYXVsdFByZXNlcnZlQXNwZWN0UmF0aW8sXG4gICAgICAgICAgICBlbmFibGVMUlU6IHRoaXMuX2VuYWJsZUxSVSxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmoLnmja5TVkflhoXlrrnojrflj5bnvJPlrZjplK7vvIjlpoLmnpzlrZjlnKjvvIlcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrlcbiAgICAgKiBAcmV0dXJucyDnvJPlrZjplK7miJZudWxsXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBmaW5kQ2FjaGVLZXlCeVNWRyhzdmdDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBfXSBvZiB0aGlzLnRleHR1cmVDYWNoZSkge1xuICAgICAgICAgICAgaWYgKGtleS5pbmNsdWRlcyh0aGlzLmNhbGN1bGF0ZVNWR0hhc2goc3ZnQ29udGVudCkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09IOengeacieaWueazlSA9PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDnlJ/miJDnvJPlrZjplK5cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBnZW5lcmF0ZUNhY2hlS2V5KFxuICAgICAgICBzdmdDb250ZW50OiBzdHJpbmcsXG4gICAgICAgIHdpZHRoOiBudW1iZXIsXG4gICAgICAgIGhlaWdodDogbnVtYmVyLFxuICAgICAgICBjb2xvcjogc3RyaW5nLFxuICAgICAgICByZW5kZXJTY2FsZTogbnVtYmVyLFxuICAgICAgICBhbnRpYWxpYXM6IGJvb2xlYW4sXG4gICAgICAgIHByZXNlcnZlQXNwZWN0UmF0aW86IHN0cmluZ1xuICAgICk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHN2Z0hhc2ggPSB0aGlzLmNhbGN1bGF0ZVNWR0hhc2goc3ZnQ29udGVudCk7XG4gICAgICAgIHJldHVybiBgJHtzdmdIYXNofV8ke3dpZHRofXgke2hlaWdodH1fJHtjb2xvcn1fJHtyZW5kZXJTY2FsZX1fJHthbnRpYWxpYXN9XyR7cHJlc2VydmVBc3BlY3RSYXRpb31gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiuoeeul1NWR+WTiOW4jFxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIGNhbGN1bGF0ZVNWR0hhc2goc3ZnQ29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgLy8g566A5Y2V5ZOI5biM5Ye95pWw77yM5a6e6ZmF6aG555uu5Lit5Y+v5Lul5L2/55So5pu05aSN5p2C55qE5ZOI5biM566X5rOVXG4gICAgICAgIGxldCBoYXNoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdmdDb250ZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGFyID0gc3ZnQ29udGVudC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAgICAgaGFzaCA9IChoYXNoIDw8IDUpIC0gaGFzaCArIGNoYXI7XG4gICAgICAgICAgICBoYXNoID0gaGFzaCAmIGhhc2g7IC8vIOi9rOaNouS4ujMy5L2N5pW05pWwXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE1hdGguYWJzKGhhc2gpLnRvU3RyaW5nKDE2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDliJvlu7pTVkfnsr7ngbXluKdcbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBhc3luYyBjcmVhdGVTVkdTcHJpdGVGcmFtZShcbiAgICAgICAgc3ZnQ29udGVudDogc3RyaW5nLFxuICAgICAgICB3aWR0aDogbnVtYmVyLFxuICAgICAgICBoZWlnaHQ6IG51bWJlcixcbiAgICAgICAgY29sb3I6IHN0cmluZyxcbiAgICAgICAgcmVuZGVyU2NhbGU6IG51bWJlcixcbiAgICAgICAgYW50aWFsaWFzOiBib29sZWFuLFxuICAgICAgICBwcmVzZXJ2ZUFzcGVjdFJhdGlvOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPFNwcml0ZUZyYW1lPiB7XG4gICAgICAgIC8vIOmqjOivgVNWR+WGheWuuVxuICAgICAgICBpZiAoIXN2Z0NvbnRlbnQgfHwgc3ZnQ29udGVudC50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTVkflhoXlrrnkuI3og73kuLrnqbpcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDliJvlu7pDYW52YXNcbiAgICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgICAgICAgY29uc3QgcmVuZGVyV2lkdGggPSBNYXRoLmZsb29yKHdpZHRoICogcmVuZGVyU2NhbGUpO1xuICAgICAgICBjb25zdCByZW5kZXJIZWlnaHQgPSBNYXRoLmZsb29yKGhlaWdodCAqIHJlbmRlclNjYWxlKTtcbiAgICAgICAgY2FudmFzLndpZHRoID0gcmVuZGVyV2lkdGg7XG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSByZW5kZXJIZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICAgICAgaWYgKCFjdHgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIuaXoOazleiOt+WPlkNhbnZhcyAyROS4iuS4i+aWh1wiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOiuvue9ruaKl+mUr+m9v1xuICAgICAgICBpZiAoYW50aWFsaWFzKSB7XG4gICAgICAgICAgICBjdHguaW1hZ2VTbW9vdGhpbmdFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGN0eC5pbWFnZVNtb290aGluZ1F1YWxpdHkgPSBcImhpZ2hcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWHhuWkh1NWR+Wtl+espuS4slxuICAgICAgICBsZXQgc3ZnVG9SZW5kZXIgPSBzdmdDb250ZW50O1xuXG4gICAgICAgIC8vIOW6lOeUqOminOiJsuimhuebllxuICAgICAgICBpZiAoY29sb3IgIT09IFwiI2ZmZmZmZlwiKSB7XG4gICAgICAgICAgICBzdmdUb1JlbmRlciA9IHRoaXMuYXBwbHlDb2xvck92ZXJyaWRlKHN2Z1RvUmVuZGVyLCBjb2xvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDorr7nva5TVkflsLrlr7hcbiAgICAgICAgc3ZnVG9SZW5kZXIgPSB0aGlzLnNldFNWR0RpbWVuc2lvbnMoc3ZnVG9SZW5kZXIsIHdpZHRoLCBoZWlnaHQsIHByZXNlcnZlQXNwZWN0UmF0aW8pO1xuXG4gICAgICAgIC8vIOa4suafk1NWR+WIsENhbnZhc1xuICAgICAgICBhd2FpdCB0aGlzLnJlbmRlclNWR1RvQ2FudmFzKHN2Z1RvUmVuZGVyLCBjYW52YXMpO1xuXG4gICAgICAgIC8vIOWIm+W7ukltYWdlQXNzZXTlkoxUZXh0dXJlMkRcbiAgICAgICAgY29uc3QgaW1hZ2VBc3NldCA9IG5ldyBJbWFnZUFzc2V0KGNhbnZhcyk7XG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZTJEKCk7XG4gICAgICAgIHRleHR1cmUuaW1hZ2UgPSBpbWFnZUFzc2V0O1xuXG4gICAgICAgIC8vIOWIm+W7ulNwcml0ZUZyYW1lXG4gICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gbmV3IFNwcml0ZUZyYW1lKCk7XG4gICAgICAgIHNwcml0ZUZyYW1lLnRleHR1cmUgPSB0ZXh0dXJlO1xuXG4gICAgICAgIHJldHVybiBzcHJpdGVGcmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDlupTnlKjpopzoibLopobnm5ZcbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBhcHBseUNvbG9yT3ZlcnJpZGUoc3ZnU3RyaW5nOiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAvLyDnroDljZXnmoTpopzoibLmm7/mjaLvvJrlsIbmiYDmnIlmaWxs5bGe5oCn77yI6Zmk5LqGXCJub25lXCLvvInmm7/mjaLkuLrmjIflrprpopzoibJcbiAgICAgICAgcmV0dXJuIHN2Z1N0cmluZy5yZXBsYWNlKC9maWxsPVwiKFteXCJdKilcIi9nLCAobWF0Y2gsIGZpbGxWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGxWYWx1ZSA9PT0gXCJub25lXCIgfHwgZmlsbFZhbHVlID09PSBcInRyYW5zcGFyZW50XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2g7IC8vIOS/neaMgemAj+aYjuWhq+WFheS4jeWPmFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGBmaWxsPVwiJHtjb2xvcn1cImA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiuvue9rlNWR+WwuuWvuFxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIHNldFNWR0RpbWVuc2lvbnMoc3ZnU3RyaW5nOiBzdHJpbmcsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBwcmVzZXJ2ZUFzcGVjdFJhdGlvOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBsZXQgcmVzdWx0ID0gc3ZnU3RyaW5nO1xuXG4gICAgICAgIC8vIOabtOaWsHdpZHRo5bGe5oCnXG4gICAgICAgIGlmIChyZXN1bHQuaW5jbHVkZXMoJ3dpZHRoPVwiJykpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC93aWR0aD1cIlteXCJdKlwiLywgYHdpZHRoPVwiJHt3aWR0aH1cImApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoLzxzdmcvLCBgPHN2ZyB3aWR0aD1cIiR7d2lkdGh9XCJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOabtOaWsGhlaWdodOWxnuaAp1xuICAgICAgICBpZiAocmVzdWx0LmluY2x1ZGVzKCdoZWlnaHQ9XCInKSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL2hlaWdodD1cIlteXCJdKlwiLywgYGhlaWdodD1cIiR7aGVpZ2h0fVwiYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvPHN2Zy8sIGA8c3ZnIGhlaWdodD1cIiR7aGVpZ2h0fVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDmt7vliqDmiJbmm7TmlrBwcmVzZXJ2ZUFzcGVjdFJhdGlvXG4gICAgICAgIGlmIChyZXN1bHQuaW5jbHVkZXMoJ3ByZXNlcnZlQXNwZWN0UmF0aW89XCInKSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL3ByZXNlcnZlQXNwZWN0UmF0aW89XCJbXlwiXSpcIi8sIGBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwiJHtwcmVzZXJ2ZUFzcGVjdFJhdGlvfVwiYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvPHN2Zy8sIGA8c3ZnIHByZXNlcnZlQXNwZWN0UmF0aW89XCIke3ByZXNlcnZlQXNwZWN0UmF0aW99XCJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5riy5p+TU1ZH5YiwQ2FudmFzXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVuZGVyU1ZHVG9DYW52YXMoc3ZnU3RyaW5nOiBzdHJpbmcsIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuXG4gICAgICAgICAgICAvLyDliJvlu7pCbG9i5ZKMVVJMXG4gICAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3N2Z1N0cmluZ10sIHsgdHlwZTogXCJpbWFnZS9zdmcreG1sXCIgfSk7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXG4gICAgICAgICAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgICAgIGltZy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8g5riF56m655S75biDXG4gICAgICAgICAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgICAgICAgICAgLy8g57uY5Yi2U1ZHXG4gICAgICAgICAgICAgICAgY3R4LmRyYXdJbWFnZShpbWcsIDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG5cbiAgICAgICAgICAgICAgICAvLyDmuIXnkIZVUkxcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaW1nLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgU1ZH5riy5p+T5aSx6LSlOiAke2Vycm9yfWApKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGltZy5zcmMgPSB1cmw7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOe8k+WtmOeyvueBteW4p1xuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIGNhY2hlU3ByaXRlRnJhbWUoa2V5OiBzdHJpbmcsIHNwcml0ZUZyYW1lOiBTcHJpdGVGcmFtZSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgLy8g5qOA5p+l57yT5a2Y5aSn5bCPXG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVDYWNoZS5zaXplID49IHRoaXMuX21heENhY2hlU2l6ZSAmJiB0aGlzLl9lbmFibGVMUlUpIHtcbiAgICAgICAgICAgIHRoaXMuZXZpY3RMUlVDYWNoZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5re75Yqg5Yiw57yT5a2YXG4gICAgICAgIHRoaXMudGV4dHVyZUNhY2hlLnNldChrZXksIHNwcml0ZUZyYW1lKTtcblxuICAgICAgICAvLyDmm7TmlrBMUlXliJfooahcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZUxSVSkge1xuICAgICAgICAgICAgdGhpcy5jYWNoZUtleXMucHVzaChrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5pu05paw5YaF5a2Y5L2/55So5Lyw566X77yI5YGH6K6+5q+P5Liq5YOP57SgNOWtl+iKgu+8jFJHQkHvvIlcbiAgICAgICAgY29uc3QgZXN0aW1hdGVkTWVtb3J5ID0gd2lkdGggKiBoZWlnaHQgKiA0O1xuICAgICAgICB0aGlzLm1lbW9yeVVzYWdlICs9IGVzdGltYXRlZE1lbW9yeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmm7TmlrBMUlXpobrluo9cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyB1cGRhdGVMUlVPcmRlcihrZXk6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZUxSVSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jYWNoZUtleXMuaW5kZXhPZihrZXkpO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgLy8g56e75Yqo5Yiw5YiX6KGo5pyr5bC+77yI5pyA6L+R5L2/55So77yJXG4gICAgICAgICAgICB0aGlzLmNhY2hlS2V5cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgdGhpcy5jYWNoZUtleXMucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5reY5rGwTFJV57yT5a2YXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgZXZpY3RMUlVDYWNoZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVLZXlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIOenu+mZpOacgOS5heacquS9v+eUqOeahOe8k+WtmO+8iOWIl+ihqOesrOS4gOS4qu+8iVxuICAgICAgICBjb25zdCBvbGRlc3RLZXkgPSB0aGlzLmNhY2hlS2V5cy5zaGlmdCgpITtcbiAgICAgICAgdGhpcy5jbGVhckNhY2hlQnlLZXkob2xkZXN0S2V5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDnrqHnkIbnvJPlrZjlpKflsI9cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBtYW5hZ2VDYWNoZVNpemUoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlTFJVKSByZXR1cm47XG5cbiAgICAgICAgd2hpbGUgKHRoaXMudGV4dHVyZUNhY2hlLnNpemUgPiB0aGlzLl9tYXhDYWNoZVNpemUgJiYgdGhpcy5jYWNoZUtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmljdExSVUNhY2hlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmm7TmlrDlhoXlrZjkvb/nlKjkvLDnrpdcbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyB1cGRhdGVNZW1vcnlVc2FnZSgpOiB2b2lkIHtcbiAgICAgICAgbGV0IHRvdGFsTWVtb3J5ID0gMDtcblxuICAgICAgICB0aGlzLnRleHR1cmVDYWNoZS5mb3JFYWNoKChzcHJpdGVGcmFtZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAvLyDku47nvJPlrZjplK7kuK3mj5Dlj5blsLrlr7jkv6Hmga9cbiAgICAgICAgICAgIGNvbnN0IHNpemVNYXRjaCA9IGtleS5tYXRjaCgvXyhcXGQrKXgoXFxkKylfLyk7XG4gICAgICAgICAgICBpZiAoc2l6ZU1hdGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgd2lkdGggPSBwYXJzZUludChzaXplTWF0Y2hbMV0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IHBhcnNlSW50KHNpemVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgdG90YWxNZW1vcnkgKz0gd2lkdGggKiBoZWlnaHQgKiA0OyAvLyDmr4/kuKrlg4/ntKA05a2X6IqC77yIUkdCQe+8iVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1lbW9yeVVzYWdlID0gdG90YWxNZW1vcnk7XG4gICAgfVxufVxuIl19