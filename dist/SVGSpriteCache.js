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
let SVGSpriteCache = class SVGSpriteCache {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHU3ByaXRlQ2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2UvU1ZHU3ByaXRlQ2FjaGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsMkJBQW9FO0FBQ3BFLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxHQUFHLGVBQVUsQ0FBQztBQUVsRTs7O0dBR0c7QUFJSSxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFjO0lBZ0R2Qiw2QkFBNkI7SUFFN0I7Ozs7Ozs7Ozs7T0FVRztJQUNJLE1BQU0sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQ2pDLFVBQWtCLEVBQ2xCLEtBQWEsRUFDYixNQUFjLEVBQ2QsS0FBYyxFQUNkLFdBQW9CLEVBQ3BCLFNBQW1CLEVBQ25CLG1CQUE0QjtRQUU1QixNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFcEMsWUFBWTtRQUNaLE1BQU0sVUFBVSxHQUFHLEtBQUssSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQy9DLE1BQU0sZ0JBQWdCLEdBQUcsV0FBVyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUM7UUFDNUYsTUFBTSxjQUFjLEdBQUcsU0FBUyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDcEYsTUFBTSx3QkFBd0IsR0FBRyxtQkFBbUIsSUFBSSxJQUFJLENBQUMsMkJBQTJCLENBQUM7UUFFekYsUUFBUTtRQUNSLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FDbEMsVUFBVSxFQUNWLEtBQUssRUFDTCxNQUFNLEVBQ04sVUFBVSxFQUNWLGdCQUFnQixFQUNoQixjQUFjLEVBQ2Qsd0JBQXdCLENBQzNCLENBQUM7UUFFRixPQUFP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QVM7S0FDekIsQ0FBQzt3Q0FDd0M7eUJBckNqQyxjQUFjO0lBSDFCLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztJQUN6QixJQUFJLENBQUMsbUJBQW1CLENBQUM7SUFDekIsaUJBQWlCO0dBQ0wsY0FBYyxDQXFoQjFCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgX2RlY29yYXRvciwgU3ByaXRlRnJhbWUsIFRleHR1cmUyRCwgSW1hZ2VBc3NldCB9IGZyb20gXCJjY1wiO1xyXG5jb25zdCB7IGNjY2xhc3MsIHByb3BlcnR5LCBleGVjdXRlSW5FZGl0TW9kZSwgbWVudSB9ID0gX2RlY29yYXRvcjtcclxuXHJcbi8qKlxyXG4gKiBTVkfnsr7ngbXnvJPlrZjnrqHnkIblmahcclxuICog5o+Q5L6bU1ZH5YiwU3ByaXRlRnJhbWXnmoTnvJPlrZjlkozmuLLmn5Plip/og71cclxuICovXHJcbkBjY2NsYXNzKFwiU1ZHU3ByaXRlQ2FjaGVcIilcclxuQG1lbnUoXCIyRC9TVkdTcHJpdGVDYWNoZVwiKVxyXG5AZXhlY3V0ZUluRWRpdE1vZGVcclxuZXhwb3J0IGNsYXNzIFNWR1Nwcml0ZUNhY2hlIHtcclxuICAgIC8vID09PT09PT09PT0g6Z2Z5oCB6YWN572u5bGe5oCnID09PT09PT09PT1cclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5pyA5aSn57yT5a2Y5pWw6YePXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5pyA5aSn57yT5a2Y5pWwXCIsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX21heENhY2hlU2l6ZTogbnVtYmVyID0gMTAwO1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLpu5jorqTmuLLmn5PnvKnmlL5cIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmuLLmn5PnvKnmlL5cIixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIHN0YXRpYyBfZGVmYXVsdFJlbmRlclNjYWxlOiBudW1iZXIgPSAxLjA7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIum7mOiupOaKl+mUr+m9v1wiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuaKl+mUr+m9v1wiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgc3RhdGljIF9kZWZhdWx0QW50aWFsaWFzOiBib29sZWFuID0gdHJ1ZTtcclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi6buY6K6k6aKc6ImyXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi6buY6K6k6aKc6ImyXCIsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBzdGF0aWMgX2RlZmF1bHRDb2xvcjogc3RyaW5nID0gXCIjZmZmZmZmXCI7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIum7mOiupOS/neaMgeWuvemrmOavlFwiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuS/neaMgeWuvemrmOavlFwiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgc3RhdGljIF9kZWZhdWx0UHJlc2VydmVBc3BlY3RSYXRpbzogc3RyaW5nID0gXCJ4TWlkWU1pZCBtZWV0XCI7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuWQr+eUqExSVee8k+WtmOa3mOaxsFwiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIkxSVee8k+WtmOa3mOaxsFwiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgc3RhdGljIF9lbmFibGVMUlU6IGJvb2xlYW4gPSB0cnVlO1xyXG5cclxuICAgIC8vID09PT09PT09PT0g57yT5a2Y5a2Y5YKoID09PT09PT09PT1cclxuXHJcbiAgICBwcml2YXRlIHN0YXRpYyB0ZXh0dXJlQ2FjaGU6IE1hcDxzdHJpbmcsIFNwcml0ZUZyYW1lPiA9IG5ldyBNYXAoKTtcclxuICAgIHByaXZhdGUgc3RhdGljIGNhY2hlS2V5czogc3RyaW5nW10gPSBbXTsgLy8g55So5LqOTFJV57yT5a2Y5reY5rGwXHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWNoZUhpdENvdW50OiBudW1iZXIgPSAwO1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgY2FjaGVNaXNzQ291bnQ6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIHN0YXRpYyB0b3RhbFJlbmRlclRpbWU6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBtZW1vcnlVc2FnZTogbnVtYmVyID0gMDsgLy8g5Lyw566X55qE5YaF5a2Y5L2/55So77yI5a2X6IqC77yJXHJcblxyXG4gICAgLy8gPT09PT09PT09PSDlhazlhbHmlrnms5UgPT09PT09PT09PVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+WU1ZH57K+54G15binXHJcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrnlrZfnrKbkuLJcclxuICAgICAqIEBwYXJhbSB3aWR0aCDmuLLmn5Plrr3luqZcclxuICAgICAqIEBwYXJhbSBoZWlnaHQg5riy5p+T6auY5bqmXHJcbiAgICAgKiBAcGFyYW0gY29sb3Ig6aKc6Imy6KaG55uW77yI5Y+v6YCJ77yJXHJcbiAgICAgKiBAcGFyYW0gcmVuZGVyU2NhbGUg5riy5p+T57yp5pS+77yI5Y+v6YCJ77yJXHJcbiAgICAgKiBAcGFyYW0gYW50aWFsaWFzIOaKl+mUr+m9v++8iOWPr+mAie+8iVxyXG4gICAgICogQHBhcmFtIHByZXNlcnZlQXNwZWN0UmF0aW8g5L+d5oyB5a696auY5q+U77yI5Y+v6YCJ77yJXHJcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlPFNwcml0ZUZyYW1lPlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldFNWR1Nwcml0ZUZyYW1lKFxyXG4gICAgICAgIHN2Z0NvbnRlbnQ6IHN0cmluZyxcclxuICAgICAgICB3aWR0aDogbnVtYmVyLFxyXG4gICAgICAgIGhlaWdodDogbnVtYmVyLFxyXG4gICAgICAgIGNvbG9yPzogc3RyaW5nLFxyXG4gICAgICAgIHJlbmRlclNjYWxlPzogbnVtYmVyLFxyXG4gICAgICAgIGFudGlhbGlhcz86IGJvb2xlYW4sXHJcbiAgICAgICAgcHJlc2VydmVBc3BlY3RSYXRpbz86IHN0cmluZ1xyXG4gICAgKTogUHJvbWlzZTxTcHJpdGVGcmFtZT4ge1xyXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xyXG5cclxuICAgICAgICAvLyDkvb/nlKjpu5jorqTlgLzmiJbkvKDlhaXlgLxcclxuICAgICAgICBjb25zdCBmaW5hbENvbG9yID0gY29sb3IgfHwgdGhpcy5fZGVmYXVsdENvbG9yO1xyXG4gICAgICAgIGNvbnN0IGZpbmFsUmVuZGVyU2NhbGUgPSByZW5kZXJTY2FsZSAhPT0gdW5kZWZpbmVkID8gcmVuZGVyU2NhbGUgOiB0aGlzLl9kZWZhdWx0UmVuZGVyU2NhbGU7XHJcbiAgICAgICAgY29uc3QgZmluYWxBbnRpYWxpYXMgPSBhbnRpYWxpYXMgIT09IHVuZGVmaW5lZCA/IGFudGlhbGlhcyA6IHRoaXMuX2RlZmF1bHRBbnRpYWxpYXM7XHJcbiAgICAgICAgY29uc3QgZmluYWxQcmVzZXJ2ZUFzcGVjdFJhdGlvID0gcHJlc2VydmVBc3BlY3RSYXRpbyB8fCB0aGlzLl9kZWZhdWx0UHJlc2VydmVBc3BlY3RSYXRpbztcclxuXHJcbiAgICAgICAgLy8g55Sf5oiQ57yT5a2Y6ZSuXHJcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSB0aGlzLmdlbmVyYXRlQ2FjaGVLZXkoXHJcbiAgICAgICAgICAgIHN2Z0NvbnRlbnQsXHJcbiAgICAgICAgICAgIHdpZHRoLFxyXG4gICAgICAgICAgICBoZWlnaHQsXHJcbiAgICAgICAgICAgIGZpbmFsQ29sb3IsXHJcbiAgICAgICAgICAgIGZpbmFsUmVuZGVyU2NhbGUsXHJcbiAgICAgICAgICAgIGZpbmFsQW50aWFsaWFzLFxyXG4gICAgICAgICAgICBmaW5hbFByZXNlcnZlQXNwZWN0UmF0aW9cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyDmo4Dmn6XnvJPlrZhcclxuICAgICAgICBpZiAodGhpcy50ZXh0dXJlQ2FjaGUuaGFzKGNhY2hlS2V5KSkge1xyXG4gICAgICAgICAgICB0aGlzLmNhY2hlSGl0Q291bnQrKztcclxuXHJcbiAgICAgICAgICAgIC8vIOabtOaWsExSVemhuuW6j1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fZW5hYmxlTFJVKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUxSVU9yZGVyKGNhY2hlS2V5KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgZW5kVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xyXG4gICAgICAgICAgICB0aGlzLnRvdGFsUmVuZGVyVGltZSArPSBlbmRUaW1lIC0gc3RhcnRUaW1lO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudGV4dHVyZUNhY2hlLmdldChjYWNoZUtleSkhO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5jYWNoZU1pc3NDb3VudCsrO1xyXG5cclxuICAgICAgICAvLyDliJvlu7rmlrDnmoRTcHJpdGVGcmFtZVxyXG4gICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gYXdhaXQgdGhpcy5jcmVhdGVTVkdTcHJpdGVGcmFtZShcclxuICAgICAgICAgICAgc3ZnQ29udGVudCxcclxuICAgICAgICAgICAgd2lkdGgsXHJcbiAgICAgICAgICAgIGhlaWdodCxcclxuICAgICAgICAgICAgZmluYWxDb2xvcixcclxuICAgICAgICAgICAgZmluYWxSZW5kZXJTY2FsZSxcclxuICAgICAgICAgICAgZmluYWxBbnRpYWxpYXMsXHJcbiAgICAgICAgICAgIGZpbmFsUHJlc2VydmVBc3BlY3RSYXRpb1xyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIC8vIOe8k+WtmOeuoeeQhlxyXG4gICAgICAgIHRoaXMuY2FjaGVTcHJpdGVGcmFtZShjYWNoZUtleSwgc3ByaXRlRnJhbWUsIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuICAgICAgICBjb25zdCBlbmRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XHJcbiAgICAgICAgdGhpcy50b3RhbFJlbmRlclRpbWUgKz0gZW5kVGltZSAtIHN0YXJ0VGltZTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHNwcml0ZUZyYW1lO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W566A5YyW54mIU1ZH57K+54G15bin77yI5q2j5pa55b2i77yJXHJcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrnlrZfnrKbkuLJcclxuICAgICAqIEBwYXJhbSBzaXplIOWwuuWvuO+8iOWuvemrmOebuOWQjO+8iVxyXG4gICAgICogQHBhcmFtIGNvbG9yIOminOiJsu+8iOWPr+mAie+8iVxyXG4gICAgICogQHJldHVybnMgUHJvbWlzZTxTcHJpdGVGcmFtZT5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRTaW1wbGVTVkdTcHJpdGVGcmFtZShzdmdDb250ZW50OiBzdHJpbmcsIHNpemU6IG51bWJlciwgY29sb3I/OiBzdHJpbmcpOiBQcm9taXNlPFNwcml0ZUZyYW1lPiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0U1ZHU3ByaXRlRnJhbWUoc3ZnQ29udGVudCwgc2l6ZSwgc2l6ZSwgY29sb3IpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6aKE5Yqg6L295aSa5LiqU1ZH5Yiw57yT5a2YXHJcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudHMgU1ZH5YaF5a655pWw57uEXHJcbiAgICAgKiBAcGFyYW0gd2lkdGgg5a695bqmXHJcbiAgICAgKiBAcGFyYW0gaGVpZ2h0IOmrmOW6plxyXG4gICAgICogQHBhcmFtIGNvbG9yIOminOiJsu+8iOWPr+mAie+8iVxyXG4gICAgICogQHJldHVybnMgUHJvbWlzZTx2b2lkPlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIGFzeW5jIHByZWxvYWRTVkdzKHN2Z0NvbnRlbnRzOiBzdHJpbmdbXSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBzdmdDb250ZW50cy5tYXAoKHN2Z0NvbnRlbnQpID0+IHRoaXMuZ2V0U1ZHU3ByaXRlRnJhbWUoc3ZnQ29udGVudCwgd2lkdGgsIGhlaWdodCwgY29sb3IpKTtcclxuXHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF6Zmk5oyH5a6a57yT5a2YXHJcbiAgICAgKiBAcGFyYW0ga2V5IOe8k+WtmOmUrlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIGNsZWFyQ2FjaGVCeUtleShrZXk6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVDYWNoZS5oYXMoa2V5KSkge1xyXG4gICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IHRoaXMudGV4dHVyZUNhY2hlLmdldChrZXkpITtcclxuICAgICAgICAgICAgLy8g6YeK5pS+57q555CG6LWE5rqQXHJcbiAgICAgICAgICAgIGlmIChzcHJpdGVGcmFtZS50ZXh0dXJlKSB7XHJcbiAgICAgICAgICAgICAgICBzcHJpdGVGcmFtZS50ZXh0dXJlLmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnRleHR1cmVDYWNoZS5kZWxldGUoa2V5KTtcclxuXHJcbiAgICAgICAgICAgIC8vIOS7jkxSVeWIl+ihqOS4reenu+mZpFxyXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FjaGVLZXlzLmluZGV4T2Yoa2V5KTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2FjaGVLZXlzLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIOabtOaWsOWGheWtmOS9v+eUqOS8sOeul1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1lbW9yeVVzYWdlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF6Zmk5omA5pyJ57yT5a2YXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgY2xlYXJBbGxDYWNoZSgpOiB2b2lkIHtcclxuICAgICAgICAvLyDph4rmlL7miYDmnInnurnnkIbotYTmupBcclxuICAgICAgICB0aGlzLnRleHR1cmVDYWNoZS5mb3JFYWNoKChzcHJpdGVGcmFtZSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc3ByaXRlRnJhbWUudGV4dHVyZSkge1xyXG4gICAgICAgICAgICAgICAgc3ByaXRlRnJhbWUudGV4dHVyZS5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy50ZXh0dXJlQ2FjaGUuY2xlYXIoKTtcclxuICAgICAgICB0aGlzLmNhY2hlS2V5cyA9IFtdO1xyXG4gICAgICAgIHRoaXMuY2FjaGVIaXRDb3VudCA9IDA7XHJcbiAgICAgICAgdGhpcy5jYWNoZU1pc3NDb3VudCA9IDA7XHJcbiAgICAgICAgdGhpcy50b3RhbFJlbmRlclRpbWUgPSAwO1xyXG4gICAgICAgIHRoaXMubWVtb3J5VXNhZ2UgPSAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W57yT5a2Y57uf6K6h5L+h5oGvXHJcbiAgICAgKiBAcmV0dXJucyDnvJPlrZjnu5/orqHlr7nosaFcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBnZXRDYWNoZVN0YXRzKCk6IHtcclxuICAgICAgICBzaXplOiBudW1iZXI7XHJcbiAgICAgICAgaGl0UmF0ZTogbnVtYmVyO1xyXG4gICAgICAgIHRvdGFsUmVuZGVyVGltZTogbnVtYmVyO1xyXG4gICAgICAgIG1lbW9yeVVzYWdlOiBudW1iZXI7XHJcbiAgICAgICAgaGl0Q291bnQ6IG51bWJlcjtcclxuICAgICAgICBtaXNzQ291bnQ6IG51bWJlcjtcclxuICAgIH0ge1xyXG4gICAgICAgIGNvbnN0IHRvdGFsUmVxdWVzdHMgPSB0aGlzLmNhY2hlSGl0Q291bnQgKyB0aGlzLmNhY2hlTWlzc0NvdW50O1xyXG4gICAgICAgIGNvbnN0IGhpdFJhdGUgPSB0b3RhbFJlcXVlc3RzID4gMCA/ICh0aGlzLmNhY2hlSGl0Q291bnQgLyB0b3RhbFJlcXVlc3RzKSAqIDEwMCA6IDA7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNpemU6IHRoaXMudGV4dHVyZUNhY2hlLnNpemUsXHJcbiAgICAgICAgICAgIGhpdFJhdGU6IHBhcnNlRmxvYXQoaGl0UmF0ZS50b0ZpeGVkKDIpKSxcclxuICAgICAgICAgICAgdG90YWxSZW5kZXJUaW1lOiBwYXJzZUZsb2F0KHRoaXMudG90YWxSZW5kZXJUaW1lLnRvRml4ZWQoMikpLFxyXG4gICAgICAgICAgICBtZW1vcnlVc2FnZTogdGhpcy5tZW1vcnlVc2FnZSxcclxuICAgICAgICAgICAgaGl0Q291bnQ6IHRoaXMuY2FjaGVIaXRDb3VudCxcclxuICAgICAgICAgICAgbWlzc0NvdW50OiB0aGlzLmNhY2hlTWlzc0NvdW50LFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDorr7nva7pu5jorqTphY3nva5cclxuICAgICAqIEBwYXJhbSBjb25maWcg6YWN572u5a+56LGhXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgc2V0RGVmYXVsdENvbmZpZyhjb25maWc6IHtcclxuICAgICAgICBtYXhDYWNoZVNpemU/OiBudW1iZXI7XHJcbiAgICAgICAgcmVuZGVyU2NhbGU/OiBudW1iZXI7XHJcbiAgICAgICAgYW50aWFsaWFzPzogYm9vbGVhbjtcclxuICAgICAgICBkZWZhdWx0Q29sb3I/OiBzdHJpbmc7XHJcbiAgICAgICAgcHJlc2VydmVBc3BlY3RSYXRpbz86IHN0cmluZztcclxuICAgICAgICBlbmFibGVMUlU/OiBib29sZWFuO1xyXG4gICAgfSk6IHZvaWQge1xyXG4gICAgICAgIGlmIChjb25maWcubWF4Q2FjaGVTaXplICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5fbWF4Q2FjaGVTaXplID0gY29uZmlnLm1heENhY2hlU2l6ZTtcclxuICAgICAgICAgICAgdGhpcy5tYW5hZ2VDYWNoZVNpemUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNvbmZpZy5yZW5kZXJTY2FsZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRSZW5kZXJTY2FsZSA9IGNvbmZpZy5yZW5kZXJTY2FsZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNvbmZpZy5hbnRpYWxpYXMgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0QW50aWFsaWFzID0gY29uZmlnLmFudGlhbGlhcztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNvbmZpZy5kZWZhdWx0Q29sb3IgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0Q29sb3IgPSBjb25maWcuZGVmYXVsdENvbG9yO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY29uZmlnLnByZXNlcnZlQXNwZWN0UmF0aW8gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0UHJlc2VydmVBc3BlY3RSYXRpbyA9IGNvbmZpZy5wcmVzZXJ2ZUFzcGVjdFJhdGlvO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY29uZmlnLmVuYWJsZUxSVSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZUxSVSA9IGNvbmZpZy5lbmFibGVMUlU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5b2T5YmN6YWN572uXHJcbiAgICAgKiBAcmV0dXJucyDphY3nva7lr7nosaFcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBnZXRDdXJyZW50Q29uZmlnKCk6IHtcclxuICAgICAgICBtYXhDYWNoZVNpemU6IG51bWJlcjtcclxuICAgICAgICByZW5kZXJTY2FsZTogbnVtYmVyO1xyXG4gICAgICAgIGFudGlhbGlhczogYm9vbGVhbjtcclxuICAgICAgICBkZWZhdWx0Q29sb3I6IHN0cmluZztcclxuICAgICAgICBwcmVzZXJ2ZUFzcGVjdFJhdGlvOiBzdHJpbmc7XHJcbiAgICAgICAgZW5hYmxlTFJVOiBib29sZWFuO1xyXG4gICAgfSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgbWF4Q2FjaGVTaXplOiB0aGlzLl9tYXhDYWNoZVNpemUsXHJcbiAgICAgICAgICAgIHJlbmRlclNjYWxlOiB0aGlzLl9kZWZhdWx0UmVuZGVyU2NhbGUsXHJcbiAgICAgICAgICAgIGFudGlhbGlhczogdGhpcy5fZGVmYXVsdEFudGlhbGlhcyxcclxuICAgICAgICAgICAgZGVmYXVsdENvbG9yOiB0aGlzLl9kZWZhdWx0Q29sb3IsXHJcbiAgICAgICAgICAgIHByZXNlcnZlQXNwZWN0UmF0aW86IHRoaXMuX2RlZmF1bHRQcmVzZXJ2ZUFzcGVjdFJhdGlvLFxyXG4gICAgICAgICAgICBlbmFibGVMUlU6IHRoaXMuX2VuYWJsZUxSVSxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5qC55o2uU1ZH5YaF5a656I635Y+W57yT5a2Y6ZSu77yI5aaC5p6c5a2Y5Zyo77yJXHJcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrlcclxuICAgICAqIEByZXR1cm5zIOe8k+WtmOmUruaIlm51bGxcclxuICAgICAqL1xyXG4gICAgcHVibGljIHN0YXRpYyBmaW5kQ2FjaGVLZXlCeVNWRyhzdmdDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIF9dIG9mIHRoaXMudGV4dHVyZUNhY2hlKSB7XHJcbiAgICAgICAgICAgIGlmIChrZXkuaW5jbHVkZXModGhpcy5jYWxjdWxhdGVTVkdIYXNoKHN2Z0NvbnRlbnQpKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvLyA9PT09PT09PT09IOengeacieaWueazlSA9PT09PT09PT09XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnlJ/miJDnvJPlrZjplK5cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgZ2VuZXJhdGVDYWNoZUtleShcclxuICAgICAgICBzdmdDb250ZW50OiBzdHJpbmcsXHJcbiAgICAgICAgd2lkdGg6IG51bWJlcixcclxuICAgICAgICBoZWlnaHQ6IG51bWJlcixcclxuICAgICAgICBjb2xvcjogc3RyaW5nLFxyXG4gICAgICAgIHJlbmRlclNjYWxlOiBudW1iZXIsXHJcbiAgICAgICAgYW50aWFsaWFzOiBib29sZWFuLFxyXG4gICAgICAgIHByZXNlcnZlQXNwZWN0UmF0aW86IHN0cmluZ1xyXG4gICAgKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBzdmdIYXNoID0gdGhpcy5jYWxjdWxhdGVTVkdIYXNoKHN2Z0NvbnRlbnQpO1xyXG4gICAgICAgIHJldHVybiBgJHtzdmdIYXNofV8ke3dpZHRofXgke2hlaWdodH1fJHtjb2xvcn1fJHtyZW5kZXJTY2FsZX1fJHthbnRpYWxpYXN9XyR7cHJlc2VydmVBc3BlY3RSYXRpb31gO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6K6h566XU1ZH5ZOI5biMXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc3RhdGljIGNhbGN1bGF0ZVNWR0hhc2goc3ZnQ29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICAvLyDnroDljZXlk4jluIzlh73mlbDvvIzlrp7pmYXpobnnm67kuK3lj6/ku6Xkvb/nlKjmm7TlpI3mnYLnmoTlk4jluIznrpfms5VcclxuICAgICAgICBsZXQgaGFzaCA9IDA7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdmdDb250ZW50Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNoYXIgPSBzdmdDb250ZW50LmNoYXJDb2RlQXQoaSk7XHJcbiAgICAgICAgICAgIGhhc2ggPSAoaGFzaCA8PCA1KSAtIGhhc2ggKyBjaGFyO1xyXG4gICAgICAgICAgICBoYXNoID0gaGFzaCAmIGhhc2g7IC8vIOi9rOaNouS4ujMy5L2N5pW05pWwXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBNYXRoLmFicyhoYXNoKS50b1N0cmluZygxNik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7pTVkfnsr7ngbXluKdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgYXN5bmMgY3JlYXRlU1ZHU3ByaXRlRnJhbWUoXHJcbiAgICAgICAgc3ZnQ29udGVudDogc3RyaW5nLFxyXG4gICAgICAgIHdpZHRoOiBudW1iZXIsXHJcbiAgICAgICAgaGVpZ2h0OiBudW1iZXIsXHJcbiAgICAgICAgY29sb3I6IHN0cmluZyxcclxuICAgICAgICByZW5kZXJTY2FsZTogbnVtYmVyLFxyXG4gICAgICAgIGFudGlhbGlhczogYm9vbGVhbixcclxuICAgICAgICBwcmVzZXJ2ZUFzcGVjdFJhdGlvOiBzdHJpbmdcclxuICAgICk6IFByb21pc2U8U3ByaXRlRnJhbWU+IHtcclxuICAgICAgICAvLyDpqozor4FTVkflhoXlrrlcclxuICAgICAgICBpZiAoIXN2Z0NvbnRlbnQgfHwgc3ZnQ29udGVudC50cmltKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNWR+WGheWuueS4jeiDveS4uuepulwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOWIm+W7ukNhbnZhc1xyXG4gICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgICAgY29uc3QgcmVuZGVyV2lkdGggPSBNYXRoLmZsb29yKHdpZHRoICogcmVuZGVyU2NhbGUpO1xyXG4gICAgICAgIGNvbnN0IHJlbmRlckhlaWdodCA9IE1hdGguZmxvb3IoaGVpZ2h0ICogcmVuZGVyU2NhbGUpO1xyXG4gICAgICAgIGNhbnZhcy53aWR0aCA9IHJlbmRlcldpZHRoO1xyXG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSByZW5kZXJIZWlnaHQ7XHJcblxyXG4gICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICAgICAgaWYgKCFjdHgpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+WQ2FudmFzIDJE5LiK5LiL5paHXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g6K6+572u5oqX6ZSv6b2/XHJcbiAgICAgICAgaWYgKGFudGlhbGlhcykge1xyXG4gICAgICAgICAgICBjdHguaW1hZ2VTbW9vdGhpbmdFbmFibGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgY3R4LmltYWdlU21vb3RoaW5nUXVhbGl0eSA9IFwiaGlnaFwiO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5YeG5aSHU1ZH5a2X56ym5LiyXHJcbiAgICAgICAgbGV0IHN2Z1RvUmVuZGVyID0gc3ZnQ29udGVudDtcclxuXHJcbiAgICAgICAgLy8g5bqU55So6aKc6Imy6KaG55uWXHJcbiAgICAgICAgaWYgKGNvbG9yICE9PSBcIiNmZmZmZmZcIikge1xyXG4gICAgICAgICAgICBzdmdUb1JlbmRlciA9IHRoaXMuYXBwbHlDb2xvck92ZXJyaWRlKHN2Z1RvUmVuZGVyLCBjb2xvcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDorr7nva5TVkflsLrlr7hcclxuICAgICAgICBzdmdUb1JlbmRlciA9IHRoaXMuc2V0U1ZHRGltZW5zaW9ucyhzdmdUb1JlbmRlciwgd2lkdGgsIGhlaWdodCwgcHJlc2VydmVBc3BlY3RSYXRpbyk7XHJcblxyXG4gICAgICAgIC8vIOa4suafk1NWR+WIsENhbnZhc1xyXG4gICAgICAgIGF3YWl0IHRoaXMucmVuZGVyU1ZHVG9DYW52YXMoc3ZnVG9SZW5kZXIsIGNhbnZhcyk7XHJcblxyXG4gICAgICAgIC8vIOWIm+W7ukltYWdlQXNzZXTlkoxUZXh0dXJlMkRcclxuICAgICAgICBjb25zdCBpbWFnZUFzc2V0ID0gbmV3IEltYWdlQXNzZXQoY2FudmFzKTtcclxuICAgICAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUyRCgpO1xyXG4gICAgICAgIHRleHR1cmUuaW1hZ2UgPSBpbWFnZUFzc2V0O1xyXG5cclxuICAgICAgICAvLyDliJvlu7pTcHJpdGVGcmFtZVxyXG4gICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gbmV3IFNwcml0ZUZyYW1lKCk7XHJcbiAgICAgICAgc3ByaXRlRnJhbWUudGV4dHVyZSA9IHRleHR1cmU7XHJcblxyXG4gICAgICAgIHJldHVybiBzcHJpdGVGcmFtZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOW6lOeUqOminOiJsuimhuebllxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBhcHBseUNvbG9yT3ZlcnJpZGUoc3ZnU3RyaW5nOiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIC8vIOeugOWNleeahOminOiJsuabv+aNou+8muWwhuaJgOaciWZpbGzlsZ7mgKfvvIjpmaTkuoZcIm5vbmVcIu+8ieabv+aNouS4uuaMh+WumuminOiJslxyXG4gICAgICAgIHJldHVybiBzdmdTdHJpbmcucmVwbGFjZSgvZmlsbD1cIihbXlwiXSopXCIvZywgKG1hdGNoLCBmaWxsVmFsdWUpID0+IHtcclxuICAgICAgICAgICAgaWYgKGZpbGxWYWx1ZSA9PT0gXCJub25lXCIgfHwgZmlsbFZhbHVlID09PSBcInRyYW5zcGFyZW50XCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaDsgLy8g5L+d5oyB6YCP5piO5aGr5YWF5LiN5Y+YXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGBmaWxsPVwiJHtjb2xvcn1cImA7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDorr7nva5TVkflsLrlr7hcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgc2V0U1ZHRGltZW5zaW9ucyhzdmdTdHJpbmc6IHN0cmluZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHByZXNlcnZlQXNwZWN0UmF0aW86IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgbGV0IHJlc3VsdCA9IHN2Z1N0cmluZztcclxuXHJcbiAgICAgICAgLy8g5pu05pawd2lkdGjlsZ7mgKdcclxuICAgICAgICBpZiAocmVzdWx0LmluY2x1ZGVzKCd3aWR0aD1cIicpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC93aWR0aD1cIlteXCJdKlwiLywgYHdpZHRoPVwiJHt3aWR0aH1cImApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC88c3ZnLywgYDxzdmcgd2lkdGg9XCIke3dpZHRofVwiYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmm7TmlrBoZWlnaHTlsZ7mgKdcclxuICAgICAgICBpZiAocmVzdWx0LmluY2x1ZGVzKCdoZWlnaHQ9XCInKSkge1xyXG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvaGVpZ2h0PVwiW15cIl0qXCIvLCBgaGVpZ2h0PVwiJHtoZWlnaHR9XCJgKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvPHN2Zy8sIGA8c3ZnIGhlaWdodD1cIiR7aGVpZ2h0fVwiYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmt7vliqDmiJbmm7TmlrBwcmVzZXJ2ZUFzcGVjdFJhdGlvXHJcbiAgICAgICAgaWYgKHJlc3VsdC5pbmNsdWRlcygncHJlc2VydmVBc3BlY3RSYXRpbz1cIicpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC9wcmVzZXJ2ZUFzcGVjdFJhdGlvPVwiW15cIl0qXCIvLCBgcHJlc2VydmVBc3BlY3RSYXRpbz1cIiR7cHJlc2VydmVBc3BlY3RSYXRpb31cImApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC88c3ZnLywgYDxzdmcgcHJlc2VydmVBc3BlY3RSYXRpbz1cIiR7cHJlc2VydmVBc3BlY3RSYXRpb31cImApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOa4suafk1NWR+WIsENhbnZhc1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyByZW5kZXJTVkdUb0NhbnZhcyhzdmdTdHJpbmc6IHN0cmluZywgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xyXG5cclxuICAgICAgICAgICAgLy8g5Yib5bu6QmxvYuWSjFVSTFxyXG4gICAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3N2Z1N0cmluZ10sIHsgdHlwZTogXCJpbWFnZS9zdmcreG1sXCIgfSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcclxuICAgICAgICAgICAgaW1nLm9ubG9hZCA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIOa4heepuueUu+W4g1xyXG4gICAgICAgICAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIOe7mOWItlNWR1xyXG4gICAgICAgICAgICAgICAgY3R4LmRyYXdJbWFnZShpbWcsIDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g5riF55CGVVJMXHJcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBpbWcub25lcnJvciA9IChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgU1ZH5riy5p+T5aSx6LSlOiAke2Vycm9yfWApKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGltZy5zcmMgPSB1cmw7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnvJPlrZjnsr7ngbXluKdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgY2FjaGVTcHJpdGVGcmFtZShrZXk6IHN0cmluZywgc3ByaXRlRnJhbWU6IFNwcml0ZUZyYW1lLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xyXG4gICAgICAgIC8vIOajgOafpee8k+WtmOWkp+Wwj1xyXG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVDYWNoZS5zaXplID49IHRoaXMuX21heENhY2hlU2l6ZSAmJiB0aGlzLl9lbmFibGVMUlUpIHtcclxuICAgICAgICAgICAgdGhpcy5ldmljdExSVUNhY2hlKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmt7vliqDliLDnvJPlrZhcclxuICAgICAgICB0aGlzLnRleHR1cmVDYWNoZS5zZXQoa2V5LCBzcHJpdGVGcmFtZSk7XHJcblxyXG4gICAgICAgIC8vIOabtOaWsExSVeWIl+ihqFxyXG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVMUlUpIHtcclxuICAgICAgICAgICAgdGhpcy5jYWNoZUtleXMucHVzaChrZXkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5pu05paw5YaF5a2Y5L2/55So5Lyw566X77yI5YGH6K6+5q+P5Liq5YOP57SgNOWtl+iKgu+8jFJHQkHvvIlcclxuICAgICAgICBjb25zdCBlc3RpbWF0ZWRNZW1vcnkgPSB3aWR0aCAqIGhlaWdodCAqIDQ7XHJcbiAgICAgICAgdGhpcy5tZW1vcnlVc2FnZSArPSBlc3RpbWF0ZWRNZW1vcnk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmm7TmlrBMUlXpobrluo9cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgdXBkYXRlTFJVT3JkZXIoa2V5OiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZUxSVSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FjaGVLZXlzLmluZGV4T2Yoa2V5KTtcclxuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xyXG4gICAgICAgICAgICAvLyDnp7vliqjliLDliJfooajmnKvlsL7vvIjmnIDov5Hkvb/nlKjvvIlcclxuICAgICAgICAgICAgdGhpcy5jYWNoZUtleXMuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgdGhpcy5jYWNoZUtleXMucHVzaChrZXkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOa3mOaxsExSVee8k+WtmFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBldmljdExSVUNhY2hlKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLmNhY2hlS2V5cy5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g56e76Zmk5pyA5LmF5pyq5L2/55So55qE57yT5a2Y77yI5YiX6KGo56ys5LiA5Liq77yJXHJcbiAgICAgICAgY29uc3Qgb2xkZXN0S2V5ID0gdGhpcy5jYWNoZUtleXMuc2hpZnQoKSE7XHJcbiAgICAgICAgdGhpcy5jbGVhckNhY2hlQnlLZXkob2xkZXN0S2V5KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOeuoeeQhue8k+WtmOWkp+Wwj1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBtYW5hZ2VDYWNoZVNpemUoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVMUlUpIHJldHVybjtcclxuXHJcbiAgICAgICAgd2hpbGUgKHRoaXMudGV4dHVyZUNhY2hlLnNpemUgPiB0aGlzLl9tYXhDYWNoZVNpemUgJiYgdGhpcy5jYWNoZUtleXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmV2aWN0TFJVQ2FjaGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmm7TmlrDlhoXlrZjkvb/nlKjkvLDnrpdcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgdXBkYXRlTWVtb3J5VXNhZ2UoKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IHRvdGFsTWVtb3J5ID0gMDtcclxuXHJcbiAgICAgICAgdGhpcy50ZXh0dXJlQ2FjaGUuZm9yRWFjaCgoc3ByaXRlRnJhbWUsIGtleSkgPT4ge1xyXG4gICAgICAgICAgICAvLyDku47nvJPlrZjplK7kuK3mj5Dlj5blsLrlr7jkv6Hmga9cclxuICAgICAgICAgICAgY29uc3Qgc2l6ZU1hdGNoID0ga2V5Lm1hdGNoKC9fKFxcZCspeChcXGQrKV8vKTtcclxuICAgICAgICAgICAgaWYgKHNpemVNYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgd2lkdGggPSBwYXJzZUludChzaXplTWF0Y2hbMV0pO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gcGFyc2VJbnQoc2l6ZU1hdGNoWzJdKTtcclxuICAgICAgICAgICAgICAgIHRvdGFsTWVtb3J5ICs9IHdpZHRoICogaGVpZ2h0ICogNDsgLy8g5q+P5Liq5YOP57SgNOWtl+iKgu+8iFJHQkHvvIlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLm1lbW9yeVVzYWdlID0gdG90YWxNZW1vcnk7XHJcbiAgICB9XHJcbn1cclxuIl19